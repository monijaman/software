---
title: "Service Communication: Sync vs Async"
summary: Should services call each other directly or talk through events? Compare request/response with messaging, orchestration with choreography, and learn when to use each.
level: Intermediate
tags: [microservices, communication, events, rest, grpc, messaging]
---

## The big idea

Two ways to get something from a colleague:

- **Phone call (synchronous):** you call, wait on the line, and get the answer right now. If they don't pick up, you're stuck.
- **Email (asynchronous):** you send a message and carry on with your day. They reply when they can. Nobody is blocked.

Services talk to each other the same two ways.

![Synchronous calls wait for an answer; asynchronous messages don't](/img/microservices/sync-vs-async.svg)

## Synchronous: request/response

One service calls another (HTTP/REST or gRPC) and **waits** for the answer.

```mermaid
sequenceDiagram
    participant C as Client
    participant O as Orders
    participant I as Inventory
    participant P as Payments
    C->>O: POST /orders
    O->>I: reserve stock (wait…)
    I-->>O: ok
    O->>P: charge card (wait…)
    P-->>O: ok
    O-->>C: 201 Created
    Note over C,P: Total latency = sum of every hop. Any failure = whole request fails.
```

✅ **Simple** to understand and debug; you get an **immediate answer**.
❌ **Temporal coupling**: every service in the chain must be up *right now*. Latencies add up, and failures cascade.

### Availability multiplies

If each service is available 99.9% of the time, a request that must pass through 5 services synchronously succeeds only:

**0.999⁵ ≈ 99.5%**. That's roughly 5× more downtime than any single service.

```mermaid
flowchart LR
    A["A 99.9%"] --> B["B 99.9%"] --> C["C 99.9%"] --> D["D 99.9%"] --> E["E 99.9%"]
    E --> R["chain ≈ 99.5% 😬"]
```

## Asynchronous: messaging and events

A service publishes a **message** to a broker (Kafka, RabbitMQ, SQS) and moves on. Interested services consume it when they're ready.

```mermaid
sequenceDiagram
    participant C as Client
    participant O as Orders
    participant B as Broker
    participant I as Inventory
    participant E as Email
    C->>O: POST /orders
    O->>O: save order (status: PENDING)
    O->>B: publish OrderPlaced
    O-->>C: 202 Accepted ⚡
    B-->>I: OrderPlaced → reserve stock
    B-->>E: OrderPlaced → send confirmation
```

✅ **Loose coupling**: the publisher doesn't know who listens; consumers can be offline for a while; traffic spikes are buffered; new consumers can be added without touching the publisher.
❌ **Eventual consistency** (data is not updated everywhere instantly), harder debugging, and you need idempotency and ordering strategies.

## Commands vs events

| | Command | Event |
| --- | --- | --- |
| Meaning | "Please do this" | "This happened" |
| Naming | Imperative: `ReserveStock`, `SendEmail` | Past tense: `OrderPlaced`, `PaymentFailed` |
| Receivers | Exactly one handler | Zero, one or many subscribers |
| Coupling | The sender knows who does the work | The publisher doesn't know who listens |

```json
{
  "eventId": "7f3c9a1e-…",
  "type": "OrderPlaced",
  "version": 1,
  "occurredAt": "2026-09-28T10:15:00Z",
  "data": { "orderId": "ord_42", "customerId": "cus_7", "totalCents": 8997, "items": [{ "sku": "KB-1", "qty": 1 }] }
}
```

> 💡 Give every event an **ID** (for idempotency), a **type**, a **version** (for schema evolution) and a **timestamp**.

## Orchestration vs choreography

When a business process spans several services, who's in charge?

```mermaid
flowchart TB
    subgraph Orch["🎼 Orchestration: a conductor"]
      OR[Order orchestrator] -->|1. reserve| INV1[Inventory]
      OR -->|2. charge| PAY1[Payments]
      OR -->|3. ship| SHIP1[Shipping]
    end
    subgraph Chor["💃 Choreography: dancers react to each other"]
      ORD[Orders] -->|OrderPlaced| INV2[Inventory]
      INV2 -->|StockReserved| PAY2[Payments]
      PAY2 -->|PaymentCompleted| SHIP2[Shipping]
    end
```

| | Orchestration | Choreography |
| --- | --- | --- |
| Control | A central coordinator tells each service what to do | Each service reacts to events on its own |
| Visibility | ✅ The whole flow is in one place | ❌ The flow is spread across services |
| Coupling | The orchestrator knows every step | ✅ Services only know events |
| Best for | Complex flows with many steps and compensations | Simple flows, many independent reactions |
| Tools | Temporal, AWS Step Functions, Camunda | Kafka, RabbitMQ, SNS/SQS |

## Choosing a style

```mermaid
flowchart TD
    Q1{Does the caller need<br/>the answer right now?} -->|"yes: e.g. 'is this coupon valid?'"| Sync[Synchronous: REST / gRPC]
    Q1 -->|no| Q2{Is it a notification<br/>that something happened?}
    Q2 -->|yes| Ev[Publish an event]
    Q2 -->|"no: 'do this job'"| Cmd[Send a command to a queue]
```

**A common, healthy mix:**

- **Queries** (reads the user is waiting for) → synchronous, with timeouts and fallbacks.
- **State changes other services react to** → events.
- **Background jobs** → command queues.

## Keeping sync calls safe

- ⏱️ **Always set timeouts.** No timeout = one slow service can exhaust every thread.
- 🔁 **Retry with backoff**, but only idempotent operations.
- ⚡ **Circuit breakers** to fail fast when a dependency is down.
- 🧊 **Fallbacks**: a cached value, a default, or a degraded feature.

All covered in *Resilience Patterns*.

## Avoid chatty services

```mermaid
flowchart LR
    subgraph Chatty["❌ Chatty: N+1 over the network"]
      O1[Orders page] -->|"GET /users/1"| U1[Users]
      O1 -->|"GET /users/2"| U1
      O1 -->|"… ×50"| U1
    end
    subgraph Batched["✅ Batched or replicated"]
      O2[Orders page] -->|"GET /users?ids=1,2,…,50"| U2[Users]
    end
```

Or keep a **local copy** of the data you need (for example, the customer's name inside the order), kept up to date through events.

## Key takeaways

- **Sync** (REST/gRPC) is simple and immediate, but couples services in time; latency and failures add up.
- **Async** (events/queues) decouples services and absorbs spikes, at the cost of eventual consistency.
- Commands say "do this" (one handler); events say "this happened" (many subscribers).
- Orchestration centralises a flow; choreography lets services react to events.
- Mix them: sync for queries the user waits on, events for state changes, queues for background jobs.
