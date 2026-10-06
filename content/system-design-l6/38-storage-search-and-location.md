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
