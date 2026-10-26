---
title: "L6 Production Debugging Casebook"
summary: "Ten practical production incidents: investigate the evidence, identify the real cause and make the system safer."
level: Advanced
tags: [system-design, production, incidents, latency, kafka, databases, resilience]
---

## How to use these drills

Start with the symptom, not your favorite technology. For each drill, name the evidence to collect, the most likely mechanism, the immediate safe mitigation, and the durable change. The scenarios are teaching examples, not claims about a specific production system.

## 1. A daily 2 PM p99 spike with ordinary logs

**Start with time correlation.** A sharp daily boundary strongly suggests scheduled work, traffic shape, cache expiry, backups, reporting, ETL, certificate work, or a third-party batch—not random application code.

1. Put p50, p95, p99, throughput, error rate, pod CPU, GC pauses, pool wait, database locks, query latency and downstream latency on the same 1:45–2:15 timeline.
2. Compare one slow distributed trace with a healthy trace for the same route. Find the span that gained time: queue wait, database acquisition, SQL, remote call, lock, or GC.
3. Check cron jobs, Kubernetes Jobs, `@Scheduled` jobs, report generation, backups, autoscaling events, cache TTL cohorts and deployment history at that exact minute.
4. Segment by route, tenant, region and pod. “No unusual logs” does not rule out waiting: a request can be slow while no exception is written.

If reports are borrowing every database connection, isolate their pool or move them to a replica/warehouse. Alert on the leading signal—pool wait, queue age, lock wait or scheduled-job duration—before customer p99 rises. See [latency investigation](./debugging-latency) and [observability](./observability-and-incidents).

## 2. Twelve partitions and fifteen consumers

Only **twelve** consumers can actively read in one consumer group: a partition is assigned to at most one group member at a time. The other **three are idle**. They stay in the group, send heartbeats, and can take a partition if an active consumer leaves or if partitions are added.

They do not make a twelve-partition topic process faster. Useful alternatives are to reduce the group to twelve, keep limited spare capacity deliberately, or increase partitions only after checking key distribution, ordering requirements and the operational cost of repartitioning. See [Kafka delivery](./message-delivery-and-kafka).

## 3. One scheduled job on three pods

Without coordination, **three reports are dispatched**: each pod starts its own scheduler and executes the same job.

Make the job single-owner. Common patterns are a Kubernetes `CronJob` with one intended execution, a database-backed lock/lease with expiry, a scheduler lock library backed by a shared store, or a queue with one idempotent report job. The report send itself should have an idempotency key, because a lock holder can crash after dispatching but before recording completion.

## 4. Every Tomcat thread waits in `HikariPool.getConnection`

The root cause is **not automatically “Hikari is broken” or “the pool is too small.”** Every request is waiting because no connection is available; the actual cause is whatever keeps existing connections checked out.

Look for a slow or blocked SQL query, lock contention, a transaction held open while doing remote I/O, a leaked connection, a database outage/saturation, or a long report consuming the shared pool. Separate pool-acquisition time from query execution time, inspect active transactions and lock waits, and capture connection-leak stack traces if enabled. Increasing pool size can make database contention worse. See [connection pooling](./connection-pooling-and-database-pressure).

## 5. Post-full-GC heap remains at 70% and rises daily

Suspect a **retained-memory leak** or an unbounded cache/queue: full GC removes unreachable objects, so memory that remains is still reachable. A small daily rise points to an accumulating reference, such as request/session data, listeners, static maps, metrics labels, retries, thread-local state, or an in-memory queue.

Capture a heap dump after full GC at a healthy baseline and again after growth. Compare dominator trees, retained size and growth by class; keep GC logs, allocation profiling/JFR, container memory limits and workload/request counts alongside the dumps. Do not diagnose only from total heap percentage: distinguish live heap, native memory, direct buffers and a too-small heap/container limit.

## 6. Rename a live column with zero downtime

Use an **expand–migrate–contract** sequence. Never rename the only live column first.

