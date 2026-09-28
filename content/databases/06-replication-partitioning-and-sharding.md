---
title: "Replication, Partitioning & Sharding"
summary: "Scale reads with replicas, split data safely with partitions and shards, and plan for consistency, hot keys and operational recovery."
level: Advanced
tags: [database, replication, partitioning, sharding, read-replicas]
---

## These solve different bottlenecks

![Primary writes replicate to read replicas; partitioning and sharding split large data by a stable key](/img/database/replication-sharding.svg)

| Technique | Main problem solved | Still hard |
| --- | --- | --- |
| Read replica | Primary read load | Replication lag and failover |
| Table partition | One huge table/query maintenance | Cross-partition queries and pruning |
| Sharding | One machine cannot hold write/data load | Routing, rebalancing and cross-shard work |

## Replication: more reads, not instant truth

Write to the primary; replicas apply changes later. After a profile update, reading a replica may show the old value. Use read-your-own-write routing, a short primary stickiness period, or a product experience that explicitly accepts delay. Monitor replica lag and promote only a safe, current replica during failover.

## Partitioning: one logical table, smaller pieces

Partition by time for events/orders, range for geography, or list for known groups. Good partitioning enables pruning: a March query reads March partitions, not every year. Choose a partition key that matches retention and common filters. Too many tiny partitions add planning and operational overhead.

## Sharding: independent database owners

A shard key routes each row to one shard: tenant_id is often safer than an arbitrary hash when tenancy is a hard isolation boundary. Avoid hot keys such as one celebrity account. Plan the router, shard map, ID generation, backups, rebalancing and degraded behavior before splitting.

Cross-shard joins and transactions are expensive. Prefer colocating related data, asynchronous aggregates and explicit workflows. Do not shard because it sounds scalable; exhaust indexing, caching, replicas and partitioning where appropriate first.
