---
title: "Timeouts, Retries & Backpressure"
summary: "A slow dependency should consume a bounded budget, not create an infinite retry storm."
level: Advanced
tags: [system-design, backpressure, timeouts, retries, resilience]
---

## The problem in context

An order API calls a shipping service that normally takes 80 ms. During an incident it takes three seconds; retries occupy every worker and healthy endpoints become slow.

## What must be true

Keep the order API responsive within a 500 ms request budget and bound resources consumed by shipping work.

## Practical response

1. Allocate the end-to-end deadline across queue wait, shipping and response processing. Cancel obsolete work where supported.

2. Cap shipping concurrency and queue length independently of other dependencies. Reject excess work or return a clear pending state.

3. Retry only transient failures and safe operations, with jitter, a retry budget and one designated retry layer.

### Walk through a failure and recovery

A shipping timeout leaves the remote outcome uncertain. Do not retry a non-idempotent label purchase with a new identity. Circuit breaking reduces repeated calls, while half-open probes determine whether recovery is real.

## How to prove it worked

Under a deliberately slow shipping dependency, verify bounded in-flight requests, stable unrelated-endpoint latency, and recovery without a retry surge. Measure queue age and rejected work alongside timeout counts.

### Check your understanding

At 200 calls/s and three-second latency, how many calls accumulate without a cap?

---

## Concepts and implementation details

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

## A concrete overload plan

Imagine image processing can handle 100 jobs at once and 5,000 uploads arrive. Accepting all work in memory makes every user wait and may crash the service. Instead, keep a durable queue with a known size. Admit up to a safe rate, show new uploads as “processing,” and return a clear retry-later response once the queue is full.

Queue length alone is misleading: ten tiny jobs and ten huge jobs look equal. Track **oldest job age** and estimated drain time too. If they keep rising, workers are losing the race.

## Decide before an incident

| Work | Policy when overloaded | Reason |
| --- | --- | --- |
| Payment status lookup | Reserve capacity | It changes a customer's money state. |
| Checkout email | Delay in durable queue | It can arrive later. |
| Product recommendation | Drop temporarily | It is optional. |
| File conversion | Accept only bounded jobs | Prevents resource exhaustion. |

Retries amplify load. A service at 90% capacity can collapse if every timeout creates three more requests. Retry only errors that can succeed later, cap attempts, respect `Retry-After`, and stop retrying once the caller's deadline has passed.
