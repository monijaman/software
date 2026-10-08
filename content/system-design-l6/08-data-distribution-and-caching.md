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

## Cache-aside, step by step

1. Ask cache for `product:42`.
2. On a hit, return the value if its freshness is acceptable.
3. On a miss, read the authoritative database.
4. Put that result in cache with a bounded TTL and return it.
5. On a product update, commit the database first, then invalidate/update cache through a reliable event.

For a popular key, a thousand simultaneous misses can stampede the database. Use request coalescing (one refresh, others wait briefly), stale-while-revalidate, jittered TTLs, and a safe fallback. Do not cache an authorization decision longer than its revocation policy permits.

## Shard deliberately

Choose a key that spreads load and matches most queries. Tenant ID works for a multi-tenant product; user ID works for personal data. A celebrity or huge tenant can still make one shard hot, so design an escape hatch such as splitting that tenant, adding buckets, or routing its reads to a specialized store. Cross-shard joins and transactions are possible, but expensive enough to model before choosing a shard key.
