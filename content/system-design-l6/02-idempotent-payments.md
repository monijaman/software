---
title: "Exactly-Once Payment Processing"
summary: "Safe payment retries need a durable idempotency record, atomic state transition and provider-side deduplication."
level: Advanced
tags: [system-design, payments, idempotency, reliability]
---

## The invariant

For one customer, amount, and checkout intent: **charge at most once**. A retry returns the original outcome; it does not create another payment.

![The safe payment path: durable attempt, provider idempotency key, then recovery for an unknown result](/img/system-design-l6/payment-idempotency.svg)

## Why a naive flow fails

The provider can charge successfully while the app crashes before recording `COMPLETED`. A database transaction cannot include that network call.

| Unsafe | Safe |
| --- | --- |
| Check key → call provider → save | Atomically create/get attempt → call with same key → save |
| Retry means “try again” | Retry means “look up this attempt” |
| Concurrent requests race | A unique key permits one attempt |

## State and recovery

```text
NEW → PROCESSING → COMPLETED
                 ↘ UNKNOWN → reconcile with provider → COMPLETED / FAILED
```

Use `idempotency_key` as a unique database key and store a request hash. Reject reuse of the key with a different amount. Send the same key to the provider: your database protects your app, and the provider key protects the network failure window.

Never blindly re-charge after a timeout. Store `UNKNOWN`, query the provider, and reconcile in a worker.

## Step-by-step flow

1. The browser creates one random idempotency key for its checkout attempt.
2. The API stores `payment_attempt(key, order_id, amount, request_hash, status=NEW)` in a transaction. A unique constraint makes two clicks return the same row.
3. One worker moves it to `PROCESSING` and calls the provider with that exact key.
4. On a confirmed response it saves `COMPLETED` or `FAILED`. It also records the provider payment ID.
5. If the network times out, it stores `UNKNOWN`. A reconciler asks the provider about the same key before anyone retries.

The request hash matters: if somebody reuses `checkout-123` with a different amount, reject it. Returning the old success for a different request would be unsafe.

## Common mistakes

| Mistake | Why it breaks | Better rule |
| --- | --- | --- |
| Generate a key on every retry | Provider sees new payments | Client keeps one key per intent. |
| Delete old attempts quickly | Repeated retries lose history | Retain attempts for the retry/support window. |
| Treat timeout as failure | The charge may have happened | Use `UNKNOWN` and reconcile. |
| Send receipt before commit | Customer receives a false receipt | Publish after durable completion, usually via outbox. |

**Measure:** duplicate-key conflicts, number and age of `UNKNOWN` attempts, provider webhook lag, and mismatch count between provider and database.

**Watch:** duplicate attempts, age of `UNKNOWN` records, provider timeouts, reconciliation backlog.
