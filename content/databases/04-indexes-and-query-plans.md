---
title: "Indexes, EXPLAIN & Query Plans"
summary: "Design indexes from real filter, join and sort patterns, then prove improvements with query plans and production-like data."
level: Advanced
tags: [database, indexes, explain, query-optimization, btree]
---

## An index is a sorted shortcut, not free speed

Without an index, a database may inspect every row. A B-tree index keeps selected values ordered so it can seek to a small matching range. The cost is extra disk, memory, write work and maintenance.

![An index lets the database seek to matching rows; EXPLAIN verifies whether the actual query takes that fast path](/img/database/indexes.svg)

## Design from a query

Suppose the product page asks: “show this customer newest paid orders.”

    SELECT id, created_at, total_cents
    FROM orders
    WHERE customer_id = :customer_id AND status = 'PAID'
    ORDER BY created_at DESC
    LIMIT 50;

A useful starting index is orders(customer_id, status, created_at DESC). Equality filters usually come first, then range/sort columns. The database and exact query decide the final answer.

| Query pattern | Index idea |
| --- | --- |
| Join orders to customer | orders(customer_id) |
| Lookup one active email | users(email) with unique/partial rule |
| Time-range events per tenant | events(tenant_id, created_at) |
| Deep cursor page | sort/filter columns plus stable id |

## Common index mistakes

- Indexing every column: writes become slow and memory pressure rises.
- Putting a low-selectivity flag first: most rows still match.
- Wrapping an indexed column in a function without a matching expression index.
- Forgetting the join-side foreign key index.
- Adding an index without measuring the actual plan.

## Read the plan, then measure

Run EXPLAIN ANALYZE on representative data. Check scan type, estimated versus actual rows, join method, sort work, buffers and execution time. A sequential scan is not automatically bad: reading most of a small table can be cheaper than index random I/O.

## Investigating a slow query, step by step

"The orders page is slow" is a symptom, not a diagnosis. Follow the same loop every time: **find** the query, **explain** it, **diagnose** the cause, **fix** one thing, and **verify** with numbers.

![The slow-query loop: find, explain, diagnose, fix, verify, then repeat until the target is met](/img/database/slow-query-workflow.svg)

The examples use PostgreSQL. MySQL, SQL Server and Oracle have the same ideas with different commands.

### Step 1: Find the slow query

Don't guess from the code. Let the database tell you which queries cost the most.

| Source | What it gives you |
| --- | --- |
| **`pg_stat_statements`** (PostgreSQL) / Performance Schema (MySQL) | Every query shape with call count, total time, mean and max time |
| **Slow query log** (`log_min_duration_statement = 500ms`, MySQL `slow_query_log`) | The exact slow statements with their parameters |
| **APM / tracing** (Datadog, New Relic, OpenTelemetry) | Which endpoint ran the query and how much of the request time it used |
| **Application logs** | Query duration next to the request ID |

```sql
-- Top 5 queries by TOTAL time: often a fast query called a million times
SELECT query, calls,
       round(total_exec_time) AS total_ms,
       round(mean_exec_time, 1) AS mean_ms
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 5;
```

> 💡 Sort by **total time**, not just the slowest single run. A 5 ms query called 2 million times a day costs more than a 3 s report that runs once.

Say this query is at the top. It powers the "recent paid orders" admin page:

```sql
SELECT o.id, o.total_cents, o.created_at, c.name
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.status = 'PAID'
  AND o.created_at >= '2026-10-01'
ORDER BY o.created_at DESC
LIMIT 50;
```

### Step 2: Run `EXPLAIN ANALYZE`