1. Add `new_column` as nullable (or with a compatible default) using an online-safe migration for the database engine.
2. Deploy code that writes both columns and reads `new_column` with fallback to `old_column`.
3. Backfill old rows in small, throttled, restartable batches; monitor locks, replication lag and error rate.
4. Validate that new writes and reads agree, then deploy code that reads only `new_column` while still dual-writing briefly.
5. After every old application version and long-running worker is gone, stop writing `old_column`.
6. In a later migration window, remove the old column and compatibility code.

The overlap protects rolling deploys, retries and delayed workers. Keep a rollback path until the destructive final step.

## 7. `OFFSET 100000` takes four seconds

The database still has to find, sort and discard roughly 100,000 earlier rows before returning the page. An index may help find the beginning, but it does not make skipped rows free; concurrent inserts can also cause duplicates or gaps between pages.

Replace deep offset pagination with **keyset (cursor) pagination** on a stable, indexed ordering key:

```sql
-- First page
SELECT id, created_at, title
FROM posts
ORDER BY created_at DESC, id DESC
LIMIT 50;

-- Next page: cursor contains the last (created_at, id)
SELECT id, created_at, title
FROM posts
WHERE (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

Use a matching composite index such as `(created_at DESC, id DESC)`. Offset remains reasonable for small pages or a bounded admin list where exact random page jumps matter more than deep-scroll performance.

## 8. Two consumers process one message after a rebalance

Kafka normally permits **at-least-once delivery**. A consumer may finish the business action but lose its session, crash, or fail before committing its offset. The group rebalances, another consumer receives the uncommitted offset, and both may appear to process the record. Long processing that exceeds `max.poll.interval.ms` can trigger the same pattern.

Prevent duplicate *effects*, not duplicate delivery: make the database write idempotent with a unique event ID or conditional state version, commit the offset only after the durable effect, and tune polling/processing so the consumer remains healthy. Do not treat a rebalance as proof that Kafka violated its assignment rule. See [message delivery](./message-delivery-and-kafka).

## 9. A ten-second dependency call cascades into your outage

Three controls should stop this from consuming all of your service:

1. **Timeouts and deadline propagation:** fail the dependency call before it consumes the entire request budget.
2. **Bounded concurrency/bulkheads:** give that dependency a small pool, queue or semaphore so its slow calls cannot occupy every request thread or connection.
3. **Circuit breaker with a safe fallback or load shedding:** stop sending likely-to-fail calls for a short recovery window and return cached, partial, queued or explicit unavailable behavior.

Retries need strict limits and jitter; retrying a ten-second failure across every request can amplify the outage. See [resilient service calls](./resilient-service-calls).

## 10. An added index makes a query slower

An index changes the optimizer's choices; it does not guarantee a faster plan. The new index may have low selectivity, stale statistics, poor column order, extra heap lookups/random I/O, an expensive sort, or increased write/maintenance pressure. The optimizer can also choose the index when a sequential scan would be cheaper for a large result set.

Compare `EXPLAIN (ANALYZE, BUFFERS)` before and after with production-like parameters. Check actual versus estimated row counts, rows filtered, index/heap reads, sort spills and query parameters. Fix the access pattern or index definition only when the measured plan supports it; run `ANALYZE` when statistics are stale, and remove an unused harmful index after verifying its dependencies. See [database scaling](./database-internals-and-scaling).

## Reusable incident worksheet

For any production symptom, record:

1. **Impact:** which user path, what percent of traffic, and which SLO changed?
2. **Time boundary:** what changed immediately before the symptom, and is it periodic?
3. **Wait location:** where does a slow trace spend additional time?
4. **Resource owner:** which queue, pool, lock, process or dependency owns the bottleneck?
5. **Safe mitigation:** what reversible limit, rollback, isolation or load-shed action reduces impact now?
6. **Proof:** which leading and customer-facing metrics must improve before closure?

That sequence keeps an incident response evidence-led: reduce harm first, prove the mechanism, then make the permanent fix.
