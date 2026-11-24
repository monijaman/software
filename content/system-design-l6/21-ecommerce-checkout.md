---
title: "Design an E-Commerce Checkout"
summary: "Let browsing be fast and loose, but make the checkout path exact: hold the stock, charge once even on retries, create the order and announce it reliably."
level: Advanced
tags: [system-design, ecommerce, checkout, inventory, payments]
---

## The story in one minute

A buyer orders the **last pair** of shoes in size 42. Here is what happens:

1. Inventory **holds** the shoes for them.
2. Payment **succeeds**: the card is charged.
3. The order service **crashes** before showing "Order confirmed".
4. The buyer sees an error and clicks "Pay" again.

Now what? Do we charge them **twice**? Do we sell the shoes to someone else because the first order looks unfinished? This lesson is about a checkout that **never oversells and never double-charges**, even when things crash halfway.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Reservation** | Holding stock for one buyer for a short time. | A shop putting a jacket behind the counter for you for 10 minutes. |
| **Idempotency key** | A unique ID for "this one payment", so a retry is recognized as the same request. | A cheque number: the bank won't cash it twice. |
| **State machine** | A list of allowed steps and which step can follow which. | A parcel tracker: packed, shipped, out for delivery, delivered. |
| **Reconcile** | Ask the source of truth what really happened, and fix your records to match. | Checking your bank statement against your receipts. |
| **Outbox** | A table where you save "things to announce" in the same transaction as the change itself. | Writing a note to tell the team, in the same moment you make the change. |

## The fix in three rules

### Rule 1: Hold the stock with one exact rule

Create an **order intent** first: a record with a fixed amount to pay (it can't change later) and a stable ID.

Then reserve stock with a **conditional write**: "reduce available stock by 1 **only if** it's above 0". The database does the check and the change in one step, so two buyers can't both get the last pair.

### Rule 2: Save each step, and use the same payment key on retry

Don't hide the whole checkout inside one long web request. Save each step as a **state** in the database:

```text
Cart -> inventory reserved -> payment pending -> paid -> order confirmed
                              |
                              +-> unknown -> reconcile webhook/status query
                              +-> failed  -> release reservation
```

Every time you call the payment provider for this order, send the **same idempotency key**. If the provider already charged that key, it returns the first result instead of charging again.

### Rule 3: Confirm, then announce

When the order is confirmed, save the order **and** an **outbox event** ("order 812 confirmed") in one local transaction. Then other parts (shipping, receipt email) read that event and act. They must handle getting the same event twice.

**Compensation** (undoing an earlier step, like a refund) is for **known** failures. A timeout is not a known failure.

## Walk through a failure

The payment call **times out**. Did the card get charged? We **don't know**.

- ❌ Release the shoes and tell the buyer "payment failed". They might have been charged.
- ❌ Call `charge()` again with a **new** key. That could charge them twice.
- ✅ Mark the payment **`UNKNOWN`**. Show the buyer an honest "Processing your payment...". Then **reconcile**: wait for the provider's webhook (a message they send you when the payment settles) or ask them for the status.

And the crash in our story? Because every step is saved, a **workflow worker** (a background job that continues unfinished orders) picks up order 812 from "paid" and finishes it after the server restarts.

## How to prove it works

1. **Crash at every step** (after reserve, after charge, after confirm) and restart. Each order must end in one clear state.
2. **Retry every command** twice. You must get exactly **one order and one charge** per intent.
3. **Count the stock:** reserved + sold + available must always equal what you started with (inventory is conserved).

Watch: age of the oldest pending order, failed compensations, and differences found during reconciliation.

### Check your understanding

After a payment timeout, when is it safe to cancel the stock reservation?

<details>
<summary>Show answer</summary>

Only once you **know** the payment did not go through. That means reconciliation (a webhook or a status query to the provider) confirms it **failed** or was never made, or you have successfully **cancelled (voided)** the payment attempt with the provider. A timeout alone tells you nothing. While the payment is `UNKNOWN`, keep holding the stock (extend the reservation if needed). Releasing early risks charging someone for shoes that were sold to someone else.

</details>

---

## Going deeper

![Checkout: catalog/search are read paths while inventory, payment and order transitions are owned and idempotent](/img/system-design-l6/ecommerce-checkout.svg)

## Two very different parts of a shop

| Part | Can it be slightly stale? | Why |
| --- | --- | --- |
| Catalog, search, recommendations | Yes | A price shown 30 seconds old on a listing page is OK; it's rechecked at checkout. Cache freely. |
| Inventory, payment, order | **No** | Money and stock must be exact. |

Keep checkout capacity **separate** from heavy non-urgent work like bulk exports or marketing traffic, so a big email campaign can't slow down people paying.

## The promise comes first

The important promise (the **invariant**: something that must always be true) is:

1. Stock is **never oversold**.
2. One customer action **never creates two successful charges**.

The system may say "processing" while it finds out the payment result. It must **never guess and charge again**.

## What the database stores

- `order_id`
- An inventory **reservation** with an expiry time
- A **payment attempt** with a stable idempotency key

A **unique rule** in the database allows only one active or successful payment per order. The same key goes to the payment provider on every retry.

## Example: timeout after the card is charged

1. Checkout calls the provider: "charge $80, key `pay-812`".
2. The provider charges the card.
3. The network drops; checkout never hears back.
4. Checkout saves the attempt as `UNKNOWN` and returns `202 Processing` (an HTTP code meaning "accepted, still working on it") to the browser.
5. The provider's **signed webhook** (signed so you know it's really from them) arrives: "`pay-812` succeeded". Checkout marks the order paid.

Webhook handling must also be idempotent: the same webhook arriving twice changes nothing the second time.

## Inventory reservation: the last concert ticket

```sql
UPDATE inventory
SET available = available - 1
WHERE item_id = 'ticket-A1' AND available > 0;
-- 1 row updated  -> you got it; create a 10-minute reservation
-- 0 rows updated -> sold out
```

Two buyers click at the same moment. The database runs these one at a time: the first gets `1 row`, the second gets `0 rows`. No oversell.

Two more rules:

- **Don't keep a database transaction open while calling the payment provider.** Payment can take seconds; holding locks that long blocks everyone else. Keep the reservation transaction short, and do payment outside it.
- **When a reservation expires**, a worker releases it **only if** the order is not paid **and** payment is not `UNKNOWN`. Releasing during `UNKNOWN` risks selling stock the buyer already paid for.

## What can happen later (async events)

After the order commits, the outbox event can trigger:

- receipt email
- warehouse shipping
- loyalty points
- analytics

These can retry on their own schedule. But they **never decide** whether payment succeeded. The order and payment records are the **authority**.

## What to watch

| Metric | Why |
| --- | --- |
| Reservation expiry rate | Are buyers abandoning, or is payment too slow? |
| Oversell rejections | Should be handled, never actual oversells |
| Age of `UNKNOWN` payments | Reconciliation is stuck if this grows |
| Duplicate-key hits | Retries are happening (and being caught) |
| Webhook lag | How late provider updates arrive |
| Successful-order rate and checkout p99 | The buyer's real experience |

These make correctness visible both on a normal day and during a big sale.

## Quick recap

- 🔒 **Hold stock with one exact rule:** "minus 1 only if above 0".
- 🔑 **Same payment key on every retry:** one action, one charge.
- ❓ **Timeout means "unknown":** reconcile, don't guess.
- 💾 **Save every step:** a crash resumes, it doesn't restart.
- 📣 **Outbox for side effects:** emails and shipping follow the order, they don't decide it.
