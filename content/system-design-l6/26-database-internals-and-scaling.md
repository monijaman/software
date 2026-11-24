---
title: "Database Internals, Replication and Scaling"
summary: "Understand what's happening inside your database (how it stores data, copies it, and hands out connections) so you can fix slowness with the right tool instead of just adding servers."
level: Advanced
tags: [system-design, databases, btree, lsm, replication, connection-pooling]
---

## The story in one minute

Your shop stores orders in one database. It's getting busy, so the team adds **read replicas** (copies of the database that can answer reads).

Here is what goes wrong, step by step:

1. A buyer places an order. It's saved on the **main** database (the **primary**, the only one that accepts writes).
2. The primary sends the change to the replicas. Usually this takes a few milliseconds.
3. Today a replica is busy and is **30 seconds behind**.
4. The buyer is sent to the "Your order is confirmed" page. That page reads from the lagging replica.
5. The replica says: **"no such order."** The buyer panics and orders again. Now there are two orders.

Adding copies helped speed, but broke a promise: "after you save something, you can see it." This lesson is about scaling a database **without** breaking promises like that.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Primary** | The one database that accepts writes. | The master copy of a document. |
| **Replica** | A copy that follows the primary and answers reads. | Photocopies handed out, a bit behind the latest edit. |
| **Replication lag** | How far behind a replica is. | The photocopy was made 30 seconds ago. |
| **Index** | A sorted lookup structure so the database doesn't scan every row. | A book's index: jump to page 212 instead of reading it all. |
| **Connection pool** | A fixed set of open database connections that app requests borrow and return. | A fixed number of shopping carts at the store entrance. |

## The fix in three rules

### Rule 1: Find out *why* it's slow before buying hardware

Most slow databases aren't short of machines. They're doing too much work per query.

❌ **Wrong:** "It's slow, add three replicas."

✅ **Right:** look at the slow query's **query plan** (the database's own explanation of how it will run the query: "I'll scan all 10 million rows" vs "I'll use the index and read 3 rows"). Then:

- Add a missing index, or fix a query returning far more rows than needed.
- **Cap the connection pool** (e.g. 20 per app server) so the database isn't flooded.
- Keep **transactions short** so they don't hold locks for long.

### Rule 2: Match the storage engine to how you use the data

A **storage engine** is how the database physically lays data on disk. Two main families:

- **B-tree:** keeps data sorted in place. Great for "find order 55" and "orders from March 1 to March 7." The usual choice for regular apps.
- **LSM tree** (Log-Structured Merge tree): writes go into memory, then get flushed to disk as new sorted files in one go. Very fast writes. The cost: reads may need to check several files, and the database must keep **compacting** (merging) files in the background.

Lots of reads and range queries? B-tree. A firehose of writes (logs, sensor data)? LSM.

### Rule 3: Send each read where its freshness fits

Ask of every read: "Is it OK if this is a few seconds old?"

- ✅ "Your order is confirmed", "your password was changed": **read from the primary**, or wait until the replica has caught up to the point of your write (a **replication-position check**: "only answer once you've applied change #48213").
- ✅ "Order history from last year", reports: a replica is fine.

## Walk through a failure

A replica falls **30 seconds behind** during a big sale.

1. Send **critical reads** (confirmation page, payment status) to the primary.
2. The primary is now busier. If it starts to struggle, **turn off or slow down optional traffic** first (like "browse full order history"), so writes and critical reads keep working.
3. Watch the lag. When it's back to normal, move non-critical reads back to replicas.

Note: a **cache** in front of the database can cause the same "no order" bug if it stored "not found" before the order was written.

## How to prove it works

1. **Benchmark real queries** with realistic data sizes and write bursts, not toy data.
2. Measure **replication lag**, **pool wait time** (how long requests wait to borrow a connection), and disk pressure from compaction.
3. **Confirmation test:** write an order, then read it immediately, thousands of times. It must always be found.
4. Remember: replicas add **read** capacity only. Every write still goes to the one primary, so more replicas do **not** let you write more.

### Check your understanding

