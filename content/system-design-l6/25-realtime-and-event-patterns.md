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
