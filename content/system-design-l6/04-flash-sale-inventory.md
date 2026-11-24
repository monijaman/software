---
title: "Flash Sale: 10 Million Buyers, No Oversell"
summary: "A waiting line calms the crowd, but it doesn't hold any stock. Only the real inventory database decides, in one all-or-nothing step, who gets each item."
level: Advanced
tags: [system-design, flash-sale, inventory, queues, consistency]
---

## The story in one minute

A store has **1,000** discounted phones. **Ten million** people want one. The "phones left" counter on the page comes from a cache (a fast copy that can be a little out of date).

Here is what goes wrong in a naive design:

1. The counter says "1 left". Thousands of buyers click "Buy" at the same moment.
2. Each request **reads** the stock: "1 left, great!"
3. Each request then **writes**: "now 0 left, this phone is yours."
4. Hundreds of people get a confirmation for **one** phone.

That's an **oversell**: promising more items than you have. Then someone has to email hundreds of angry customers. This lesson shows how to make it impossible.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Oversell** | Promising more items than exist. | An airline selling 210 tickets for 200 seats. |
| **Reservation** | A short hold on one item while the buyer pays. | A shop clerk putting a jacket behind the counter for 10 minutes. |
| **Atomic** | All-or-nothing, in one step. Nobody can sneak in halfway. | Swapping a ticket for cash in one handover, not "you pay, I'll get the ticket later". |
| **Waiting room** | A line that lets only some people in at a time. | A bouncer letting 50 people into the club at a time. |
| **Source of truth** | The one place whose answer counts. | The airline's booking system, not the seat map printed in a magazine. |

## The fix in three rules

### Rule 1: The waiting room controls the crowd, not the stock

Use **rate limits** (a cap on requests per user or per second) and a **waiting room** with a fixed size. This stops 10 million requests from hitting the database at once.

But being let in only means "**you may try**". It does **not** mean "you have a phone". The bouncer doesn't hand out phones.

### Rule 2: Take the item in one atomic step

❌ **Wrong:** read the count, check it's above zero, then write the new count. Between your read and your write, someone else can do the same.

✅ **Right:** ask the database to do it in **one** step: "take one, **only if** there's at least one left."

```sql
UPDATE inventory SET available = available - 1
WHERE sku = :sku AND available > 0;
```

If this changes **1 row**, you got one. If it changes **0 rows**, it's sold out. The database makes sure two buyers can't both take the last one.

In the **same transaction** (all-or-nothing group of changes), also insert the reservation row with a stable ID for this purchase.

### Rule 3: Return stock carefully, by checking its state

Reservations expire if the buyer doesn't pay in time. But:

❌ **Wrong:** a timer that just runs `available = available + 1`. If it fires late, it may return a phone that someone **already paid for**.

✅ **Right:** return stock only if **this exact reservation** is still in the "reserved, unpaid" state. Check and change it in one step:

```sql
-- in one transaction
UPDATE reservations SET status = 'EXPIRED'
WHERE id = :reservation_id AND status = 'RESERVED' AND expires_at < now();

-- only if the update above changed 1 row:
UPDATE inventory SET available = available + 1 WHERE sku = :sku;
```

## Walk through a failure

A buyer's payment **times out** just before their 10-minute hold ends. Did they pay? We don't know.

- ❌ If the expiry job returns the phone to stock, another buyer gets it. Now the first buyer may have **paid with no phone**.
- ✅ When payment starts, move the reservation to `PAYMENT_PENDING`. The expiry job **skips** that state. A **reconciler** (a background checker) asks the payment company what happened. Paid? Mark it `SOLD`. Not paid? Now it's safe to expire and return the phone.

## How to prove it works

In a test environment:

1. **Race:** 10,000 buyers try to buy the **last** unit at once. Exactly **one** wins.
2. **Repeat:** send the same purchase request several times. Still only **one** reservation.
3. **Crash:** kill the payment worker before and after it charges. No phone is lost, none is sold twice.
4. **Report:** how long people waited, how many were rejected, and how old the oldest unresolved payment is.

