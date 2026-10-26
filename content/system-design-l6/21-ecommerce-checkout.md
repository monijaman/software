---
title: "Design an E-Commerce Checkout"
summary: "Keep browsing scalable while protecting the correctness-critical path: inventory reservation, idempotent payment, order creation and durable events."
level: Advanced
tags: [system-design, ecommerce, checkout, inventory, payments]
---

## The problem in context

A buyer orders the last pair of shoes. Inventory reserves it, payment succeeds, and the order service crashes before showing confirmation.

## What must be true

Produce a recoverable order outcome without overselling or double charging across separate inventory and payment systems.

## Practical response

1. Create an order intent with immutable payable amount and stable request identity. Reserve stock with an authoritative conditional transition.

2. Persist workflow state and use the same payment identity on retries. Model intermediate states explicitly rather than hiding them inside a long HTTP request.

3. Confirm the order and write an outbox event locally; fulfillment and receipts consume it idempotently. Compensation handles defined failures, not every timeout.

### Walk through a failure and recovery

After an ambiguous payment response, mark payment pending and reconcile. Do not release stock or refund based only on a transport timeout. A workflow worker resumes from durable state after the API restarts.

## How to prove it worked

Crash at each state boundary and retry every command. Require one order/charge per intent and inventory conservation; monitor oldest pending order, compensation failures and reconciliation differences.

### Check your understanding

When is it safe to cancel a reservation after a payment timeout?

---

## Concepts and implementation details

![Checkout: catalog/search are read paths while inventory, payment and order transitions are owned and idempotent](/img/system-design-l6/ecommerce-checkout.svg)

Catalog, search and recommendations can be cached and eventually consistent. Checkout cannot: reserve inventory atomically, create/get a payment attempt with an idempotency key, then commit an order and publish an outbox event.

Do not hold a database transaction open across payment. Handle unknown provider outcomes through reconciliation; expire reservations; isolate checkout capacity from bulk exports and marketing traffic.

## The invariant comes first

For an order, the important promise is: stock is never oversold and a customer action never creates two successful charges. The system may show "processing" while it learns the final payment outcome; it must not guess and charge again.

## A safe checkout state machine

```text
Cart -> inventory reserved -> payment pending -> paid -> order confirmed
                              |
                              +-> unknown -> reconcile webhook/status query
                              +-> failed  -> release reservation
```

The database stores `order_id`, an inventory reservation with expiry, and a payment attempt with a stable idempotency key. A unique rule allows one active/successful payment per order. The same key is passed to the payment provider on every retry.

## Example: timeout after card charge

The provider may charge the card, then the network times out before checkout receives a response. Calling `charge()` again with a new key risks a duplicate charge. Instead store the attempt as `UNKNOWN`, return an honest `202 Processing` or equivalent state to the browser, and reconcile through signed provider webhooks or a later status query. Webhook processing must also be idempotent.

## Inventory reservation example

For the last concert ticket, an atomic conditional write creates a 10-minute reservation only if remaining available stock is positive. Payment should happen outside that short database transaction. If the reservation expires, a worker releases it only if the order has not moved to a paid state.

## What belongs on an async event

After an order commits, an outbox event can trigger receipt email, warehouse fulfillment, loyalty points and analytics. Those consumers may retry independently. They must not decide whether payment succeeded; the order/payment records remain authoritative.

Watch reservation-expiry rate, oversell rejections, payment `UNKNOWN` age, duplicate-key hits, webhook lag, successful-order rate and checkout p99. This makes correctness visible during both a normal sale and a traffic spike.