`EXPLAIN` shows the plan the database **intends** to use. `EXPLAIN ANALYZE` **actually runs** the query and adds real row counts and timings. Add `BUFFERS` to see how much data was read.

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ... ;  -- the query above
```

> ⚠️ `EXPLAIN ANALYZE` really executes the statement. For `UPDATE`/`DELETE`, wrap it in `BEGIN; ... ROLLBACK;`, and run it on production-sized data (a staging copy or a replica). A plan on a 100-row dev table tells you nothing.

Read the plan from the **most indented line outward**. Each line is one step, and its child rows feed into it:

![An annotated EXPLAIN ANALYZE plan: a sequential scan reads 2 million rows and removes 1.9 million of them, taking 1.1 of the 1.24 seconds](/img/database/explain-analyze-annotated.svg)

| Look for | Why it matters |
| --- | --- |
| `Seq Scan` on a big table | Reads every row; usually means no usable index |
| `Rows Removed by Filter` much larger than rows kept | The database is throwing away most of what it reads |
| **Estimated `rows=` vs `actual rows=`** far apart (10× or more) | Statistics are stale, so the planner picked a bad plan |
| The step with the biggest `actual time` | That's where to focus. Ignore the rest for now |
| `Sort Method: external merge Disk` | The sort spilled to disk; raise `work_mem` or avoid the sort with an index |
| `Nested Loop` with large `loops=` | An inner step runs thousands of times |
| `Buffers: shared read=` high | Data came from disk, not memory |

### Step 3: Check whether indexes are used

In the plan above, `orders` has no index on `status` or `created_at`, so PostgreSQL reads **all 2 million rows** to keep 61,240, then sorts them to return 50.

Common reasons an index exists but is **not** used:

| Query pattern | Problem | Fix |
| --- | --- | --- |
| `WHERE LOWER(email) = ?` | A function on the column hides the index | Expression index `ON users (LOWER(email))` |
| `WHERE created_at::date = '2026-10-01'` | Cast on the column | Range: `created_at >= '2026-10-01' AND created_at < '2026-10-02'` |
| `WHERE name LIKE '%son'` | Leading wildcard | Full-text or trigram index (`pg_trgm`) |
| `WHERE user_id = '42'` on an integer column | Type mismatch forces a cast | Pass the right type |
| Index on `(status, customer_id)`, query filters only `customer_id` | Left-most column not used | Index `(customer_id, …)` or reorder |
| `WHERE status = 'ACTIVE'` matching 95% of rows | Low selectivity: a full scan is cheaper | That's correct behavior; filter on something more selective |

### Step 4: Find expensive joins and sequential scans

Each join strategy suits a different situation:

| Join | Good when | Warning sign |
| --- | --- | --- |
| **Nested Loop** | Outer side is small and the inner side has an index | Large `loops=` with a `Seq Scan` inside |
| **Hash Join** | Joining two large sets with no useful order | Hash `Batches:` above 1 (spilled to disk) |
| **Merge Join** | Both sides already sorted on the join key | An extra big `Sort` added just to merge |

Make sure **foreign key columns are indexed** (`orders.customer_id`). PostgreSQL does **not** create those indexes automatically.

### Step 5: Check table statistics

The planner chooses a plan from **statistics** about your data. If they're stale (after a bulk import, or a column whose values shifted), estimates go wrong and so does the plan.

```sql
-- When were stats last refreshed?
SELECT relname, n_live_tup, n_dead_tup, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
WHERE relname = 'orders';

-- Refresh them now
ANALYZE orders;
```

A large `n_dead_tup` means the table is bloated with old row versions. Check that autovacuum is keeping up.

### Step 6: Reduce unnecessary columns and rows

- **Select only what you need.** `SELECT *` reads wide columns (JSON, text blobs), sends more bytes over the network, and prevents **index-only scans**.
- **Filter in SQL, not in application code.** Don't fetch 10,000 rows to show 20.
- **Paginate with a cursor, not a deep `OFFSET`.** `OFFSET 100000` still reads and throws away 100,000 rows (see [N+1 and pagination](/learn/databases/n-plus-one-and-pagination)).

```sql
-- ❌ Page 2,000: reads 100,050 rows, returns 50
SELECT ... ORDER BY created_at DESC OFFSET 100000 LIMIT 50;

