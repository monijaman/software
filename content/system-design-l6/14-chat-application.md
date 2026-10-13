---
title: "Design a Chat Application"
summary: "Deliver live messages without losing them by separating durable messages from fan-out, presence and offline notifications."
level: Advanced
tags: [system-design, chat, websocket, messaging, presence]
---

> **How to read this lesson:** STAR means **Situation → Task → Action → Result**. The scenario and targets below are worked design assumptions, not claims of measured production results.

## S — Situation: the problem in context

Alice sends “Meet at 6” on a weak connection. Bob is online on two devices, and Alice retries because her acknowledgment never arrives.

## T — Task: requirements and success criteria

Persist each accepted message once per sender identity and preserve a defined per-conversation order. Online presence can be stale.

## A — Action: design the normal path

1. POST or send a command containing conversation ID and client message ID. Enforce membership before writing.

2. Persist the message with a conversation cursor and acknowledge only after the chosen durability boundary. Deduplicate retries with a unique constraint.

3. Fan out through gateways and notify offline devices separately. Devices resume from their last durable cursor; receipt state and presence are distinct from message storage.

### Walk through a failure and recovery

The gateway dies after persistence but before ack. Alice retries the same message ID, receives the stored outcome and does not create a duplicate. Bob fetches by cursor after reconnect even if live fan-out failed.

## R — Result: how to validate the design

Test crash-after-commit, duplicate sends and reconnect gaps. Require no acknowledged-message loss under the declared failure model; measure delivery lag and per-conversation ordering violations.

### Check your understanding

How would a group with 100,000 members change the fan-out path?

---

## Concepts and implementation details

![Chat separates durable conversation storage from WebSocket fan-out, presence and offline push paths](/img/system-design-l6/chat.svg)

Persist a message before acknowledging it, then publish a durable event for recipients. A client idempotency key makes reconnect/retry safe. Order messages by conversation key, not globally.

Presence is temporary state with TTL heartbeats; delivery and read receipts are durable state transitions. Offline push comes from the durable event, not an in-memory gateway.

## Define the message promise

For a direct chat, a useful promise is: a sender sees "accepted" only after the message is durable; recipients eventually see it once; messages within one conversation appear in order. Global ordering across every conversation is unnecessary and expensive.

## Send and receive flow

```text
Sender app -> WebSocket gateway -> message API -> conversation database
                                             -> MessageAccepted event
                                                -> online recipient gateway
                                                -> offline push worker
```

The client sends `client_message_id`, for example `phoneA:981:4`. The database has a unique constraint on `(sender_id, client_message_id)`. If the mobile network drops after the server saves the message, the client can retry safely and receive the original message instead of creating a duplicate.

## Ordering without pretending the network is perfect

Give each conversation an increasing sequence number in its durable write path. A recipient that receives sequence 44 before 43 holds 44 briefly or fetches missing history. Do not use the device clock to decide message order; phones disagree about time.

| State | Meaning |
| --- | --- |
| Accepted | Server stored the sender's message durably. |
| Delivered | At least one recipient device confirmed receipt. |
| Read | A recipient explicitly advanced their read position. |

These are separate facts. A WebSocket connection existing does not prove a user saw the message.

## Failure and scale example

If a gateway process crashes, clients reconnect to another gateway and ask for messages after their last durable sequence. Gateway memory is never the source of truth. For a group with one million members, do not synchronously send one million socket writes from the original request; create bounded fan-out work, preserve priority for direct/security messages, and record delivery progress.

Track connected users, reconnect rate, undelivered-message age, duplicate rejections, sequence gaps, push-provider failures and per-conversation hot spots.
