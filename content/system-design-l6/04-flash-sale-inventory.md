---
title: "Flash Sale: 10 Million Buyers, No Oversell"
summary: "A queue smooths traffic but does not reserve stock. The durable inventory owner decides the winner atomically."
level: Advanced
tags: [system-design, flash-sale, inventory, queues, consistency]
---

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
