---
title: "Resilient Service Calls: Retries, Breakers and Load Shedding"
summary: "Keep one slow dependency from turning a small outage into a full-system outage."
level: Advanced
tags: [system-design, resilience, retries, circuit-breaker, bulkhead, load-shedding]
---

> **How to read this lesson:** STAR means **Situation → Task → Action → Result**. The scenario and targets below are worked design assumptions, not claims of measured production results.

## S — Situation: the problem in context

An API has three retrying layers. Each layer permits three total attempts, and a failing downstream request can trigger up to 27 attempts.

## T — Task: requirements and success criteria

Contain dependency failure with bounded time, concurrency and retry amplification.

## A — Action: design the normal path

1. Carry one deadline through the call chain and retry at one responsible layer using a shared attempt budget.

2. Require idempotency before retrying writes; apply exponential backoff with jitter for appropriate transient failures.

3. Use bulkheads to isolate resources, circuit breakers to reduce repeated failing calls and load shedding before queues exceed useful deadlines.

### Walk through a failure and recovery

The downstream service recovers and every client retries together. Jitter, limited half-open probes and bounded concurrency prevent a synchronized recovery surge. A breaker without admission control still leaves queues vulnerable.

## R — Result: how to validate the design

Test partial failure and recovery under peak load. Measure attempts per original request, queue age, successful throughput and unrelated-endpoint latency; a low downstream call count with universal rejection is not success.

### Check your understanding

What is the maximum amplification if four layers each make three attempts?

---

## Concepts and implementation details

## The restaurant kitchen example

If the dessert station is slow, the restaurant should not let every waiter stand in its doorway. Give dessert a small waiting area, serve main meals, and temporarily stop accepting new dessert orders if necessary.

Services need the same boundaries.

## A practical payment dependency

```text
Checkout -> payment provider is slow
         -> wait only until the request deadline
         -> retry only a safe, idempotent operation
         -> return "payment processing" if outcome is unknown
         -> reconcile a later webhook with the same payment key
```

| Pattern | What it does | Example |
| --- | --- | --- |
| Timeout | Stops waiting | Payment gets 350 ms, not forever. |
| Retry + jitter | Retries a temporary failure without a synchronized storm | Retry a safe inventory read after 50-150 ms. |
| Circuit breaker | Stops calls to a known-bad dependency briefly | Open after repeated provider failures; probe later. |
| Bulkhead | Reserves separate capacity | Email traffic cannot consume payment worker threads. |
| Load shedding | Rejects low-value work early | Disable recommendations during a flash sale. |
| Queue + backpressure | Smooths bounded async work | Delay receipts, but never store infinite jobs in memory. |

## The retry rule

Retrying a non-idempotent `charge card` request with a new key can charge twice. Use one durable idempotency key per user action, such as `pay:order-981:attempt-1`, and reuse it for every retry. If the provider times out, the result may be **unknown**, not failed. Reconcile it instead of blindly charging again.

## What to watch

Watch timeout rate, retry count, circuit state, queue age, rejected requests, dependency latency and recovery time. A retry that looks successful in one service can still be the traffic spike that crashes the next service.

## Apply the patterns in the right order

First propagate one end-to-end deadline. Give each dependency a smaller budget. Bound concurrency so a slow email provider cannot occupy every request worker. Then decide whether the work can be retried safely: a payment create needs an idempotency key; a GET may be retried with backoff and jitter; an invalid request should never retry.

When failure is sustained, a circuit breaker stops futile calls for a short window and permits limited probes later. Return a useful degraded result only when it is honest: cached product details may be okay; a payment result must be “processing/unknown” until reconciled.

## Example dependency policy

| Dependency | Timeout | Retry | Fallback |
| --- | --- | --- | --- |
| Product image | Short | Usually no | Placeholder |
| Inventory read | Short | Bounded | Temporarily unavailable |
| Payment create | Strict | Same idempotency key | `UNKNOWN`, reconcile |
| Receipt email | Async | Durable worker | Deliver later |

Patterns work together. A breaker without bounded queues still lets backlog grow; retries without idempotency still duplicate effects.