For a shop, which of these reads must go to the primary, and which can use a replica: (a) "order confirmed" page, (b) last year's order history, (c) a nightly sales report, (d) "did my payment go through?"

<details>
<summary>Show answer</summary>

- **(a) Order confirmed** and **(d) payment status:** primary (or a replica that has provably caught up). The user just made the change and expects to see it. A stale answer makes them retry or panic.
- **(b) Old order history** and **(c) nightly report:** replica is fine. Being a few seconds behind changes nothing for the user.

The rule: if the user just wrote it, or it's about money, read fresh. Otherwise, replicas are fine.

</details>

---

## Going deeper

![Database path: writes become durable log records, replicas serve compatible reads, and pools protect scarce connections](/img/system-design-l6/database-scaling.svg)

## How a database doesn't lose your data

When you save, the database first writes the change to a **write-ahead log** (WAL): an append-only diary of changes. Then it calls **fsync**, which tells the operating system "really put this on disk now, not just in memory." Only then does it say "saved."

If the power fails, the database replays the diary on restart. Many setups also wait until a replica has the change too, so one dead disk can't lose it. How much you wait (local disk only, or also a replica) is your **durability policy**: safer means slightly slower.

## B-tree vs LSM tree in plain terms

| | B-tree | LSM tree |
| --- | --- | --- |
| Like... | A neatly sorted filing cabinet; you file each paper in its exact spot. | An inbox tray; dump papers fast, sort them into folders later. |
| Writes | Update in place (more random disk work). | Append in batches (fast, sequential). |
| Reads | One clear place to look. Good for ranges. | May check several files (**read amplification**). |
| Background work | Little. | **Compaction**: merging files, uses disk and CPU. |
| Good for | Typical apps: orders, users. | Heavy writes: logs, metrics, events. |

## Other tools for speed (and their price)

- **Read replicas:** more read capacity, but they lag. Route read-your-own-write flows carefully.
- **Connection pools:** limit how many requests can use the database at once. A proxy (like PgBouncer for Postgres) can share connections across many app servers.
- **Materialized views / denormalized tables:** precomputed answers (e.g. "total spent per customer") that make known reads fast. Price: they must be refreshed, so decide how stale they're allowed to be.
- **Compression:** less disk and network, more CPU.

## Pick the database type by the question you ask

| Type | Good at | Example |
| --- | --- | --- |
| Relational (SQL) | Joins, transactions, strict rules | Orders, payments |
| Document | Flexible nested records | Product catalog |
| Key-value | Super-fast "get by key" | Sessions, cache |
| Wide-column | Huge write volume spread across many machines | Message history |
| Graph | Following relationships | "Friends of friends" |
| Time-series | Data points over time | Server metrics |
| Search | Text search with ranking | "red running shoes" |
| Vector | "Find similar" using AI embeddings | Similar images |

## Diagnose before scaling

Start with the slow query and its plan, then ask:

1. Is an **index missing**?
2. Is the query returning **far more rows** than expected?
3. Is a transaction **holding locks** too long, making others wait?
4. Is the app actually waiting for a **pool connection**, not for the database?

Each answer leads to a different fix:

| Symptom | First response |
| --- | --- |
| Many repeated lookups | Add or check the index, then add a cache or read replica. |
| One huge table | Split it into **partitions** (e.g. by month) only if queries or deleting old data need it. |
| Too many app connections | Cap the pools; add a connection proxy if needed. |
| One row everyone writes to (a "hot" row, like a global counter) | Redesign it (e.g. split the counter into 10 rows and add them up). Replicas won't help: it's a write problem. |
| Analytics queries slow down the shop | Move them to a replica or a data **warehouse** (a separate database built for reports). |

## Quick recap

- 🔍 **Diagnose first:** query plan, indexes, locks, pool waits, then hardware.
- 🗂️ **B-tree** for typical reads and ranges; **LSM** for write-heavy loads (with compaction cost).
- 📋 **Replicas lag:** reads the user just wrote, or money reads, go to the primary.
- 🚰 **Cap connection pools** so the database isn't flooded.
- ✍️ **Replicas don't add write capacity.** Hot writes need a redesign.
