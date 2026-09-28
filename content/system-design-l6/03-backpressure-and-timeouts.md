---
title: "Timeouts, Retries & Backpressure"
summary: "A slow dependency should consume a bounded budget, not create an infinite retry storm."
level: Advanced
tags: [system-design, backpressure, timeouts, retries, resilience]
---

## The big idea

A queue is a restaurant waiting area. When it is full, taking more names creates a longer, less predictable wait; it does not create more tables.

![A bounded request path: deadline budgets, limited concurrency, a queue and explicit overload shedding](/img/system-design-l6/backpressure.svg)

## One deadline, split into budgets

If the user can wait 1,000 ms, every dependency spends part of **one** budget. Do not give every hop its own 1,000 ms timeout.

| Step | Budget | When it expires |
| --- | ---: | --- |
| Gateway/app work | 150 ms | Stop before downstream work. |
| Inventory | 250 ms | Controlled temporary failure. |
| Payment | 450 ms | Reconcile with idempotency key. |
| Safety margin | 150 ms | Return before caller gives up. |

Retry only transient, idempotent work while time and retry budget remain. Use exponential backoff with full jitter so clients do not retry together.

## Backpressure choices

- Bound concurrency for expensive work.
- Bound queues; reject or defer instead of retaining unlimited memory.
- Shed optional work before checkout.
- Route poison jobs to a visible DLQ.

**Watch:** queue age, saturation, rejected work, dependency latency, retries, and error-budget burn.
