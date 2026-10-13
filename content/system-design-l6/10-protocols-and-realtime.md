---
title: "Proxies, APIs and Real-Time Protocols"
summary: "Pick REST, RPC, queues, long polling, WebSockets, TCP or UDP based on the interaction shape."
level: Advanced
tags: [system-design, api, websocket, tcp, udp, proxy]
---

> **How to read this lesson:** STAR means **Situation → Task → Action → Result**. The scenario and targets below are worked design assumptions, not claims of measured production results.

## S — Situation: the problem in context

A delivery app needs order creation, live driver positions and internal price calculation. These interactions have different latency and delivery needs.

## T — Task: requirements and success criteria

Choose communication by interaction semantics, including reconnects and overload, rather than using one protocol everywhere.

## A — Action: design the normal path

1. Use request/response APIs for creating orders, with explicit errors and idempotency. Internal RPC can give typed contracts and deadlines.

2. Use SSE for a one-way order-status stream or WebSockets for bidirectional interaction. Persistent connections still need authentication, bounded buffers and reconnect behavior.

3. Use durable queues for work that must survive process failure. TCP transports ordered bytes within a connection; it does not provide durable business delivery.

### Walk through a failure and recovery

A mobile connection drops after receiving only some updates. Reconnect with a cursor and fetch authoritative state. A live socket is a transport, not a replacement for stored orders or messages.

## R — Result: how to validate the design

Test disconnects, slow clients and rolling restarts. Measure reconnect success, update lag, buffer growth and command success separately; dropping stale location samples can be acceptable while losing an order is not.

### Check your understanding

Would driver positions and payment commands use the same retry policy?

---

## Concepts and implementation details

![Communication choices: reverse proxy at the edge, request APIs, queues and persistent real-time connections](/img/system-design-l6/protocols-realtime.svg)

| Need | Good starting point | Trade-off |
| --- | --- | --- |
| Public resource API | REST over HTTPS | Familiar and cache-friendly |
| Internal typed call | gRPC/RPC | Tighter coupling |
| Slow work | Queue | Eventual result and lag |
| Occasional updates | Long polling | Repeated connections |
| Live two-way chat | WebSocket | Connection lifecycle/fan-out |
| Ordered reliable bytes | TCP | More overhead |
| Loss-tolerant media | UDP/QUIC | App tolerates loss/reordering |

A forward proxy represents clients. A reverse proxy represents servers: it can terminate TLS, route, cache and rate-limit. A queue is not a WebSocket, and a WebSocket is not a durable message log.

## Pick from the user interaction

A “save profile” request needs one answer now: HTTP REST is a clear fit. A mobile chat needs the server to push messages: use a WebSocket for live delivery, but save messages durably before acknowledgment. A video thumbnail conversion may take minutes: return a job ID and process it through a queue rather than hold an HTTP request open.

## Real-time connection checklist

- Authenticate when connecting and re-check authorization for sensitive subscriptions.
- Heartbeat and remove dead connections; mobile networks disappear silently.
- Put connection state/presence in shared ephemeral storage, not one gateway's memory.
- Define reconnect behavior: client resumes from durable cursor or sequence number.
- Apply per-user and per-room limits to prevent one room from consuming all connections.

WebSockets reduce polling, but they do not provide guaranteed delivery, persistence, ordering across servers, or offline history by themselves.
