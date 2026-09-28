---
title: "N+1 Queries, Loading & Pagination"
summary: "Prevent hidden query explosions, load relations intentionally, and paginate large changing lists without scanning the past."
level: Advanced
tags: [database, n-plus-one, orm, dataloader, pagination]
---

## The hidden loop that becomes an outage

An orders endpoint loads 50 orders in one query, then its serializer reads order.customer for each order. That is 51 database queries for one request. With 100 web requests in flight, the pool and database can be overwhelmed even when each individual query is fast.

![One parent query plus N child lookups becomes a single join or batched child query; cursors avoid deep offsets](/img/database/n-plus-one.svg)

## Three correct loading strategies

| Need | Use | Watch out for |
| --- | --- | --- |
| One related row per parent | JOIN or ORM select-related | Duplicate parent rows with one-to-many joins |
| Small collection per page | One parent query plus one IN batch | Map children back to parents correctly |
| GraphQL/resolvers | Request-scoped DataLoader | Cache only for request, not forever |

Do not eagerly load every relation. It can turn a 50-row page into 50 times 20 times 10 joined rows. Ask which fields the endpoint truly renders.

## Offset versus cursor pagination

Offset asks the database to walk past old rows, then discard them. It also shifts when new records arrive. Cursor pagination says “continue after this stable row.”

    WHERE (created_at, id) < (:last_created_at, :last_id)
    ORDER BY created_at DESC, id DESC
    LIMIT 50

Support it with an index matching the filter and sort, such as orders(customer_id, created_at DESC, id DESC). Use offset for small admin lists; use a cursor for large, frequently changing feeds.

## Find it before users do

Measure queries per request, total DB time, pool-acquisition time, returned rows and p95/p99 endpoint latency. In development, log duplicate query fingerprints. In production, sample traces rather than logging sensitive SQL values.
