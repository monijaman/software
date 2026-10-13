---
title: "Batch vs Stream and Data Modeling"
summary: "Choose when work runs and shape data for correctness first, then deliberately denormalize proven read bottlenecks."
level: Advanced
tags: [system-design, batch, streaming, normalization, denormalization]
---

> **How to read this lesson:** STAR means **Situation → Task → Action → Result**. The scenario and targets below are worked design assumptions, not claims of measured production results.

## S — Situation: the problem in context

A marketplace needs yesterday’s financial report and a fraud signal within five seconds of a purchase. Events can arrive late or twice.

## T — Task: requirements and success criteria

Provide reproducible financial totals and fresh risk signals using explicit data ownership and lateness rules.

## A — Action: design the normal path

1. Keep transactional purchase records authoritative and normalized where constraints matter.

2. Run streaming fraud checks with stable event IDs and event-time windows; define how late arrivals update a result.

3. Build reporting tables in scheduled batches or incremental jobs. Denormalize read models deliberately and retain lineage back to source records.

### Walk through a failure and recovery

An event arrives a day late after a daily report was published. Recompute or publish a correction according to the reporting contract; silently ignoring it makes totals disagree with the source.

## R — Result: how to validate the design

Replay the same input twice and require identical financial totals. Measure stream freshness, late-event count and reconciliation differences; streaming speed is useful only when outputs are correct.

### Check your understanding

Which timestamp belongs in a revenue report: purchase time or processing time?

---

## Concepts and implementation details

![Batch runs a bounded set later; streaming handles events continuously while data modeling controls read and write cost](/img/system-design-l6/batch-stream.svg)

| Choice | Use when | Cost |
| --- | --- | --- |
| Batch | Reports, backfills, daily billing | Results arrive later |
| Stream | Fraud alerts, live dashboards | Ordering/replay/deduplication |
| Normalized tables | Integrity and flexible writes | Reads may join |
| Denormalized read model | Measured read path is costly | Duplicates must stay in sync |

Streams need an ordering key, idempotency, retention and DLQ. Batch jobs need isolation so reporting cannot starve checkout. A denormalized projection needs an owner and a measurable freshness delay.

## One order, two useful models

The order database is normalized: `orders`, `order_items`, `payments`. It protects money and inventory with constraints. The customer order-history screen may use a denormalized projection with title, thumbnail, total and status. It is faster to read, but may lag by a minute.

Write the source of truth first, then publish an outbox event and build the projection idempotently. When a bug is found, rebuild the projection from retained events or source tables. Do not make the projection the only copy of important state.

| Question | Batch | Stream |
| --- | --- | --- |
| Result needed | Hourly/daily is okay | Seconds/minutes matter |
| Main risk | Reporting hurts production | Duplicate or late events |
| Proof | Completion, row counts, freshness | Lag, event age, dedupe rate |

Both styles need schema versioning, data-quality checks and an owner for failed records.
