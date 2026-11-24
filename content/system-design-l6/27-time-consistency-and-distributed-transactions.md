---
title: "Time, Consistency and Distributed Transactions"
summary: "Computer clocks disagree and workers pause, so don't trust timestamps to decide who wins. Use version numbers, fencing tokens and step-by-step workflows (sagas) instead."
level: Advanced
tags: [system-design, clocks, lamport, vector-clocks, locks, saga, crdt]
---

## The story in one minute

You have servers in **two regions** (say, Europe and the US). Both can update the same bank account. A background **worker** also processes orders, and it holds a **lock with a time limit** (a **lease**: "this job is yours for 30 seconds").

Here is what goes wrong, step by step:

1. The Europe server's clock is **2 seconds fast**. The US server's clock is correct.
2. Both save a change to the same account at nearly the same moment. The system keeps "the one with the latest timestamp." Europe's change wins just because its clock is wrong. The US change is **silently lost**.
3. Meanwhile, Worker A takes the lease on order 55, then **freezes** for 40 seconds (a long garbage-collection pause, a slow disk, anything).
4. Its 30-second lease expires. Worker B takes over order 55 and finishes it.
5. Worker A wakes up. It doesn't know it was paused. It still thinks it owns order 55 and **writes old results on top of B's work**.

Clocks lie and processes pause. This lesson is about deciding "who's in charge" and "what happened first" **without** trusting the clock.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Clock skew** | Two computers' clocks show different times. | Your watch and your phone disagree by 2 minutes. |
| **Lease** | A lock that expires on its own after a set time. | A library book you must return in 2 weeks. |
| **Fencing token** | A number that goes up each time ownership changes; the old owner's lower number gets rejected. | A deli ticket: the counter serves #42, so #41 coming back late is refused. |
| **Saga** | A big job split into steps, each with an "undo" step if a later step fails. | Booking a trip: flight, hotel, car; if the car fails, cancel the hotel and flight. |
| **CRDT** | Data designed so copies edited separately can always be merged automatically. | A shared shopping list where items are only added; merging two lists is easy. |

## The fix in three rules

### Rule 1: Use the right kind of "time" for each job

- Measuring **how long** something took on one machine? Use a **monotonic clock**. It only counts forward and never jumps when the wall clock is corrected. (The wall clock can jump back an hour, or a few seconds after a time sync.)
- Deciding **what happened first** across machines? Use **version numbers** or **logical clocks** (counters, explained below), not wall-clock timestamps.

❌ **Wrong:** "keep whichever update has the latest timestamp."

✅ **Right:** "update account 9 **only if** it's still at version 41" (and bump it to 42). If someone else got there first, you're told, and you re-read and decide.

### Rule 2: Make the storage reject the old owner

Every time the lease is handed out, the lock service gives a **bigger number**: Worker A gets token **33**, Worker B gets token **34**.

Each write carries its token. The **database or storage itself** remembers the highest token it has seen and rejects anything lower.

❌ **Wrong:** Worker A checks "is my lease still valid?" before writing. It could pause right **after** that check.

✅ **Right:** the storage says "I've already seen 34, your 33 is rejected." The check happens at the place where damage would happen.

### Rule 3: Split cross-service jobs into steps with undo actions

An order touches inventory, payments and shipping, which are separate services with separate databases. You can't wrap them in one transaction.

Use a **saga**: do each step as its own local save, record progress durably, and define an **undo** (a **compensation**) for each step in case a later one fails.

**CRDTs** help when data can merge naturally (likes, shopping carts, shared text). They do **not** make money transfers safe: you can't "merge" two withdrawals that together overdraw an account.

## Walk through a failure

Worker A (token 33) wakes up and tries to write order 55's result.

- ❌ Worker A checks its own lease timer: it might be confused by the pause. Even if it checks, it could pause again right after.
- ❌ Compare timestamps: clocks may disagree.
- ✅ The orders table already stored token **34** from Worker B. It rejects A's write with token 33. Worker A logs "lost ownership" and stops.

## How to prove it works

1. **Inject clock skew:** set one test server's clock 5 seconds fast. Ordering decisions must not change.
2. **Inject pauses:** freeze a worker longer than its lease, then let it resume. It must not overwrite the new owner's work.
3. **Duplicate saga messages:** send "payment succeeded" twice. The order must move forward once.
4. **Watch:** how old the oldest unfinished saga is, and how many undo steps failed.

### Check your understanding

Account balance is **$100**. Two withdrawals of **$80** happen at the same moment on two servers. The system uses "latest timestamp wins." What happens?

<details>
<summary>Show answer</summary>

Each server reads $100, sees enough money, and writes **$20**. "Latest timestamp wins" just picks one of the two $20 writes and throws away the other. The final balance shows **$20**, but **$160** was handed out. The bank lost $80.

Picking a winner afterwards can't fix this. Both withdrawals were allowed based on the same old balance. You need **one place that decides**, one at a time:

```sql
UPDATE accounts
SET balance = balance - 80
WHERE id = 9 AND balance >= 80;
```

The first update succeeds ($100 to $20). The second finds `balance >= 80` is false and changes nothing, so it's refused.

