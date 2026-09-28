---
title: "Database Internals, Replication and Scaling"
summary: "Connect storage-engine choices, durability, replicas, query plans, pooling and data layout to real production behaviour."
level: Advanced
tags: [system-design, databases, btree, lsm, replication, connection-pooling]
---

![Database path: writes become durable log records, replicas serve compatible reads, and pools protect scarce connections](/img/system-design-l6/database-scaling.svg)

B-trees favor in-place indexed reads and range queries. LSM trees turn writes into sequential files, then compact them; they trade read amplification and compaction work for write throughput. Durability commonly uses a write-ahead log plus fsync/replication policy.

Use indexes and query plans before adding hardware. Replicas increase read capacity but add lag; route read-your-own-write flows carefully. Connection pools bound database borrowers. Materialized views and denormalized projections speed known reads but need refresh/freshness rules. Compression saves storage/network at CPU cost.

Choose database types by access pattern: relational, document, key-value, wide-column, graph, time-series, search and vector stores solve different queries.
