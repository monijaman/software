---
title: "Proxies, APIs and Real-Time Protocols"
summary: "Pick REST, RPC, queues, long polling, WebSockets, TCP or UDP based on the interaction shape."
level: Advanced
tags: [system-design, api, websocket, tcp, udp, proxy]
---

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
