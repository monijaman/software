---
title: "Design a Chat Application"
summary: "Deliver live messages without losing them by separating durable messages from fan-out, presence and offline notifications."
level: Advanced
tags: [system-design, chat, websocket, messaging, presence]
---

![Chat separates durable conversation storage from WebSocket fan-out, presence and offline push paths](/img/system-design-l6/chat.svg)

Persist a message before acknowledging it, then publish a durable event for recipients. A client idempotency key makes reconnect/retry safe. Order messages by conversation key, not globally.

Presence is temporary state with TTL heartbeats; delivery and read receipts are durable state transitions. Offline push comes from the durable event, not an in-memory gateway.
