---
title: "Message Delivery: Queues, Kafka, Ordering and DLQs"
summary: "Pick the right kind of message system, and plan up front for duplicate messages, ordering, broken messages and replays."
level: Advanced
tags: [system-design, kafka, queues, dlq, delivery, schema-evolution]
---

## The story in one minute

When an order is placed, an `OrderPlaced` message goes into **Kafka**. A **shipment service** reads it and creates a shipment record.

Here is what goes wrong:

1. The shipment service reads message #500 and **creates the shipment**.
2. Before it can tell Kafka "I'm done with #500", it **crashes**.
3. It restarts. Kafka thinks #500 was never finished, so it sends **#500 again**.
4. Without care, the service creates a **second shipment** for the same order.
5. Later, a **broken message** arrives (bad data). The service fails on it, retries it, fails again... and every message behind it in that line is **stuck**.

Messages can arrive twice, and one bad message can block the rest. This lesson shows how to handle both.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Offset** | A message's position number in the log. "Committing" it means "I've finished everything up to here." | A bookmark in a book. |
| **Partition** | One of several separate lines a topic is split into. Order is kept only *inside* one line. | Separate checkout lanes in a supermarket. |
| **Idempotent** | Handling the same message twice has the same effect as once. | Stamping "PAID" on an invoice that's already stamped. |
| **Poison message** | A message that fails every time, no matter how often you retry. | A letter with an unreadable address. |
| **DLQ (dead-letter queue)** | A side place to park poison messages so they stop blocking others. | The post office's "undeliverable mail" shelf. |

## The fix in three rules

### Rule 1: Pick the right tool

- A **work queue** is for jobs where **one worker** should handle each one. A worker *leases* (borrows) a job, finishes it, and it's gone.
- **Kafka** is a **log** that keeps messages for a while. Many different services can read the same messages, each at its own pace, and you can **replay** (re-read) history. Messages are split into partitions, and each partition keeps its order.

### Rule 2: Expect duplicates and make them harmless

Kafka (like most systems) delivers **at least once**: you might get a message twice. So:

- **Key messages by `order_id`.** All messages for one order go to the same partition, so they stay in order.
- **Give each message an `event_id`** and remember which ones you've handled.
- ✅ **Best:** in **one** database transaction, write the shipment **and** a "processed event_id" marker. Either both are saved, or neither is.

❌ **Wrong:** "Kafka has exactly-once, so I don't need to worry." Kafka's transactions only cover reading and writing **Kafka** (and its offsets). They do **not** cover sending an email or charging a card. Those still need their own idempotency key.

### Rule 3: Retry a few times, then park it, and own the parked ones

After a small number of retries, move the poison message to a **DLQ**. Save:

- the original message,
- the error,
- extra details (attempt count, where it came from).

Then decide **who** fixes it, **how** it gets replayed, and **what happens to later messages for the same order** while it waits.

## Walk through a failure

Back to the crash from the story:

1. Service writes the shipment **and** the marker "event `e-500` processed" in one transaction.
2. Service crashes before committing the offset.
3. Kafka resends `e-500`.
4. Service checks: "Have I processed `e-500`?" **Yes.** It skips the work and just commits the offset.

✅ One shipment, not two. The duplicate *delivery* happened, but the duplicate *effect* did not.

⚠️ If step 1 had also sent a "your order shipped" **email**, Kafka can't undo that. The email service needs its own idempotency key (e.g. `ship-email:order-981`) to avoid sending twice.

## How to prove it works

Test these on purpose:

1. **Crash before committing the offset:** still exactly one shipment.
2. **Duplicate delivery:** the same message sent twice gives one effect.
3. **Out-of-order versions:** version 3 arriving after version 4 doesn't overwrite newer data.
4. **DLQ replay:** a fixed message can be replayed and processed correctly.

Watch these numbers: **consumer lag** (how far behind the reader is), **age of the oldest failed message**, and **count of duplicate side effects** (should be zero).

⚠️ A message in the DLQ is **waiting for repair**. It is **not** "successfully processed".

### Check your understanding

Order 981 has events version 4 and version 5. Version 4 fails and goes to the DLQ. Is it safe to process version 5 for that order?

<details>
<summary>Show answer</summary>