-- ✅ Cursor: seeks straight to where the last page ended
SELECT ... WHERE (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC LIMIT 50;
```

### Step 7: Optimize filters and joins (the fix)

For our query, the filter is `status = 'PAID'` (equality) plus a range on `created_at`, and the sort is `created_at DESC`. One composite index covers all three: **equality column first, then the range/sort column**.

```sql
CREATE INDEX CONCURRENTLY idx_orders_status_created
  ON orders (status, created_at DESC);
```

`CONCURRENTLY` builds the index without blocking writes on a live table. Now the database walks the index in order, stops after 50 rows, and looks up each customer by primary key:

```text
Limit  (actual time=0.05..0.41 rows=50 loops=1)
  ->  Nested Loop  (actual time=0.05..0.40 rows=50 loops=1)
        ->  Index Scan using idx_orders_status_created on orders o  (actual rows=50 loops=1)
              Index Cond: ((status = 'PAID') AND (created_at >= '2026-10-01'))
        ->  Index Scan using customers_pkey on customers c  (actual rows=1 loops=50)
Execution Time: 0.48 ms
```

Other common rewrites:

- Replace `WHERE id IN (SELECT ...)` over huge sets with a `JOIN` or `EXISTS`.
- Replace `OR` across different columns with `UNION ALL` of two indexed queries.
- Pre-aggregate heavy dashboard queries into a **materialized view** or summary table.
- Cache results that are read often and change rarely.

### Step 8: Check connections and locks

Sometimes the SQL is fine, and the time goes on **waiting**:

![Request time split into pool wait, lock wait, execution and transfer: only the execution part is fixed by indexes](/img/database/query-time-breakdown.svg)

```sql
-- What is running right now, and what is it waiting on?
SELECT pid, now() - query_start AS running_for, state, wait_event_type, wait_event, left(query, 60)
FROM pg_stat_activity
WHERE state <> 'idle'
ORDER BY running_for DESC;

-- Who is blocking whom?
SELECT blocked.pid AS blocked_pid, blocking.pid AS blocking_pid, left(blocking.query, 60) AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking ON blocking.pid = ANY (pg_blocking_pids(blocked.pid));
```

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Fast in `EXPLAIN ANALYZE`, slow in the app | Waiting for a pool connection | Shorter transactions, right-size the pool, fix slow neighbors |
| `wait_event_type = Lock` | Another transaction holds the row or table | Shorten that transaction, avoid long-running `ALTER TABLE` at peak |
| `idle in transaction` sessions | App opened a transaction and forgot it | Fix the code; set `idle_in_transaction_session_timeout` |
| Slow only at peak | CPU or I/O saturated | Fix the top queries first, then add replicas or capacity |

### Step 9: Compare before and after

Measure with the **same query, the same parameters and the same data**, and look at production metrics afterwards, not just one run.

![Before: sequential scan reading 2 million rows in 1,244 ms. After: index scan reading 50 rows in 0.48 ms](/img/database/query-before-after.svg)

| Metric | Before | After |
| --- | --- | --- |
| Plan | Seq Scan + Hash Join + Sort | Index Scan + Nested Loop |
| Rows read from `orders` | 2,000,000 | 50 |
| Execution time | 1,244 ms | 0.48 ms |
| Endpoint p95 (APM) | 1.4 s | 45 ms |

Then check the cost side: the new index adds **write overhead and disk space**. If insert-heavy tables slow down, or `pg_stat_user_indexes` shows `idx_scan = 0` after a week, reconsider it.

### Quick checklist

1. Find the query by **total time** (`pg_stat_statements`, slow log, APM).
2. `EXPLAIN (ANALYZE, BUFFERS)` on production-sized data.
3. Biggest `actual time` step: seq scan? rows removed? bad estimate?
4. Index missing, or present but unusable (function, cast, wildcard, column order)?
5. Joins: foreign keys indexed, no huge loops, no spills to disk.
6. Statistics fresh (`ANALYZE`), table not bloated.
7. Fewer columns, fewer rows, cursor pagination.
8. Rule out pool waits and lock waits.
9. Change **one thing**, measure again, and watch production.

### Interview answer

**Q: How do you investigate and optimize a slow SQL query?**

> "First I find which query is actually slow using `pg_stat_statements` or the slow query log, sorted by total time, and confirm the affected endpoint in APM. Then I run `EXPLAIN ANALYZE` with buffers on production-sized data and look at the most expensive step: sequential scans on large tables, rows removed by filters, estimated versus actual row counts, and expensive joins or sorts.
>
> I check whether the right indexes exist and are actually usable, since functions, casts or the wrong column order can hide an index. I refresh statistics if the estimates are far off, select only the columns I need, and replace deep `OFFSET` pagination with cursors. I also rule out waiting time by checking connection pool waits and locks in `pg_stat_activity`.
>
> I change one thing at a time, often a composite index built concurrently, then compare the plan, execution time and endpoint p95 before and after, and keep an eye on the index's write cost."

## Operational checklist

Capture slow query fingerprints, not only raw SQL text. Compare p50 and p99. Refresh statistics after data shape changes. Remove unused indexes carefully, and create large production indexes with the engine-safe online/concurrent method where available.
