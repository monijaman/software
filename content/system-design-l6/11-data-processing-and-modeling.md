---
title: "Batch vs Stream and Data Modeling"
summary: "Choose when work runs and shape data for correctness first, then deliberately denormalize proven read bottlenecks."
level: Advanced
tags: [system-design, batch, streaming, normalization, denormalization]
---

![Batch runs a bounded set later; streaming handles events continuously while data modeling controls read and write cost](/img/system-design-l6/batch-stream.svg)

| Choice | Use when | Cost |
| --- | --- | --- |
| Batch | Reports, backfills, daily billing | Results arrive later |
| Stream | Fraud alerts, live dashboards | Ordering/replay/deduplication |
| Normalized tables | Integrity and flexible writes | Reads may join |
| Denormalized read model | Measured read path is costly | Duplicates must stay in sync |

Streams need an ordering key, idempotency, retention and DLQ. Batch jobs need isolation so reporting cannot starve checkout. A denormalized projection needs an owner and a measurable freshness delay.
