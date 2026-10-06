---
title: "The Hot SKU Alert Problem"
summary: "A staff-level design exercise for notifying millions of watchers without losing delivery guarantees, flooding providers or locking the source of truth."
level: Advanced
tags: [system-design, notifications, Kafka, fan-out, idempotency, backpressure, consistency]
---

## The interview prompt

A popular SKU drops from ₹5,000 to ₹3,999. Ten million users are watching it. Every eligible watcher should receive one alert.

The first answer often sounds reasonable:

> “Publish the price change to Kafka and let the notification service fan out.”

Kafka is useful here, but that sentence is only the beginning. The interesting design questions start after the event is published:

- If one partition contains that product, who processes ten million notifications?
- If the provider times out after the request may already have been accepted, do we send again?
- If two price changes arrive 800 ms apart, does one user receive one alert or two?
- If the watch table is the source of truth, does the price write lock ten million rows?

These are not syntax questions. They are questions about ownership, ordering, concurrency, delivery semantics and failure recovery.

## Separate the price write from the fan-out

The price update should be a small, fast transaction on the product’s authoritative record. It should not synchronously scan ten million watchers or create ten million provider calls while holding that transaction open.

```text
Price command
    ↓
Product transaction
    ├─ update current price
    └─ write an outbox event: PriceChanged(product, version, old, new)
             ↓
        outbox publisher
             ↓
           Kafka
             ↓
    fan-out and delivery pipeline
```

The outbox makes the database change and the fact that it should be processed durable in the same local transaction. A publisher can safely retry unsent outbox rows. Consumers must still be idempotent because the outbox publisher and Kafka provide at-least-once behavior in common designs.

The watch relationship remains separate from the product row. A price update changes one product record; it does not need to lock or rewrite ten million watcher rows.

## A partition is not the worker pool

Partitioning by `product_id` preserves ordering for one SKU, but it also concentrates a hot product in one ordered stream. One consumer cannot turn a single partition into ten million provider requests quickly enough.

There are several ways to handle that hotspot, each with a trade-off:

| Strategy | Benefit | Cost |
| --- | --- | --- |
| Keep one product partition | Simple ordering | One hot key limits parallelism |
| Bucket the fan-out task | Parallel workers process watcher ranges | Ordering is now per bucket, not globally per product |
| Create a fan-out job per page/range | Bounded work and easy retries | Requires a durable cursor and job state |
| Snapshot watchers to object storage | Stable, replayable audience | Extra storage and snapshot freshness concerns |
| Use a dedicated hot-key lane | Protects normal traffic | More routing and operational complexity |

A practical design keeps the price event small, then creates durable fan-out jobs such as `(product_id, price_version, watcher_range)`. Those jobs can be spread across partitions using a bucket key while the original price event remains ordered.

## Delivery is a state machine, not a boolean

The provider timeout is the hardest case. After a timeout, the notification may be unsent, accepted, delivered or still processing—we simply do not know.

Therefore, `send()` cannot safely mean “delivered.” Track an immutable notification identity and explicit state transitions instead:

```text
Pending → Sending → Accepted → Delivered
                    ├────────→ Failed
                    └────────→ Unknown → Reconcile / retry policy
```

Use a stable idempotency key such as:

```text
price-alert:{product_id}:{price_version}:{user_id}:{channel}
```

Persist it with a unique constraint before attempting delivery. Pass the same key to a provider that supports idempotency. If the provider does not support idempotency, an ambiguous timeout cannot be solved perfectly; the system must choose between possible duplicates and possible misses, then make that trade-off visible in the product contract.

Provider webhooks, when available, should update the notification record idempotently using the provider message ID. Retries need exponential backoff, jitter, a maximum age and a dead-letter path. Never let a retry storm compete with transactional alerts or consume the entire provider quota.

## What does “one alert” mean?

Two price ticks 800 ms apart expose an important product decision. The system needs a coalescing policy, not just a queue.

Possible policies include:

- **Every version:** one alert per observed price version. Strong history, potentially noisy.
- **Latest value:** keep only the newest price while the user is still pending. Fewer messages, but intermediate prices are intentionally skipped.
- **Debounced change:** wait for a short quiet period, then send the latest price. Good for volatile pricing, with added notification delay.
- **Threshold-based:** alert only when the price crosses a user-defined amount or percentage.

The deduplication key and database uniqueness rule must match that policy. If the rule is “one alert per product per user per price epoch,” define an epoch and persist it. Do not rely on an in-memory cache to decide whether a user has already been notified.

## Protect the provider and the rest of the system

Ten million logical notifications do not mean ten million simultaneous outbound requests. Use bounded worker concurrency, per-provider rate limits, channel-specific queues, circuit breakers and backpressure.

Separate the work by business importance:

```text
Transactional / security alerts  → reserved capacity, short SLA
Hot SKU price alerts             → large, rate-limited bulk lane
Marketing notifications          → lowest priority, easiest to pause
```

If the provider is slow, the backlog should grow in the bulk lane while login codes, payment failures and security events continue to flow. A queue is valuable only when its growth is observable and its capacity is bounded.

## The L6 answer

The strong answer is not “use Kafka.” It is:

1. Commit the price change and an outbox event without touching the watcher fan-out in the same transaction.
2. Keep the audience relationship separate from the product write path.
3. Materialize bounded, retryable fan-out jobs so a hot product can use parallelism.
4. Define whether the product promises every price version or only the latest meaningful change.
5. Use durable idempotency keys and explicit notification states for ambiguous provider outcomes.
6. Rate-limit and isolate bulk delivery so one viral SKU cannot take down critical notifications.
7. Measure oldest backlog age, fan-out lag, provider acceptance rate, ambiguous timeouts, duplicate rate, coalescing count and per-product hotspot load.

That is the difference between naming familiar infrastructure and designing a system that still behaves correctly when one product becomes the entire internet’s favorite deal.
