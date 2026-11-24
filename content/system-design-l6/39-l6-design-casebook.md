---
title: "L6 Production Debugging Casebook"
summary: "Ten real-world style production problems: gather the clues, find the true cause, and make the system safer."
level: Advanced
tags: [system-design, production, incidents, latency, kafka, databases, resilience]
---

## The story in one minute

It's 2:07 PM. Your dashboard shows the app slowing down. Someone on the team says:

1. "It must be the database, let's add more connections."
2. Someone else says "No, it's Kafka, let's add more consumers."
3. A third person restarts a few servers "just to see".
4. Twenty minutes later, nobody knows what was wrong, and the problem comes back tomorrow at 2 PM.

Everyone jumped to their **favorite tool** instead of looking at the **evidence**. This casebook trains the opposite habit with ten short cases.

For each case, ask four questions:

1. **What evidence** should I collect?
2. **What is most likely really happening?**
3. **What safe step** reduces harm right now?
4. **What lasting change** stops it happening again?

(These are teaching examples, not reports about any specific real system.)

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **p99 latency** | 99% of requests are faster than this. It shows how the slowest 1% feel. | The time it takes the slowest few customers to get through a queue. |
| **Connection pool** | A fixed set of open database connections that requests borrow and return. | A library with 10 copies of a book: the 11th reader waits. |
| **Partition / consumer group** | A Kafka topic is split into lines (partitions); a consumer group is a team of readers sharing those lines. | Checkout lanes and the cashiers assigned to them. |
| **Trace span** | One timed step inside a request's trace. | One leg of a journey on a travel itinerary. |
| **Idempotent** | Doing it twice has the same effect as once. | Pressing a lift button twice still calls one lift. |

---

## 1. A daily 2 PM p99 spike with ordinary logs

**What you see:** every day around 2 PM, the slowest requests get much slower. The logs look normal.

**What's likely happening:** something that happens **on a schedule**. A sharp, daily time is a big clue. Think: scheduled jobs, a daily traffic pattern, cache entries all expiring at once, backups, reports, ETL (bulk data copy jobs), certificate renewal, or a partner's batch job. Random bugs in app code don't keep a clock.

**How to investigate:**

1. Put these on **one timeline from 1:45 to 2:15**: p50, p95, p99, requests per second, error rate, pod CPU, GC pauses (time the app freezes to clean memory), **pool wait** (time spent waiting for a database connection), database locks, query time, and the speed of services you call.
2. Compare one **slow trace** with one **healthy trace** for the same page. Find the span that got longer: waiting in a queue, waiting for a database connection, running SQL, a remote call, a lock, or GC.
3. Check what runs at **exactly** that minute: cron jobs, Kubernetes Jobs, `@Scheduled` jobs, report generation, backups, autoscaling events, cache TTLs (expiry times) that were all set together, and deploy history.
4. Split by page, customer (tenant), region and pod. ⚠️ "No unusual logs" doesn't rule out **waiting**: a request can be slow without any error being written.

**The fix:** if a daily report is borrowing **every** database connection, give reports their **own pool**, or move them to a read copy (replica) or a data warehouse. Add an alert on the **early** signal (pool wait, queue age, lock wait, or how long the scheduled job runs) so you hear about it **before** customers' p99 rises.

See [latency investigation](./debugging-latency) and [observability](./observability-and-incidents).

## 2. Twelve partitions and fifteen consumers

**What you see:** a topic has **12 partitions**. Someone added **15 consumers** in one group to speed it up. It didn't get faster.

**What's really happening:** in one consumer group, each partition goes to **at most one** consumer at a time. So only **12** consumers can work. The other **3 sit idle**.

Think of 12 checkout lanes and 15 cashiers: 3 cashiers have no lane.

The idle ones aren't useless: they stay in the group, send "I'm alive" heartbeats, and take over a partition if an active consumer leaves, or if partitions are added later. But they don't add speed.

**The fix, pick one:**

- Reduce the group to 12.
- Keep a few spares **on purpose**, as standby.
- Add partitions, but only after checking: Are keys spread evenly? Does adding partitions break ordering? (Adding partitions changes which partition a key maps to, so events for one key can split across two partitions.) And what's the operational cost?

See [Kafka delivery](./message-delivery-and-kafka).

## 3. One scheduled job on three pods

**What you see:** the "daily sales report" email arrives **three times**.

**What's really happening:** the app runs on 3 pods (copies). Each pod has its own scheduler, so each one runs the job. **Three reports go out.**

**The fix:** make the job have **one owner**. Common ways:

- a Kubernetes `CronJob` that starts a single run,
- a **lock or lease** in the database with an expiry time (whoever grabs it runs the job),
- a scheduler-lock library backed by a shared store,
- a queue holding **one** idempotent report job.

✅ Also give the **send** an idempotency key (e.g. `report:2026-11-25`). Why? The lock holder might crash **after** sending but **before** recording "done". The next run then knows not to send again.

## 4. Every Tomcat thread waits in `HikariPool.getConnection`

**What you see:** every web server thread is stuck at the same line: waiting to borrow a database connection.

**What's really happening:** the root cause is **not** automatically "Hikari (the pool library) is broken" or "the pool is too small". Threads wait because **no connection is free**. The real question is: **what is holding on to the connections?**

Likely suspects:

- a slow or blocked SQL query,
- **lock contention** (queries waiting for each other),
- a transaction kept open while calling **another service** over the network,
- a **leaked** connection (borrowed and never returned),
- the database itself being down or overloaded,
- a long report using the shared pool.

**How to investigate:** measure **time to get a connection** separately from **time running the query**. Look at active transactions and lock waits in the database. Turn on connection-leak stack traces if your pool supports it.

⚠️ Just making the pool bigger can make things **worse**: more connections means more queries fighting over the same locks and CPU.

See [connection pooling](./connection-pooling-and-database-pressure).

## 5. Heap stays at 70% after full GC and rises every day