Success means **zero oversells**, not just "a low error rate".

### Check your understanding

Why can't a Redis queue (a fast in-memory waiting line) **by itself** prevent overselling?

<details>
<summary>Show answer</summary>

Because a queue only decides the **order** in which requests are handled. It doesn't hold or count any phones.

- Workers pull from the queue **in parallel**, so many can still run "read stock, then write" at the same time and race.
- Queues often deliver a message **more than once** (after a worker crash), which can create duplicate reservations unless each purchase has a stable ID.
- The queue doesn't know about expiry, failed payments, or refunds. Stock can drift away from reality.

Something still has to do "take one **only if** one is left" atomically, at the durable source of truth. The queue just keeps the crowd calm while it does.

</details>

---

## Going deeper

## The promise

Never sell more units than exist. Put precisely:

**confirmed sales + active reservations ≤ total stock**

The winner is **not** the request that arrived first. It's the request whose **atomic reservation** commits first in the database.

![Flash-sale states: queueing controls traffic while the inventory owner atomically reserves the unit](/img/system-design-l6/flash-sale.svg)

## The states a purchase moves through

| State | Meaning | Is stock held? |
| --- | --- | --- |
| Queued | Let in to try. | No |
| Reserved | One unit held for this buyer for a short time. | Yes |
| Payment pending | Payment started, result not known yet. | Yes |
| Sold | Payment and order saved. | Yes |
| Expired | Hold timed out, unit returned. | No |

## A note on Redis

You can use a Redis Lua script (a small program that runs inside Redis as one uninterrupted step) to quickly turn away buyers once a hot item is clearly sold out. That's a good **filter**. But Redis keeps data in memory and can lose recent writes in a crash. So strict "no oversell" still needs the **durable** database to make the final call, plus reconciliation to catch any drift.

## End-to-end example

For the last concert ticket:

1. The client sends `purchase_key=abc` (one stable ID for this purchase, reused on retries).
2. The inventory service runs **one transaction**:
   - reduce `available` only if it's above zero,
   - insert `reservation(abc, expires_at)`,
   - write an **outbox** event (a "tell other services later" note saved in the same step).
3. Only **after** that commits does the user see "Reserved for 10 minutes."
4. Payment uses the **same** purchase key, so a retry can't charge twice.
5. On payment success, the reservation becomes `SOLD`.
6. On expiry, **one** guarded job returns the stock, but only if the reservation is still `RESERVED`.

Never make expiry a blind `available = available + 1`. Always update **by reservation ID and expected state**.

## Who does what

A **hot key** is one item that gets a huge share of all traffic. Here's how each layer helps without pretending to be the truth:

| Layer | Job |
| --- | --- |
| CDN, rate limit, waiting room | Blocks bots and smooths the rush at the door. (A CDN is a network of servers near users that serves copies of pages.) |
| Cache | Serves the product page and the "sold out" banner. |
| Queue | Feeds allowed attempts in at a steady speed. Holds **no** stock. |
| Durable inventory database | Decides each reservation atomically. |
| Reconciler | Finds expired holds and unclear payments and fixes them. |

Also keep sale traffic **separate** from browsing and recommendations, so the sale can't slow down the rest of the store.

## A quick sense of scale

10 million people, 1,000 phones. That means **9,999,000** people will hear "no". Your design should tell them **quickly and honestly** ("sold out" or "you're #48,213 in line"), instead of letting them hammer refresh. Turning people away well is half the job.

## Quick recap

- 🚪 **Waiting room ≠ stock:** it controls the crowd, it doesn't hand out items.
- ⚛️ **One atomic step:** "take one only if one is left", at the durable database.
- 🔑 **Stable purchase ID:** retries and duplicates map to the same reservation.
- ⏳ **Guarded expiry:** return stock only if this reservation is still unpaid; never blind `+1`.
- ✅ **Prove it:** race for the last unit, repeat requests, crash workers. Zero oversells.
