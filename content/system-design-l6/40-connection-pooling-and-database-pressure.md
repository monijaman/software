---
title: "10,000 Users Do Not Need 10,000 Database Connections"
summary: "Why a few busy database connections can serve thousands of users, how to size a connection pool, and what to check before you make it bigger."
level: Advanced
tags: [system-design, databases, PostgreSQL, MySQL, connection-pooling, performance, observability]
---

## The story in one minute

You run a **Node.js service** on **10 servers** (we call each copy an *instance*). Each instance keeps **20 database connections** ready. The database allows at most **250 connections** in total.

Here is what goes wrong, step by step:

1. Today: 10 instances × 20 connections = **200** connections. That fits under 250.
2. Traffic grows. Autoscaling (the cloud adding servers for you) doubles the app to **20 instances**.
3. Now the app wants 20 × 20 = **400** connections. The database only allows 250.
4. New instances get "too many connections" errors. Admin tools and background workers can't connect either.

More servers made things **worse**, not better. This lesson is about why, and how to size connections on purpose.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Database connection** | An open line between your app and the database. Each one costs the database memory and work. | A phone line into a busy office. Each line needs a person to staff it. |
| **Connection pool** | A small set of connections that requests borrow, use, and give back. | A library with 10 copies of a book. You borrow one, read, return it. |
| **Pool wait** | Time a request spends waiting for a free connection. | Waiting in line because all 10 copies are checked out. |
| **Instance** | One running copy of your app. | One branch of the same shop. |
| **Connection budget** | The total number of connections you allow across *all* instances and tools. | The office has 250 phone lines, shared by every team. |
| **Transaction** | A group of database steps that succeed or fail together. It keeps its connection the whole time. | Holding the phone line until the whole conversation is done. |

## The fix in three rules

### Rule 1: Count every pool, not just one

Pool size is not "per app". It multiplies by every instance and process.

❌ **Wrong:** "Each instance gets 20 connections." Then autoscaling quietly asks for 400.

✅ **Right:** start from the database limit and share it out:

```text
250 total
- 50 kept free for admins, migrations and workers
= 200 for the app
÷ 20 instances (the maximum autoscaling allows)
= 10 connections per instance
```

### Rule 2: Size for busy queries, not for users

A logged-in user is not running a query most of the time. Only a request that is **running a query right now** needs a connection.

Use this simple formula (it's called *Little's law*):

```text
busy connections ≈ queries per second × seconds each query holds a connection
```

At **1,000 queries per second**, each holding a connection for **20 ms** (0.02 s):

```text
1,000 × 0.02 = 20 busy connections on average
```

So 20 connections (plus some spare room for bursts) can handle 1,000 queries a second, no matter whether you have 1,000 or 100,000 users.

### Rule 3: Keep the line short and don't let anyone wait forever

- Keep transactions **short**, so connections come back quickly.
- Put a **limit on the pool's waiting line** and a **timeout** on waiting.
- If the wait is too long, fail fast with "busy, try again" instead of hanging.

## Walk through a failure

One slow transaction starts holding its connection for **2 seconds** instead of 20 ms.

1. Connections come back 100 times slower.
2. The pool fills up. New requests stand in the pool's waiting line.
3. Waiting requests hit their timeout. Users see errors.

The tempting fix is "add more connections". That often makes it worse: more queries fight over the same locks (a lock is a "do not touch, I'm using this" sign on a row) and the same disk. The database gets slower for everyone.

✅ **Better order:**

1. Find the slow query or long transaction and fix it (index, smaller transaction, timeout).
2. Limit how much work gets in while it's slow (bounded wait line, fail fast).
3. Only then, if the database has spare CPU and disk, consider a bigger pool.

## How to prove it works

Run a load test with **the maximum number of instances** and some **deliberately slow queries**, then check:

1. Total connections **never go above** the budget (here, 200 for the app).
2. **Pool wait time** stays low, or requests are rejected quickly instead of hanging.
3. Database CPU and disk stay below their limits.
4. You can see how many requests were **rejected**, and the number is small.
5. When the slow queries stop, everything **recovers by itself**.

### Check your understanding

The database allows 250 connections. You keep 50 for admins and workers. You run 20 instances. How many connections may each instance use?

<details>
<summary>Show answer</summary>

**10 connections each.** 250 − 50 = 200 for the app. 200 ÷ 20 instances = 10. If autoscaling can go above 20 instances, divide by that higher maximum instead, or you'll overshoot the budget.

</details>

---

## Going deeper

## The wrong picture

If 10,000 users are on your app, it's tempting to picture this:

```text
10,000 users → 10,000 requests → 10,000 database connections
```

That's usually wrong, and it's a fast way to crash the database long before the app hits its real user limit.

![A comparison of many lightweight HTTP connections, expensive database connections, and the connection pool that keeps database concurrency bounded](/img/system-design-l6/connection-pooling-comparison.png)

The better picture:

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

A web request spends its time on many things: checking the login, reading a cache, calling another service, waiting on a queue. Only the moment it's **actually running a query** needs a database connection. When the query finishes, the connection goes back to the pool and the next request borrows it.

