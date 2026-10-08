---
title: "Storage, Search and Location Queries"
summary: "Use the right data system for files, text search and nearby-place queries instead of forcing every need into one database."
level: Advanced
tags: [system-design, object-storage, search, geospatial, presigned-url]
---

## Three questions, three tools

| Need | Typical tool | Example |
| --- | --- | --- |
| Store a 2 GB video | Object storage | S3-like bucket, uploaded with a presigned URL. |
| Find "spicy noodles" | Search index | Tokenization, ranking and filters. |
| Find riders within 2 km | Geospatial index | Geohash/grid/R-tree style nearby lookup. |

## File upload example

```text
Client -> API: ask to upload profile-photo.jpg
API    -> Client: short-lived, scoped presigned upload URL
Client -> Object storage: upload directly
Storage -> scanner/worker: validate, scan, resize
API/database: mark file usable only after validation
```

The API avoids becoming a bandwidth bottleneck. Limit size/type, keep objects private by default, scan untrusted files and authorize both upload and download.

## Search is a projection, not the source of truth

When a restaurant changes its menu, commit the menu to the primary database, publish an outbox event, then update the search index. Search may be briefly stale; the checkout path should always verify price and availability against the authoritative data.

For nearby drivers, a geospatial index finds candidates quickly. It does not reserve a driver. The final assignment still needs a durable, atomic claim so two riders cannot both receive the same driver.

## Search lifecycle

The product database owns a restaurant/menu record. Its outbox publishes a versioned change. An indexer updates the search document. A user query tokenizes text, applies filters such as open-now/delivery area, ranks candidates, and returns a cursor. When a user opens a result or orders, re-read authoritative price, availability and permissions.

Search is intentionally a projection, so define a freshness target and a repair path: retry indexed events, compare source/index counts, and rebuild an index from source data after a mapping bug.

## Location details that prevent surprises

Index a driver's latest location with timestamp and cell. Query the requested cell plus neighbors, then calculate real distance and filter stale drivers. Do not send a rider directly to the closest index entry; location can be seconds old and the driver may already be leased. Location precision is personal data—limit retention, access and use.
