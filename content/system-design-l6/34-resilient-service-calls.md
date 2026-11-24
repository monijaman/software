---
title: "Resilient Service Calls: Retries, Breakers and Load Shedding"
summary: "When one service you call gets sick, keep it from dragging your whole system down with it."
level: Advanced
tags: [system-design, resilience, retries, circuit-breaker, bulkhead, load-shedding]
---

## The story in one minute

A user taps **Buy**. The request goes through three layers: the **mobile app**, then the **API gateway**, then the **checkout service**, which calls the **payment service**.

Each layer has the same "helpful" rule: *if it fails, try up to 3 times in total.*

One day the payment service starts failing. Here is what happens:

1. Checkout calls payment. It fails, so checkout tries **3** times.
2. The gateway sees checkout fail, so it tries checkout **3** times. Each of those makes 3 payment calls: **3 × 3 = 9**.
3. The app sees the gateway fail, so it tries **3** times too: **3 × 3 × 3 = 27** calls to payment.
4. One tap became **27** calls, all landing on a service that was already struggling.

Payment had a small problem. The retries turned it into a big one. This lesson is about stopping that.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Idempotent** | Doing it twice has the same effect as doing it once. | Pressing a lift button again doesn't call two lifts. |
| **Jitter** | A small random wait added before a retry. | Not everyone leaving a stadium through the same gate at the same second. |
| **Circuit breaker** | Stops calling a broken service for a short while, then tests it gently. | A fuse in your house that trips, then gets reset. |
| **Bulkhead** | A separate, limited pool of workers for each service you call. | Watertight rooms in a ship: one floods, the others stay dry. |
| **Load shedding** | Saying "no" to less important work early, on purpose. | A shop closing the gift-wrap desk on the busiest day. |

## The fix in three rules

### Rule 1: One deadline, and retry in one place only

The user waits, say, **1 second** in total. Pass that one deadline down through every call, so each layer knows how much time is left.

❌ **Wrong:** every layer retries 3 times. Retries multiply: 3 × 3 × 3 = 27.

✅ **Right:** pick **one** layer to own retries (usually the one closest to the failing service). The other layers pass the error up. Use a shared **retry budget** too, for example "retries may be at most 10% of normal traffic".

### Rule 2: Only retry what is safe to repeat

Retry only when:

- the error is temporary (a timeout or "busy"), not "card declined" or "bad input",
- the action is **idempotent**, or carries an **idempotency key** (a request ID the other side uses to spot repeats),
- there is still time left in the deadline.

When you retry, wait a bit longer each time (**exponential backoff**: 100 ms, then 200 ms, then 400 ms) and add **jitter** so clients don't all retry at the same instant.

### Rule 3: Put walls around each dependency

- **Bulkheads:** give each service you call its own limited pool. Slow email calls can then never use up the workers that payment needs.
- **Circuit breaker:** after many failures in a row, stop calling for a short time instead of wasting effort.
- **Load shedding:** when queues get so long that the work would finish *after* the user gave up, reject it early instead.

## Walk through a failure

The payment service was down for 2 minutes. Now it comes back. Every client that was waiting retries **at the same moment**. That wave of traffic knocks payment over again.

What stops this:

- ✅ **Jitter** spreads the retries out over time.
- ✅ The circuit breaker lets only **a few test calls** through at first (this is the *half-open* state). If they succeed, traffic returns slowly.
- ✅ **Bounded concurrency** (a cap on how many calls run at once) means even a burst can't pile up without limit.

⚠️ A circuit breaker alone is not enough. If you don't also cap how much work you *accept*, requests still pile up in your own queues.

## How to prove it works

Make one dependency fail on purpose, at peak load, then let it recover. Check:

1. **Attempts per original request:** close to 1, never 27.
2. **Queue age** (how long the oldest waiting request has waited) stays bounded.
3. **Successful requests per second** stays as high as possible.
4. **Other pages** that don't use the broken service stay fast.

⚠️ "We made very few calls to payment" is not success if it's because you rejected **everyone**. Look at how many users actually succeeded.

### Check your understanding

Four layers each make up to 3 attempts. In the worst case, how many calls reach the bottom service for one user action?

<details>
<summary>Show answer</summary>

**3 × 3 × 3 × 3 = 81 calls.** Retries multiply at every layer, they don't add. That's why only one layer should retry, with a limited budget.