Think of a restaurant: 200 diners, but only 5 cooks. Diners spend most of their time eating and talking, not cooking. You don't hire one cook per diner.

## Web traffic is not database traffic

- The number of users or open web connections tells you **how much demand** arrives at the front door.
- The pool size tells you **how much database work** one instance may run **at the same time** (this is called *concurrency*).

That boundary is useful. A traffic spike can't turn straight into thousands of database sessions. The database gets a predictable limit. When all pooled connections are busy, new requests either wait briefly, fail fast, or get turned away, depending on your timeout rules.

But the pool is not magic. **It's a queue** (a waiting line). If queries are slow, the line grows, and the time spent waiting in it becomes part of what the user feels.

## Why thousands of connections hurt

A database connection is a real thing on the database server, not just a number in your code. Each one can use:

- memory,
- CPU while running queries,
- file handles and network sockets,
- the database's own bookkeeping.

PostgreSQL traditionally starts a **separate process** for each connection. MySQL usually uses a **thread** per connection. The details differ, but neither makes unlimited connections free.

The lesson is not "one database is heavy and the other is light". It's that **every database has a cost for each extra thing happening at once**. Connection limits, memory, transaction length and the kind of queries you run all matter.

### A middleman: PgBouncer

If you have many app clients, a **connection pooler** such as **PgBouncer** can sit between your apps and PostgreSQL. In *transaction pooling* mode, many app connections share a small number of real database connections, one transaction at a time.

The catch: some features expect to keep the **same** database connection across transactions. Check these before turning it on:

- session settings (like `SET` commands),
- prepared statements (queries the database pre-planned for one connection),
- other long-lived session features (like advisory locks or `LISTEN`).

## Pool size is a capacity decision

A rough first guess:

```text
maximum queries per second ≈ pool size ÷ average query time
```

Examples:

```text
10 connections ÷ 1 second   ≈ 10 queries/second
10 connections ÷ 100 ms     ≈ 100 queries/second
```

This is a **best-case ceiling**, not a promise. Many things lower it:

- locks (queries waiting for each other),
- CPU and disk limits,
- data not being in memory (cache misses),
- long transactions,
- a mix of fast and slow queries.

Watch the **slowest** queries too, not just the average. The *p95* or *p99* latency means "95% (or 99%) of queries are faster than this". A few very slow queries can sit on scarce connections for a long time while the average still looks fine.

### The scaling trap, again

8 processes × a pool of 20 = up to **160** app connections, **before** you count migrations, background workers, admin tools or replicas. Always budget pool size across every instance and process. Never pick it in isolation.

## What to measure before changing the number

When you see "too many connections" or timeouts, a bigger pool is only one option, and often the wrong first one. Split the time into two parts: **waiting for a connection** and **using it**.

| Signal | Question it answers |
| --- | --- |
| Pool wait time | Did the request wait to get a connection? |
| Query execution time | Once it had one, how long did the database take? |
| Active / idle / pending pool counts | Is the pool full, barely used, or leaking (connections never returned)? |
| p95 / p99 query latency | Are a few slow queries hogging connections? |
| Lock and transaction age | Is work blocked, or held open too long? |
| Database CPU, disk I/O and cache hit rate | Is the database itself at its limit? |

A quick way to read the first two rows:

| Pool wait | Query time | Likely problem |
| --- | --- | --- |
| High | Low | Pool too small, or connections not being returned |
| High | High | Slow queries are clogging the pool; fix the queries first |
| Low | High | The database itself is slow; more connections won't help |

On PostgreSQL, the `pg_stat_statements` extension shows which queries use the **most total time**, run **most often**, or are **slowest on average**. Better query plans, the right indexes, short transactions and sensible timeouts are usually a safer win than adding more connections.

## A safer tuning order

1. Set the **connection budget** across all app instances, workers and admin tools.
2. Measure **pool wait time** separately from **query time**.
3. Find slow, frequent or lock-heavy queries and look at their plans (`EXPLAIN`).
4. Add or change indexes only when the query pattern and plan show they help.
5. Keep transactions short, and **always** give connections back, on success and on error.
6. Set timeouts for getting a connection, for each query, and for the whole request, so nothing waits forever.
7. Load-test with realistic queries, realistic concurrency, and p95/p99 goals.
8. Grow the pool **only** when the database has spare capacity and pool wait is the proven bottleneck.

## The big takeaway

10,000 users don't mean 10,000 database connections. They mean a workload that needs a **planned limit** on how much database work runs at once.

The goal isn't the most connections. It's keeping the database busy enough to hit your speed target, without letting long waits, slow queries or one noisy feature use up shared capacity.

Measure first. Find where the time goes. Then fix that bottleneck, and protect the database while you do.

## Quick recap

- 👥 **Users ≠ connections:** only requests running a query right now need one.
- 🧮 **Budget across everything:** total limit − reserve, divided by the max number of instances.
- ⏱️ **Little's law:** busy connections ≈ queries per second × seconds held.
- 🔍 **Measure before growing:** split pool wait from query time; fix slow queries first.
- 🚦 **Fail fast:** bounded wait line and timeouts, so a slow database doesn't freeze the app.
