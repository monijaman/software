---
title: "Real-Time, Pub/Sub, Webhooks and CDC"
summary: "Choose the right push or event mechanism and keep event delivery observable, idempotent and replayable."
level: Advanced
tags: [system-design, sse, webhooks, webrtc, pubsub, cdc, events]
---

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
