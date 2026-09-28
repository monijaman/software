---
title: "Storage Engines & Database Operations"
summary: "Understand B-trees, LSM trees, write-ahead logs, connection pools, backups and the signals behind database reliability."
level: Advanced
tags: [database, btree, lsm, wal, connection-pooling, backups]
---

## What happens below SQL matters

A storage engine decides how rows and indexes reach disk. You do not need to implement one, but you need to recognize its performance shape.

![Database operations: a bounded pool protects the primary while WAL, backups and replicas provide recoverability](/img/database/storage-operations.svg)

| Mechanism | Strength | Cost to remember |
| --- | --- | --- |
| B-tree | Point/range reads and ordered scans | Random-write/page maintenance |
| LSM tree | High write throughput, sequential writes | Compaction and read amplification |
| WAL | Crash recovery before data pages flush | Log growth and checkpoint pressure |
| Connection pool | Limits scarce DB connections | Queueing/starvation when overloaded |

## Connection pools are a shared budget

If a database safely supports 100 active connections, starting more application servers does not create more capacity. It can create thousands of waiting borrowers. Bound pool size, reserve capacity for critical traffic, set deadlines and investigate long transactions or slow queries.

## Backups are unproven until restore works

A replica is not a backup: it can copy accidental deletion or corruption. Keep independent backups, define retention, encrypt them, and test restoring a realistic dataset into an isolated environment. Know your recovery point objective (how much data loss is acceptable) and recovery time objective (how long restoration may take).

## Signals that deserve dashboards

Track pool wait, active connections, transaction age, slow-query fingerprints, lock waits, replica lag, cache hit rate, WAL/checkpoint or compaction work, disk growth, backup success and restore duration. Alert on user impact and leading saturation signals, not CPU alone.