</details>

---

## Going deeper

## The restaurant kitchen

If the dessert station is slow, the restaurant should not let every waiter stand at its door waiting. Instead it gives dessert a small waiting area, keeps serving main meals, and if needed stops taking new dessert orders for a while.

Services need the same kind of walls.

## A slow payment provider, step by step

Here is what checkout should do when the payment provider is slow:

```text
Checkout -> payment provider is slow
         -> wait only until the request deadline
         -> retry only a safe, idempotent operation
         -> return "payment processing" if outcome is unknown
         -> reconcile a later webhook with the same payment key
```

(*Reconcile* means: check later what really happened and fix our records to match. A *webhook* is a message the provider sends us when the result is ready.)

## The toolbox at a glance

| Pattern | What it does | Example |
| --- | --- | --- |
| Timeout | Stops waiting | Payment gets 350 ms, not forever. |
| Retry + jitter | Tries again after a temporary failure, without everyone retrying at once | Retry a safe inventory read after a random 50-150 ms. |
| Circuit breaker | Stops calls to a known-broken service for a short time | Open after repeated provider failures; send a test call later. |
| Bulkhead | Keeps separate capacity for each dependency | Email traffic can't use payment's worker threads. |
| Load shedding | Rejects low-value work early | Turn off recommendations during a flash sale. |
| Queue + backpressure | Smooths out work that can wait, with a size limit | Send receipts later, but never keep endless jobs in memory. |

## How a circuit breaker behaves

Think of it as a switch with three positions:

| State | What happens | When it changes |
| --- | --- | --- |
| **Closed** (normal) | Calls go through. | Too many failures, so it **opens**. |
| **Open** | Calls fail fast, without even trying. | After a short wait (e.g. 30 s), it goes **half-open**. |
| **Half-open** | Only a few test calls go through. | Tests succeed, so **closed**. Tests fail, so **open** again. |

## The retry rule for money

Say "charge card" times out. If you retry with a **new** request ID, the provider sees a brand-new charge, and the customer may pay **twice**.

✅ Make **one** idempotency key per user action, save it, and reuse it on every retry. For example `pay:order-981`. Every retry of that order's payment sends the same key, so the provider charges at most once.

Also remember: a timeout means the result is **unknown**, not **failed**. The charge may have gone through and only the answer got lost. Don't charge again. Mark it "processing" and reconcile later.

## Apply the patterns in the right order

1. **Pass one end-to-end deadline** through every call.
2. **Give each dependency a smaller slice** of that deadline.
3. **Cap concurrency** per dependency, so a slow email provider can't take every request worker.
4. **Decide if retrying is safe:**
   - creating a payment needs an idempotency key,
   - a read (`GET`) can be retried with backoff and jitter,
   - an invalid request should **never** be retried.
5. **Add a circuit breaker** for failures that last: stop pointless calls for a short window, then test with a few calls.
6. **Return a fallback only if it's honest.** Showing cached product details is fine. Showing "payment succeeded" when you don't know is not: it must say "processing" until reconciled.

## Example policy, one row per dependency

| Dependency | Timeout | Retry | Fallback |
| --- | --- | --- | --- |
| Product image | Short | Usually no | Placeholder image |
| Inventory read | Short | A limited number of times | "Temporarily unavailable" |
| Payment create | Strict | Same idempotency key | `UNKNOWN`, reconcile later |
| Receipt email | Done in the background | Durable worker retries | Deliver later |

These patterns only work **together**. A breaker without limited queues still lets a backlog grow. Retries without idempotency still cause double charges.

## What to watch

- Timeout rate and retry count
- Circuit breaker state (closed, open, half-open)
- Queue age and number of rejected requests
- How slow each dependency is, and how long recovery takes

A retry that "succeeds" in one service can still be the traffic spike that crashes the next one down the line.

## Quick recap

- 🔁 **Retry in one place**, with a budget. Retries multiply across layers (3 layers × 3 tries = 27).
- 🔑 **Only retry safe actions**, and reuse the same idempotency key for money.
- 🧱 **Bulkheads** keep one slow dependency from eating every worker.
- 🔌 **Circuit breakers** stop pointless calls, then test gently with a few calls.
- ✂️ **Shed load early** when the answer would arrive after the user gave up.