**What you see:** right after a **full garbage collection** (the JVM's big memory cleanup), memory use is still 70%, and it's a bit higher each day.

**What's really happening:** full GC throws away everything **nobody can reach** any more. So memory that's still there is **still referenced** by something. A slow daily rise points to something that keeps **collecting** objects and never lets go, like:

- request or session data saved somewhere,
- event listeners that are added but never removed,
- static maps used as caches with no size limit,
- metric labels with ever-new values,
- retry lists, thread-local state, or an in-memory queue.

Think of a desk where papers keep getting added to a pile nobody ever clears.

**How to investigate:**

1. Take a **heap dump** (a snapshot of all objects in memory) right after full GC on a **healthy** day.
2. Take another after memory has grown.
3. Compare them: which classes grew, and what is holding on to them (the *dominator tree* and *retained size* show this).
4. Keep GC logs, allocation profiling (e.g. JFR), container memory limits and request counts next to the dumps.

⚠️ Don't judge from total heap % alone. Tell apart: live heap, **native** memory, direct buffers, and a heap or container limit that's simply too small.

## 6. Rename a live column with zero downtime

**What you see:** you want to rename `old_column` to `new_column` in a busy table, without any downtime.

❌ **Wrong:** rename it in one step. Old app servers still running during the deploy will look for `old_column` and crash.

✅ **Right:** use **expand, migrate, contract**: add the new thing, move over slowly, then remove the old thing.

1. **Add** `new_column` as nullable (or with a compatible default), using a migration that's safe to run on a live table for your database.
2. **Deploy code** that writes **both** columns and reads `new_column`, falling back to `old_column` if it's empty.
3. **Backfill** old rows in small, slowed-down, restartable batches. Watch locks, replica lag and errors.
4. **Check** that new writes and reads match. Then deploy code that reads **only** `new_column`, but still writes both for a little while.
5. When every old app version and long-running worker is gone, **stop writing** `old_column`.
6. In a **later** migration, **remove** the old column and the compatibility code.

The overlap protects you during rolling deploys, retries and slow background workers. Keep a way to roll back until the final, destructive step.

## 7. `OFFSET 100000` takes four seconds

**What you see:** page 1 of a list loads fast. Page 2,000 takes 4 seconds.

**What's really happening:** `OFFSET 100000` means "skip the first 100,000 rows". The database still has to **find, sort and throw away** about 100,000 rows before giving you the next 50. An index helps find the start, but skipping rows is never free. Also, if new rows are inserted while someone is paging, pages can show **duplicates or skip** rows.

It's like finding page 2,000 of a book by counting every page from the start.

**The fix:** use **keyset (cursor) pagination**. Remember where the last page ended, and ask for "the next 50 after this point". Use an ordering that's stable and indexed. Here `id` breaks ties when two posts have the same time:

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

Add a matching combined index such as `(created_at DESC, id DESC)`. Now the database jumps straight to the right spot like a bookmark.

OFFSET is still fine for small lists, or a small admin list where jumping to "page 7" matters more than deep-scroll speed.

## 8. Two consumers process one message after a rebalance

**What you see:** after Kafka moved partitions between consumers (a *rebalance*), one message was handled **twice**, by two different consumers.

**What's really happening:** Kafka normally gives **at-least-once** delivery. A consumer may finish the work but then lose its session, crash, or fail **before committing its offset** (saying "done up to here"). The group rebalances, another consumer gets that partition, starts from the last committed offset, and handles the message again. Processing that takes longer than `max.poll.interval.ms` (the longest time allowed between polls) causes the same thing: Kafka assumes the slow consumer is dead.

This doesn't mean Kafka broke its rule that one partition has one owner at a time. Ownership just changed between the work and the commit.

**The fix:** stop duplicate **effects**, not duplicate **delivery**:

- make the database write **idempotent** using a unique event ID or a version check,
- commit the offset only **after** the result is safely saved,
- tune polling and batch sizes so a consumer finishes in time and stays in the group.

See [message delivery](./message-delivery-and-kafka).

## 9. A ten-second dependency call takes your service down

**What you see:** a service you call starts taking 10 seconds to answer. Soon **your** whole service is down.

**What's really happening:** every request waits 10 seconds, holding a thread or connection. They run out, and everything stops, even pages that don't use that service.

**Three controls stop this:**

1. **Timeouts and deadline passing:** give up on the call before it eats the whole request's time budget.
2. **Bounded concurrency (bulkheads):** give that dependency its own small pool, queue or semaphore (a counter that limits how many can run at once), so its slow calls can't take every thread or connection.
3. **Circuit breaker with a safe fallback or load shedding:** stop sending calls that will probably fail for a short recovery window, and return a cached, partial, queued, or clearly "unavailable" answer.

⚠️ Retries need strict limits and jitter (random waits). Retrying a 10-second failure on every request can make the outage **bigger**.

See [resilient service calls](./resilient-service-calls).

## 10. Adding an index made a query slower

**What you see:** you added an index to speed up a query. It got **slower**.

**What's really happening:** an index gives the **query planner** (the part of the database that picks how to run a query) a new option. It doesn't guarantee a better plan. The new index might:

- not narrow things down much (low *selectivity*, e.g. an index on `status` where 90% of rows are `active`),
- be chosen because of **out-of-date statistics**,
- have its columns in a poor order,
- cause lots of extra table lookups and random disk reads,
- force an expensive sort,
- add work to every insert and update.

The planner may pick the index even when simply reading the whole table (a *sequential scan*) would be cheaper for a big result.

**How to investigate:** run `EXPLAIN (ANALYZE, BUFFERS)` before and after, with realistic parameters. Compare:

- **actual vs estimated** row counts (a big gap means bad statistics),
- rows filtered out,
- index and table reads,
- sorts that **spill** to disk.

**The fix:** change the query or the index only when the measured plan supports it. Run `ANALYZE` if statistics are stale. Remove an unused, harmful index after checking nothing depends on it.

See [database scaling](./database-internals-and-scaling).

---

## Reusable incident worksheet

For any production problem, write down:

1. **Impact:** which user path, what % of traffic, and which SLO (promise) got worse?
2. **Time boundary:** what changed just before it started? Does it repeat on a schedule?
3. **Wait location:** in a slow trace, where is the extra time spent?
4. **Resource owner:** which queue, pool, lock, process or dependency is the bottleneck?
5. **Safe mitigation:** what **reversible** step (a limit, rollback, isolation, or shedding load) reduces harm now?
6. **Proof:** which early-warning and customer-facing numbers must improve before you close it?

This order keeps you evidence-led: **reduce harm first, prove the cause, then make the lasting fix.**

### Check your understanding

A topic has **8 partitions**. Its consumer group has **10 consumers**, and it's falling behind. Your teammate wants to add 5 more consumers. What happens, and what should you check instead?

<details>
<summary>Show answer</summary>

**Nothing gets faster.** Only 8 consumers can be active (one per partition). Right now 2 are already idle; adding 5 more just makes 7 idle.

Instead, check **why each consumer is slow** (for example a slow database write per message), and if you truly need more parallel readers, consider **adding partitions**, after checking key spread and ordering needs.

</details>

## Quick recap

- 🔍 **Start from the symptom and the evidence**, not your favorite tool.
- 🕑 **A sharp schedule** (every day at 2 PM) points to scheduled work, not random bugs.
- ⏳ **Waiting is the usual culprit:** for a connection, a lock, a slow dependency. Find **who holds** the resource.
- 🔁 **Duplicates happen** (Kafka, schedulers, retries): make effects idempotent.
- 🧪 **Measure before changing:** bigger pools, more consumers and new indexes can all make things worse.
