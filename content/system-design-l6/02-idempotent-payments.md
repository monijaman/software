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

**Watch:** duplicate attempts, age of `UNKNOWN` records, provider timeouts, reconciliation backlog.