</details>

---

## Going deeper

![Distributed correctness: clocks order observations, fencing protects ownership, and sagas compensate cross-service work](/img/system-design-l6/time-transactions.svg)

## Why clocks can't be trusted

Every computer's clock **drifts** (runs a little fast or slow). Time sync fixes it now and then, which can make the clock **jump**. Two servers can easily disagree by milliseconds, sometimes by seconds.

So a timestamp tells you roughly when *this machine thought* something happened. It does **not** prove that event A **caused** or **came before** event B on a different machine.

## Logical clocks: counting instead of telling time

**Lamport clock:** each server keeps a counter.

1. Before each event, add 1.
2. Attach the counter to every message you send.
3. When you receive a message, set your counter to `max(yours, theirs) + 1`.

Result: if A **caused** B (A happened, then a message about it led to B), A's number is always smaller. But the reverse isn't true: a smaller number doesn't prove A caused B. Lamport clocks give you **an order that respects cause and effect**, but they **can't tell you** when two events were independent.

**Vector clock:** each server keeps a little list of counters, one per server, like `{EU: 3, US: 5}`. By comparing two lists you can tell:

- `{EU: 3, US: 5}` vs `{EU: 4, US: 5}`: the second came **after** the first.
- `{EU: 4, US: 5}` vs `{EU: 3, US: 6}`: neither is ahead in every slot, so they're **concurrent** (happened independently). Now you know you have a real conflict to resolve.

## Split brain

A **network partition** is when servers can't reach each other but are both still running. Each side may think the other is dead and **both act as the owner**. That's **split brain**: two bosses giving conflicting orders. Leases plus fencing tokens are the standard guard.

## Locks: fencing, and when to skip them

For exclusive work, use **lease + fencing token**, and make the protected resource reject stale tokens.

Often you don't need a separate lock service at all. If the state lives in a database or queue, **claim the work atomically there**:

```sql
UPDATE jobs SET owner = 'worker-b', claim = claim + 1
WHERE id = 55 AND (owner IS NULL OR lease_until < now());
```

Only one worker's update matches the row. The database itself is the lock.

## Two-phase commit vs saga

**Two-phase commit (2PC):** a coordinator asks every database "can you commit?" (phase 1), then tells them all "commit!" (phase 2). All or nothing, across databases. The catch: if the coordinator dies between the phases, the databases sit **stuck**, holding locks, waiting for an answer.

**Saga:** no global lock. Each step is a normal local transaction that emits an event. If a later step fails, earlier steps are **compensated** (undone with a new action).

| | 2PC | Saga |
| --- | --- | --- |
| Like... | A wedding: everyone says "I do" or nobody marries. | Booking a trip piece by piece, cancelling if something fails. |
| All-or-nothing? | Yes. | Eventually, through undo steps. |
| In-between states visible? | No. | Yes (`PENDING`, etc.). |
| Risk | Gets stuck if coordinator fails. | Undo steps must be designed and can fail too. |

The **outbox** pattern (save the business data and its event in one local transaction) is how each saga step reliably announces "I'm done."

## A checkout saga in plain language

1. **Reserve inventory** (local save + event through the outbox).
2. **Request payment** (local save + event).
3. **Create shipment** (local save + event).

If payment **permanently** fails, send a compensating command: **release the reservation**.

Important: compensation is a **new business action**, not a time machine. If an email "order confirmed" was already sent, the undo is a second email "order cancelled." So every step and every undo must be **idempotent** (safe to run twice) and **auditable** (logged).

## Before reaching for distributed anything

1. Ask first: **can one service own this rule?** If stock and reservations live in one database, a normal transaction does the job.
2. If not, **don't** use a distributed lock to pretend many databases are one.
3. Make in-between states **visible**: `PENDING`, `UNKNOWN`, `CANCELLED`.
4. Build **reconciliation**: a job that finds stuck sagas (e.g. `PENDING` for over an hour) and fixes or flags them.

## CRDTs and collaborative editing

- **CRDTs** (Conflict-free Replicated Data Types): data types whose merge always gives the same answer whatever order the edits arrive in. Examples: a counter where each server tracks its own adds, or a set where items are only added. Great for likes, presence, carts.
- **Operational transformation (OT):** used in live collaborative editors. When two people type at the same time, a central system **transforms** each edit to account for the other ("you inserted at position 5, but they inserted 3 letters before that, so your insert moves to position 8").

## Choose consistency per fact

| Fact | Can it be stale or merged? |
| --- | --- |
| Shopping cart | Yes, merging two carts is fine. |
| Like count | Yes, off by a few for a moment is fine. |
| Inventory count | No, one authoritative decision. |
| Account balance | No, one authoritative decision. |

## Quick recap

- ⏰ **Clocks lie:** use monotonic clocks for durations, versions or logical clocks for order.
- 🎟️ **Fencing tokens:** the storage rejects writes from an old owner.
- 🧩 **Sagas:** split cross-service work into steps with idempotent undo actions.
- 🔀 **CRDTs** for mergeable data only; money and stock need one place that decides.
- 🔒 Prefer an **atomic claim in the database** over a separate distributed lock.
