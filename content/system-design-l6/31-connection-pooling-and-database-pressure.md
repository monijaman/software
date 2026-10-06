---
title: "10,000 Users Do Not Need 10,000 Database Connections"
summary: "A practical mental model for connection pools, database pressure, query latency and safe scaling in Node.js applications."
level: Advanced
tags: [system-design, databases, PostgreSQL, MySQL, connection-pooling, performance, observability]
---

## The misconception

If 10,000 users are using an application, it is tempting to imagine 10,000 database connections too:

```text
10,000 users → 10,000 requests → 10,000 database connections
```

That is usually the wrong model—and a fast way to exhaust the database before the application reaches its user limit.

![A comparison of many lightweight HTTP connections, expensive database connections, and the connection pool that keeps database concurrency bounded](/img/system-design-l6/connection-pooling-comparison.png)

The more useful model is:

```text
10,000 users
      ↓
Node.js application
      ↓
bounded connection pool
      ↓
10–20 database connections (example)
      ↓
PostgreSQL or MySQL
```

An HTTP request may be waiting on authentication, a cache, a queue, another service, or the database. Only the part that is actively executing a query needs a database connection. When that query finishes, the connection returns to the pool and another request can borrow it.

## HTTP concurrency is not database concurrency

The number of users or open HTTP connections describes demand at the application edge. The pool size describes how much database work one application process is allowed to run concurrently.

That boundary is valuable. It prevents a traffic spike from turning directly into thousands of database sessions, and it gives the database a predictable concurrency limit. Requests that arrive while every pooled connection is busy wait briefly, fail fast, or are shed according to the application's timeout policy.

The pool is not magic, though. It is a queue. If queries take too long, the queue grows and pool wait time becomes part of request latency.

## Why thousands of connections hurt

A database connection is a real server-side resource, not just a number in a client library. Each session can consume memory, CPU during query processing, file descriptors, network/socket resources and database bookkeeping. PostgreSQL traditionally uses a server process per connection; MySQL commonly uses a thread-per-connection model. Those implementation details differ, but neither makes unlimited connections free.

The practical lesson is not that one engine is “heavy” and the other is “light.” It is that database architecture determines the cost of concurrency. Connection limits, memory budgets, transaction behavior and workload shape all matter.

For connection-heavy workloads, a pooler such as PgBouncer can sit between application clients and PostgreSQL. Transaction pooling can reuse a smaller set of server connections, but it has compatibility constraints: session state, prepared statements and long-lived session features need to be checked before enabling it.

## Pool size is a capacity decision

A useful first approximation is:

```text
maximum query throughput ≈ pool size ÷ average query time
```

For example:

```text
10 connections ÷ 1 second   ≈ 10 queries/second
10 connections ÷ 100 ms     ≈ 100 queries/second
```

This is a rough upper bound for a simple, independent workload—not a performance guarantee. Lock contention, CPU, I/O, cache misses, transaction duration, query mix and database-level limits can reduce the result substantially. Tail latency matters too: an average query time can hide a small number of very slow queries that occupy the pool for a long time.

There is also an easy scaling trap. If an application runs 8 processes and each process has a pool of 20, the database may see up to 160 application connections before migrations, workers, admin tools or replicas are counted. Pool size must be budgeted across all instances and processes, not chosen in isolation.

## What to measure before changing the number

When a service reports “too many connections” or starts timing out, increasing the pool is only one possible response—and often the wrong first one. Measure the path in two parts:

| Signal | Question it answers |
| --- | --- |
| Pool wait time | Did the request wait to acquire a connection? |
| Query execution time | Once it acquired one, how long did the database take? |
| Active / idle / pending pool counts | Is the pool saturated, underused or leaking connections? |
| p95 / p99 query latency | Is a slow tail occupying scarce connections? |
| Lock and transaction age | Is work blocked or being held open too long? |
| Database CPU, I/O and cache hit rate | Is the database itself at a resource limit? |

On PostgreSQL, `pg_stat_statements` is especially useful for finding high-total-time, high-call-count and high-mean-latency queries. Query plans, indexes, bounded transactions and sensible timeouts usually produce a safer improvement than blindly adding concurrency.

## A safer tuning sequence

1. Establish the database connection budget across application instances, workers and administrative clients.
2. Instrument pool acquisition time separately from query execution time.
3. Find slow, frequent or lock-heavy queries and inspect their plans.
4. Add or adjust indexes only when the access pattern and plan justify them.
5. Keep transactions short and release connections in every success and error path.
6. Set acquisition, statement and request timeouts so work cannot wait forever.
7. Load-test with realistic query mixes, concurrency and p95/p99 targets.
8. Increase the pool only when the database has spare capacity and pool wait is the proven bottleneck.

## The L6 takeaway

10,000 users do not imply 10,000 database connections. They imply a workload that needs a deliberate concurrency budget.

The goal is not to maximize the number of connections. It is to keep the database busy enough to meet the latency target without allowing queueing, slow queries or one noisy workload to exhaust shared capacity.

Measure first. Identify where the time is going. Then scale the bottleneck—and protect the database while you do it.
