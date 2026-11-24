---
title: "Debug Latency Like an Investigator"
summary: "Slow requests don't always mean busy CPUs. Find where the time is actually spent, often waiting in a line, before you add more servers."
level: Advanced
tags: [system-design, latency, observability, incidents, databases]
---

## The story in one minute

After a new release, checkout gets slow. The slowest requests used to take **300 ms**. Now they take **2 seconds**. But the servers' CPU is only **35%** busy.

Here is what goes wrong:

1. Someone says "it's slow, let's add more app servers."
2. Each new app server opens its own set of database connections.
3. The database now has **more** people competing for it, and it was already the bottleneck.
4. Checkout gets **even slower**, and the team is confused.

They guessed instead of looking. This lesson shows how to find where the time really goes.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Latency** | How long one request takes. | How long you wait for your coffee. |
| **p50 / p99** | Percentiles. p50: half of requests are faster than this. p99: 99 out of 100 are faster than this, so it shows the **slowest 1%**. | p50 is a normal wait; p99 is the unlucky customer behind a big group order. |
| **Trace** | A timeline of one request, split into steps (called **spans**) with how long each took. | A delivery tracker: "packed 2 min, waiting for van 40 min, driving 10 min". |
| **Connection pool** | A fixed set of database connections that requests borrow and return. | A shop with 10 shopping trolleys. No trolley free? You wait at the door. |
| **Lock wait** | Time spent waiting because another request is using the same database row. | Waiting outside a single bathroom. |

## The fix in three rules

### Rule 1: Split the time, then compare

Take a trace of a **fast** checkout from before the release and a **slow** one from after. Split each into:

- **pool wait**: time waiting to borrow a database connection,
- **SQL time**: time the database spent running the query,
- **downstream time**: time spent calling other services.

Whichever part **grew** is where to look. Don't guess.

### Rule 2: Look at the database, not just the app

Check **lock waits**, **query plans** (the database's step-by-step recipe for running a query; it shows if it's scanning a whole table instead of using an index) and **connection counts**. Ask: did the release change a query's shape, or how many run at once?

### Rule 3: Calm it down first, then fix the real cause

❌ **Wrong:** add app servers. More servers can mean more pools, more connections, and more contention at the database.

✅ **Right:** first a quick, reversible step (roll back the release, or reduce how many requests run at once). Then fix the **measured** cause.

## Walk through a failure

The release added a query **without an index** (an index is like a book's index: it lets the database jump to the right rows instead of reading every page).

Some worked numbers:

- The pool has **20** connections.
- Before: the query takes **10 ms**. So 20 connections can handle about 20 ÷ 0.010 = **2,000 queries per second**.
- After: the query takes **200 ms**. Now 20 connections handle only 20 ÷ 0.200 = **100 per second**.
- **500** requests per second arrive. 400 per second can't get a connection, so they **wait in line**.

Even requests whose own SQL is fast now wait in that line. That's why latency jumps while CPU stays low: the requests aren't working, they're **waiting**.

❌ "Make the pool bigger." This hides the line for a little while, but sends more slow queries to the database at once, which can make **each** query even slower.

✅ Add the index (or roll back). Each connection is freed 20 times faster, and the line disappears.

## How to prove it works

Run the **same load** before and after the fix, and compare:

1. **p95 and p99** latency of successful requests.
2. **Throughput** (requests completed per second).
3. **Pool wait** and **lock wait**.
4. That errors or waits didn't just **move** to another layer (for example, the app is faster but a downstream queue is now growing).

### Check your understanding

What evidence tells you apart "the SQL itself is slow" from "requests are waiting to get a connection"?

<details>
<summary>Show answer</summary>

Look at the **trace spans** and **pool metrics**:

- **Waiting for a connection:** the "acquire connection" span is long, but the SQL span is short. Pool metrics show all connections **in use** and many requests **pending**. The database itself shows normal query times.
- **Slow SQL:** the SQL span is long. The database's own stats (slow-query log, query plan, lock-wait stats) show the query taking longer, for example a full table scan or waiting on locks.

They often show up **together**: slow SQL holds connections longer, which **causes** pool waiting for everyone else. So find the requests with long SQL spans; they are usually the root cause, and the pool wait is the symptom.

</details>

---

## Going deeper

## Read the shape before guessing

If **p50** is normal but **p99** is bad, most requests are fine. A **smaller group** is stuck: waiting in a queue, waiting on a lock, paused, or waiting on another service. CPU can be low the whole time.

![A latency investigation follows added time through traces, pool wait, database waits and downstream services](/img/system-design-l6/latency-investigation.svg)

| What you see | Check this first |
| --- | --- |
| p50 **and** p99 both rise | Something broad: not enough capacity, the network, a new deploy, or a slow dependency. |
| **Only** p99 rises | Queueing, locks, **GC pauses** (the program stopping briefly to clean up memory), pool wait, retries, or one slow kind of request. |
| Happens **every morning** | Scheduled work: batch reports, backups, many cache entries expiring at once. |
| **Restarting** helps for a while | Something builds up: a cold cache warming, a memory leak, a periodic trigger. |

## A safe order of steps

1. **Write down the facts:** time window, which route, customer, region, the percentiles, the error rate.
2. **Compare** a healthy trace and a slow trace. Find the span that **gained** time.
3. **Inspect** what owns that time: queue age, pool acquire time, query plan or locks, pauses, or the other service's timing.
4. **Apply the smallest reversible fix** and check that the **same** metric improves.
5. **Fix the root cause** and add an alert on the **early warning** signal.

> ⚠️ Don't scale first. More app servers can mean more borrowers for the **same** worn-out connection pool at the database. Prove where the waiting is.

## Example investigation

- **At 10:00**, checkout p99 rises from **500 ms** to **5 s**, but p50 stays near **300 ms**. So most requests are fine; some are stuck.
- A **trace** shows the slow requests spend **4 seconds** just getting a database connection.
- Database CPU is **40%**. So "give the database more CPU" isn't backed by evidence.
- **Pool metrics** show all connections are being used by a new **reporting** page released that morning. Reports run long queries and hog the connections.

**Quick fix:** limit report traffic, and **reserve** some connections just for checkout.

**Lasting fix:** move reports to a **read replica** (a copy of the database used only for reading) or to a separate data warehouse that runs in the background. Set a limit on how many requests each route can run at once. Alert on **pool wait** so you see it **before** customers feel it.

## A useful evidence checklist

1. Compare p50, p95, p99 and error rate over the **same** time window.
2. Break it down by route, region, release, customer, status code and dependency.
3. Compare a healthy trace with a slow one; find the **added waiting time**.
4. Inspect the resource that owns the wait: queue, pool, lock, query plan, network or CPU pause.
5. Change **one** reversible thing and check that the metric you predicted actually moves.

In the incident write-up, record: what **triggered** it, which signal warned **first**, the **quick fix**, and the **prevention**. "We restarted it" is not a root cause.

## Quick recap

- 🔍 **Split the time:** pool wait, SQL time, downstream time. Find which one grew.
- 📉 **Read the shape:** only p99 bad usually means a line, a lock or a pause, not low CPU.
- 🚫 **Don't scale first:** more servers can mean more fighting over the same database.
- ↩️ **Calm, then cure:** reversible quick fix first, then the measured root cause.
- ✅ **Prove it:** same load, same metrics, before and after.
