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

## Operational checklist

Capture slow query fingerprints, not only raw SQL text. Compare p50 and p99. Refresh statistics after data shape changes. Remove unused indexes carefully, and create large production indexes with the engine-safe online/concurrent method where available.
