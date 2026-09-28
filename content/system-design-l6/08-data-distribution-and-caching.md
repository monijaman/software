---
title: "Caching, Consistent Hashing and Sharding"
summary: "Move reads close to users, distribute data safely, and understand cache and database consistency costs."
level: Advanced
tags: [system-design, caching, sharding, consistent-hashing, databases]
---

## Three different tools

![A request can use cache for speed, consistent hashing for stable placement, and shards for database scale](/img/system-design-l6/data-distribution.svg)

| Tool | Solves | Risk |
| --- | --- | --- |
| Cache | Repeated read latency/load | Stale data and stampedes |
| Consistent hash ring | Placement when nodes change | Hot keys; use virtual nodes |
| Sharding | One DB cannot hold/write everything | Cross-shard work and resharding |

Cache-aside reads cache then populates it on a miss. Read-through lets the cache load the source; write-through writes cache and source. TTL, invalidation and request coalescing are part of the design.

A hash ring moves only some keys when nodes change. Choose a stable shard key such as tenant or user ID, and remember: cache is never the source of truth.
