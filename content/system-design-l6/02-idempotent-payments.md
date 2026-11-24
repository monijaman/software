---
title: "Payment Retries: Prevent Duplicate Charges"
summary: "When a payment request is retried, the customer must never be charged twice. Save the attempt first, reuse one ID for every retry, and look up unclear results instead of guessing."
level: Advanced
tags: [system-design, payments, idempotency, reliability]
---

## The story in one minute

A customer pays **৳2,000** for an order. Here is what goes wrong:

1. The app asks the payment company to charge the card.
2. The payment company **charges it successfully**.
3. Right then, the customer's mobile connection drops. The "success" reply never arrives.
4. The browser thinks it failed and **sends the payment again**.
5. The payment company sees what looks like a brand-new payment and charges **another ৳2,000**.

The customer paid twice for one order. This lesson is about making step 5 impossible.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Idempotent** | Doing it twice has the same effect as doing it once. | Pressing a lift button 5 times still calls one lift. |
| **Idempotency key** | A unique ID for one attempt, sent again on every retry so the receiver knows "this is the same one". | A cheque number: the bank won't cash cheque #1042 twice. |
| **Payment intent / attempt** | Our saved record of "we are trying to charge this order this amount". | The order slip a waiter writes before going to the kitchen. |
| **Reconcile** | Compare our records with the payment company's and fix mismatches. | Matching your bank statement against your receipts. |
| **Outbox** | A table where we save "messages to send later" in the same step as the main change. | A sticky note "email the receipt" stuck on the finished order. |

One honest point first: "charged **exactly once**" is a **business goal**. A single web request can't promise it, because the network can always lose a reply. We reach the goal by combining the rules below.

## The fix in four rules

### Rule 1: Save the attempt before you call anyone

