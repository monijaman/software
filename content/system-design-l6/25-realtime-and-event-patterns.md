---
title: "Real-Time, Pub/Sub, Webhooks and CDC"
summary: "Choose the right push or event mechanism and keep event delivery observable, idempotent and replayable."
level: Advanced
tags: [system-design, sse, webhooks, webrtc, pubsub, cdc, events]
---

## The problem in context

A merchant dashboard needs live order status, and partners need webhook notifications. Some partners are offline for hours.

## What must be true

Push fresh updates to browsers while providing durable, retryable partner delivery with a defined ordering scope.

## Practical response

1. Commit order changes and an outbox entry together, then publish a versioned event with an ID.

2. Use SSE with resumable cursors for one-way dashboard updates; use WebSockets when the interaction needs bidirectional messages.

3. Track webhook attempts durably, sign requests, bound retry age and concurrency, and deduplicate at consumers. CDC can capture database changes but does not automatically create a stable business contract.

### Walk through a failure and recovery

A partner returns success but the connection closes before the sender sees it. Retry the same event ID and require idempotent handling. On browser reconnect, read missing events or refresh current state after the resume window expires.

## How to prove it worked

Test duplicate events, long partner outages and expired cursors. Measure delivery age, browser freshness, dead-letter count and signature failures; live transport success alone does not prove durable processing.

### Check your understanding

How will a consumer distinguish a duplicate from a newer order version?

---

## Concepts and implementation details

![Event patterns: an event stream can feed pub-sub consumers, webhook delivery, server-sent updates and database change capture](/img/system-design-l6/realtime-events.svg)

| Pattern | Best for | Key rule |
| --- | --- | --- |
| SSE | Server-to-browser updates | One-way stream; reconnect with event ID |
| Webhook | Notify another server | Sign, retry and make receiver idempotent |
| WebRTC | Direct low-latency media/data | Needs signaling, NAT traversal and fallback |
| Pub/Sub | One event to many internal consumers | Define retention and consumer ownership |
| CDC | Publish committed database changes | Use an outbox/transaction log, not app guesses |

Delivery is usually at-least-once. Include event ID, schema version, ordering key and trace context; consumers deduplicate and send exhausted failures to a DLQ.

## A reliable order event

In the same transaction that creates an order, write `outbox(OrderPlaced, order_id, version, event_id)`. A publisher reads unsent rows and publishes them; it may publish twice after a crash. Consumers store processed `event_id` or use a unique business write, so the observable effect happens once.

Partition by `order_id` when order history must remain ordered. Do not promise one global order across all orders. A consumer receiving version 8 after version 9 should detect the stale version rather than overwrite newer state.

## Event contract rules

Add fields as optional first. Keep the meaning of existing fields stable. Include producer/schema version and a migration window. Retain events long enough for recovery/rebuild, but do not treat an event topic as an ungoverned dumping ground for personal data.
