---
title: "Database Internals, Replication and Scaling"
summary: "Connect storage-engine choices, durability, replicas, query plans, pooling and data layout to real production behaviour."
level: Advanced
tags: [system-design, databases, btree, lsm, replication, connection-pooling]
---

> **How to read this lesson:** STAR means **Situation → Task → Action → Result**. The scenario and targets below are worked design assumptions, not claims of measured production results.

## S — Situation: the problem in context

An order database handles short writes and account-history reads. Adding read replicas reduces traffic, but a buyer sometimes cannot see an order immediately after creating it.

## T — Task: requirements and success criteria

Scale reads while preserving the specific consistency promise for read-after-write and protecting database resources.

## A — Action: design the normal path

1. Inspect query plans and index selectivity before introducing more infrastructure. Bound connection pools and transaction duration.

2. Choose storage behavior by access pattern: B-trees support ordered lookups; LSM designs trade efficient buffered writes against compaction and read amplification.

3. Route confirmation reads to the writer or use a supported replication-position barrier. Replica reads are suitable only where their lag fits the product contract.

### Walk through a failure and recovery

A replica falls 30 seconds behind. A cache or replica may show “no order” after a successful write. Route this critical read to authoritative state and shed optional history traffic if the writer is overloaded.

## R — Result: how to validate the design

Benchmark realistic queries and write bursts; measure replication lag, pool wait, compaction or I/O pressure, and confirmation correctness. More replicas do not increase the single-writer write budget automatically.

### Check your understanding

Which read endpoints need the writer and which can tolerate lag?

---

## Concepts and implementation details

![Database path: writes become durable log records, replicas serve compatible reads, and pools protect scarce connections](/img/system-design-l6/database-scaling.svg)

B-trees favor in-place indexed reads and range queries. LSM trees turn writes into sequential files, then compact them; they trade read amplification and compaction work for write throughput. Durability commonly uses a write-ahead log plus fsync/replication policy.

Use indexes and query plans before adding hardware. Replicas increase read capacity but add lag; route read-your-own-write flows carefully. Connection pools bound database borrowers. Materialized views and denormalized projections speed known reads but need refresh/freshness rules. Compression saves storage/network at CPU cost.

Choose database types by access pattern: relational, document, key-value, wide-column, graph, time-series, search and vector stores solve different queries.

## Diagnose before scaling

Start with the slow query and its execution plan. Is an index missing? Is the query returning far more rows than expected? Is a transaction holding locks too long? Is the application waiting for a pool connection? These answers change the fix.

| Symptom | First response |
| --- | --- |
| Read-heavy lookup | Add/verify index, then cache or read replica. |
| One large table | Partition only when access/retention needs it. |
| Too many app connections | Bound pools; use a proxy if needed. |
| Hot write row | Redesign counter/ownership, not just replicas. |
| Analytics hurts writes | Send it to replica/warehouse. |

Replicas are not magic: they can lag. A user who just changed a password/order may need a primary read or a read-your-own-write session rule.