Before talking to the payment company, save a row with: a unique key, the order, the amount, the currency, and a **request hash** (a short fingerprint of the request's details).

- If the same key comes back with the **same** details, it's a retry. Return the saved result.
- If the same key comes back with **different** details (say ৳5,000 instead of ৳2,000), **reject it**. Returning the old "success" for a different request would be wrong.

### Rule 2: One key per attempt, reused on every retry

❌ **Wrong:** make a new key each time you retry. The payment company sees a new payment every time.

✅ **Right:** create one key when the customer starts paying, and send **that same key** on every retry, to our server **and** to the payment company.

Two layers of protection:

- **Our database's unique key** stops our own app from starting two attempts.
- **The payment company's idempotency key** protects the risky moment where the charge happened but we never heard back.

### Rule 3: Protect the order, not just the key

A key only matches **itself**. If the customer opens **two browser tabs**, each tab may make its own key. Two different keys look like two different payments.

So also make the **order** itself enforce "only one payment in progress". (See the answer below for how.)

### Rule 4: Timeout means "unknown", not "failed"

❌ **Wrong:** the call timed out, so mark it failed and charge again.

✅ **Right:** mark it `UNKNOWN`. A background worker asks the payment company "what happened to this key?" and records the real answer.

## Walk through a failure

A worker charges the card, then **crashes** before saving "success".

1. A replacement worker picks up the same attempt (it's still saved in our database).
2. It asks the payment company about the **existing** attempt key.
3. The payment company says "already charged, here's the payment ID". We save `COMPLETED`. No second charge.

What if the payment company **can't** look up or de-duplicate by key? Then you **cannot** promise "at most once" on your own. Hold those unclear attempts for **reconciliation** (a person or job checks them) instead of retrying.

## How to prove it works

1. **Duplicate test:** send the same request 10 times at once. Exactly **one** charge reaches the payment company.
2. **Crash test:** kill the worker right after the charge and before saving. Still exactly **one** charge.
3. **Two-tabs test:** pay for the same order from two tabs with different keys. Only **one** proceeds.
4. **Watch the unknowns:** track how many `UNKNOWN` attempts exist and **how old** the oldest one is. Regularly compare our totals with the payment company's totals.

Fast API responses prove **nothing** about charge safety. Only these tests do.

### Check your understanding

What stops two browser tabs from creating two different payment keys for the **same order** and getting charged twice?

<details>
<summary>Show answer</summary>

The idempotency key alone can't, because each tab may have its own key. You need a rule on the **order** itself, in the database:

- Move the order from `AWAITING_PAYMENT` to `PAYMENT_IN_PROGRESS` with a **conditional update** ("only if it is still awaiting payment"). Only one tab's update succeeds; the other gets "already being paid" and is shown the first attempt.
- Or add a **unique rule**: at most one active payment attempt per `order_id`.
- It also helps to base the payment company's key on the order (for example, the order ID plus attempt number) so both tabs map to the same charge.

The key protects **retries of one attempt**. The order's state protects **the order**.

</details>

---

## Going deeper

## The promise

For one customer, one amount and one checkout: **charge at most once**. A retry gives back the **original** result. It never creates another payment.

![The safe payment path: durable attempt, provider idempotency key, then recovery for an unknown result](/img/system-design-l6/payment-idempotency.svg)

## Why the simple way fails

The simple way is: check the key, call the payment company, save the result. The problem: the charge can succeed and then our app crashes **before** saving. A database transaction (an all-or-nothing group of changes) **cannot include** a call over the network to another company. So there's always a gap.

| ❌ Unsafe | ✅ Safe |
| --- | --- |
| Check key, then call the provider, then save. | Create (or fetch) the attempt in one step, call with the same key, then save. |
| Retry means "try again". | Retry means "look up this attempt". |
| Two requests at the same time can both pass the check. | A unique key lets only one attempt exist. |

## The states an attempt goes through

```text
NEW → PROCESSING → COMPLETED
                 → FAILED
                 → UNKNOWN → reconcile with provider → COMPLETED / FAILED
```

In plain words: a new attempt starts as `NEW`. A worker moves it to `PROCESSING` and calls the payment company. A clear answer gives `COMPLETED` or `FAILED`. A timeout or lost reply gives `UNKNOWN`, which a background job later resolves by asking the payment company.

Use `idempotency_key` as a **unique** column in the database and store the request hash next to it. Send the **same** key to the payment company. Your database protects your app; the provider's key protects the network gap.

## Step by step

1. The browser creates **one random key** when the customer starts this checkout attempt.
2. The API saves `payment_attempt(key, order_id, amount, request_hash, status=NEW)` in a transaction. The unique rule on `key` means two clicks get back the **same row**, not two rows.
3. One worker moves it to `PROCESSING` and calls the payment company with that exact key.
4. On a clear answer, it saves `COMPLETED` or `FAILED`, plus the payment company's payment ID.
5. On a timeout, it saves `UNKNOWN`. A **reconciler** (a background checker) asks the payment company about that same key **before** anyone retries.

Example of the request-hash check: someone reuses key `checkout-123`, first for ৳2,000, then for ৳5,000. The hashes don't match, so the second request is **rejected**.

## Common mistakes

| Mistake | Why it breaks | Better rule |
| --- | --- | --- |
| A new key on every retry | The provider sees each retry as a new payment. | The client keeps **one key per attempt**. |
| Deleting old attempts too soon | A late retry finds no history and starts fresh. | Keep attempts for the whole retry and support window. |
| Treating a timeout as failure | The charge may have gone through. | Use `UNKNOWN` and reconcile. |
| Sending the receipt before saving | The customer gets a receipt for a payment we didn't record. | Send it **after** saving `COMPLETED`, usually via the outbox. |

## What to watch on your dashboard

- **Duplicate-key hits:** how often retries arrive (normal, but a spike means trouble upstream).
- **Number and age of `UNKNOWN` attempts:** old unknowns are customers waiting for an answer.
- **Provider timeouts** and **webhook lag** (a *webhook* is the payment company calling us back to report a result; lag is how late those calls arrive).
- **Reconciliation backlog** and **mismatch count** between our records and the provider's.

## Quick recap

- 💾 **Save first:** record the attempt (key, order, amount, hash) before calling the provider.
- 🔑 **One key, every retry:** same key to our database and to the provider.
- 🧾 **Guard the order too:** two tabs with two keys are stopped by the order's own state.
- ❓ **Timeout = unknown:** look it up and reconcile, never blindly re-charge.
- 📬 **Receipt last:** send it only after success is saved, through the outbox.