**Usually not.** Version 5 was written assuming version 4 already happened (for example v4 = "address changed", v5 = "shipped"). Applying v5 without v4 can ship to the wrong address or leave the order in a state that never existed.

Safe options:

- **Hold** later events for **that order only** (park them with v4) until v4 is fixed, while other orders keep flowing.
- Or, if every event carries the **full current state** of the order (not just a change), v5 can safely replace everything, and v4 can be skipped as out of date.

You must decide this rule **before** the failure happens.

</details>

---

## Going deeper

## A queue is not always Kafka

| | Work queue | Kafka (event log) |
| --- | --- | --- |
| Who gets a message? | **One** worker handles each job. | **Every** consumer group gets its own copy. |
| After processing | The job is removed. | The message stays (for the retention period). |
| Replay old messages? | No | Yes |
| Good for | "Resize this image", "send this email" | "Order placed": inventory, email and analytics all need to know |

(A *consumer group* is a team of readers that share the work for one purpose. The email team and the analytics team are separate groups, so each sees every message.)

**Example: order placed**

```text
Order database + outbox row (one transaction)
              -> event stream: OrderPlaced(order_id, version, event_id)
                 -> inventory consumer group
                 -> email consumer group
                 -> analytics consumer group
```

## The outbox: don't lose the message

The classic gap: the order is saved in the database, then the app crashes **before** sending the message to Kafka. The order exists, but nobody downstream ever hears about it.

The **outbox pattern** fixes this. In the **same** database transaction as the order, also write a row to an `outbox` table: "please publish OrderPlaced for 981". A separate process reads the outbox and publishes to Kafka. If it crashes, it just publishes again later (which is fine, because consumers handle duplicates).

## Delivery words, in plain terms

| Term | What really happens | What the reader must do |
| --- | --- | --- |
| **At-most-once** | A message may be **lost**, never retried. | Use only where losing some is OK (e.g. some metrics). |
| **At-least-once** | A message may arrive **twice**. | Remove duplicates using a saved event ID or a unique rule. |
| **Exactly-once effect** | The business result happens **once**. | Usually needs idempotent writes plus careful transaction boundaries. |

Note "exactly-once **effect**": messages may still be delivered twice. What matters is that the shipment is created once.

## Ordering: name the key

Don't promise "messages are in order" unless you can say **in order by what**.

If you partition by `order_id`, all events for order A stay in order, and all events for order B stay in order. But an event for B might be handled before an earlier event for A. That's usually fine: different orders don't depend on each other.

Keeping **one global order** for everything means a single partition, so only one reader at a time. That's slow and expensive, and products rarely really need it.

## Readers that survive crashes

The safe order of steps for each message:

1. **Read** the message.
2. **Check its schema** (does it have the fields and types we expect?).
3. **Do the business write idempotently** (with the event ID check or a conditional update like "only if current version < 5").
4. **Then commit the offset.**

If the reader crashes between step 3 and step 4, it gets the message again. The event ID check makes the second try harmless.

## Poison messages and the DLQ procedure

❌ Don't retry a poison message forever. It blocks its partition.
❌ Don't treat the DLQ as a trash can. Each message there is a customer's work stuck out of sight.

✅ When a message goes to the DLQ, store:

- the payload (or a reference to it),
- the error and attempt count,
- the consumer version that failed,
- its original position (topic, partition, offset).

Then: **alert an owner**, fix the code or data, **replay in a controlled way**, and expire old entries on purpose. Track the **age of the oldest DLQ message**. A growing DLQ means work is quietly piling up.

## Messages change over time

Give events a **schema version**. During a gradual deploy, some readers run old code while writers run new code, so changes must work for both:

- ✅ **Add** new optional fields first. Old readers just ignore them.
- ❌ Never silently **change the meaning** of a field. If `amount` used to be in dollars and now it's in cents, old readers will charge 100 times too much.

## Quick recap

- 📬 **Queue** = one worker per job. **Kafka** = a kept log that many groups can read and replay.
- 🔁 **Duplicates will happen.** Save the effect and a "processed event_id" marker together, then commit the offset.
- 🔑 **Order is per key** (e.g. per `order_id`), not global.
- 🪦 **DLQ** = parked work waiting for repair, with an owner, alerts and a replay plan.
- 📐 **Change schemas carefully:** add optional fields, never change what a field means.
