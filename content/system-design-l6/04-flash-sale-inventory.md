---
title: "Flash Sale: 10 Million Buyers, No Oversell"
summary: "A queue smooths traffic but does not reserve stock. The durable inventory owner decides the winner atomically."
level: Advanced
tags: [system-design, flash-sale, inventory, queues, consistency]
---

## The problem in context

A store has 1,000 discounted phones and ten million interested buyers. The visible stock counter is cached and thousands of buyers try to purchase the last phone.

## What must be true

Never let confirmed sales plus active reservations exceed available inventory. Give rejected or waiting buyers an honest status.

## Practical response

1. Protect the entry point with rate limits and a bounded waiting room. Admission controls pressure but grants no inventory ownership.

2. Create a reservation using a conditional stock update and reservation row in one transaction. Give each intent a stable identity.

3. Move the reservation through payment-pending and confirmed states. Release abandoned reservations with a checked state transition, not an unconditional timer.

### Walk through a failure and recovery

A payment times out just before reservation expiry. The expiry worker must coordinate with the payment state and reconcile an ambiguous charge. Blindly returning this unit to stock can create a paid customer with no phone.

## How to prove it worked

Race many buyers for one unit, repeat reservation requests, and crash the payment worker. Require zero oversell and no duplicate reservations; report waiting time, rejection rate and unresolved-payment age.

### Check your understanding

Why does a Redis queue by itself fail to prevent overselling?

---

## Concepts and implementation details

## The invariant

Never sell more units than exist. The winner is not the first request to arrive: it is the request whose **atomic reservation** commits first.

![Flash-sale states: queueing controls traffic while the inventory owner atomically reserves the unit](/img/system-design-l6/flash-sale.svg)

| State | Meaning | Is stock held? |
| --- | --- | --- |
| Queued | Accepted to try. | No |
| Reserved | Unit temporarily held. | Yes |
| Sold | Payment/order committed. | Yes |
| Expired | Timed-out reservation returned. | No |

## Safe reservation

At the inventory authority, decrement only when stock is positive and create an expiring reservation. A Redis Lua script can gate a hot key, but strict no-oversell still needs a durable owner and reconciliation.

```sql
UPDATE inventory SET available = available - 1
WHERE sku = :sku AND available > 0;
```

Zero rows means sold out. Never separately “check available” then decrement: concurrent requests race.

Give every purchase an idempotency key, reconcile reservations/orders/payments, and isolate sale traffic from browsing and recommendations.

## End-to-end example

For the last concert ticket, the client submits `purchase_key=abc`. The inventory service performs one database transaction: conditionally reduce `available`, insert `reservation(abc, expires_at)`, and write an outbox event. Only after that commit does the user see “reserved for 10 minutes.” Payment uses the same purchase key. On success, reservation becomes `SOLD`; on expiry, a single guarded job returns stock only if it is still reserved.

Never make expiry a blind `available = available + 1`: a late expiry job could return a ticket already paid for. Update by reservation ID and expected state.

## Hot-key protection without lying about truth

| Layer | Job |
| --- | --- |
| CDN/rate limit/waiting room | Reduces bots and admission spikes. |
| Cache | Serves product pages and sold-out banner. |
| Queue | Smooths eligible attempts; does not hold stock. |
| Durable inventory owner | Atomically decides reservation. |
| Reconciler | Finds expired/unknown payment states. |

Test with concurrent buyers, duplicate requests, worker crashes before/after payment, and an expiry race. Success means zero oversells, not merely a low error rate.
