---
title: "Batch vs Stream and Data Modeling"
summary: "Decide when work runs (later in a batch, or right away in a stream) and store data correctly first. Only make copies for speed once you've proven reads are slow."
level: Advanced
tags: [system-design, batch, streaming, normalization, denormalization]
---

## The story in one minute

You run an **online marketplace**. You need two very different things:

- A **daily money report**: "Yesterday we sold $84,210." It must be exactly right.
- A **fraud alert** within **5 seconds** of a suspicious purchase. It must be fast.

Here is what goes wrong, step by step:

1. A purchase event gets sent **twice** because of a network retry. The report counts it twice.
2. Another purchase from 11:58 p.m. arrives at **12:03 a.m.**, after the day was "closed." The report quietly ignores it.
3. The finance team compares the report with the real purchase records. **The numbers don't match**, and nobody can explain why.
4. Meanwhile, the fraud checker reads from the same busy database as checkout, and slows checkout down.

Fast and correct are different jobs. This lesson shows how to get both.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Batch** | Collect data, then process it all at once later. | Doing all the week's laundry on Sunday. |
| **Stream** | Process each event as soon as it arrives. | Washing each dish right after you use it. |
| **Event time** | When the thing *actually happened*. | The date written on a receipt. |
| **Normalized data** | Each fact stored in exactly **one** place. | One master address book; everything else looks it up. |
| **Denormalized data** | Facts **copied** into extra places so reading is faster. | Writing a friend's address on the front of your holiday card list too. |

## The fix in three rules

### Rule 1: Keep one trusted copy of the real records

The purchase records (orders, payments) are the **source of truth**: the copy you trust when copies disagree.

✅ Store them **normalized**, with database rules (*constraints*) that block bad data, such as "every payment must belong to a real order" or "no two orders with the same ID."

### Rule 2: For fast checks, stream, but plan for duplicates and late events

✅ For fraud checks:

- Give every event a **stable ID** (the same ID every time it's re-sent), so duplicates can be spotted and skipped.
- Group events by **event time** in **windows** (for example, "purchases by this card in the last 60 seconds").
- Decide up front **what happens when an event arrives late**: update the result, or send it somewhere for review.

### Rule 3: For reports, run scheduled jobs, and make copies on purpose

✅ Build reporting tables in **batches** (every night) or small **incremental** jobs (every 10 minutes, only the new data).

If you make a **denormalized** copy for speed, do it **deliberately**, and keep **lineage**: a way to trace every number back to the original records it came from.

## Walk through a failure

The daily report for Monday was published on Tuesday morning. On Wednesday, a Monday purchase finally shows up (a phone was offline).

- ❌ Ignore it. Now the report says $84,210, but the real records add up to $84,260. Finance loses trust in every report.
- ✅ Follow the **reporting rules you agreed on in advance**: either **recompute** Monday, or publish a clear **correction** ("Monday revised: +$50").

## How to prove it works

1. **Replay** the same input data twice. The money totals must be **identical** both times. (If they aren't, you have a duplicate or ordering bug.)
2. Measure **stream freshness**: how many seconds behind real time the fraud checker is.
3. Count **late events**: how many arrive after their window closed.
4. Run **reconciliation**: compare report totals with the source records. The difference should be zero, or fully explained.

Fast streaming is only useful if the answers are **correct**.

### Check your understanding

In a revenue report, which time should you use: the **purchase time**, or the time your system **processed** the event?

<details>
<summary>Show answer</summary>

**Purchase time** (the *event time*).

A sale made at 11:58 p.m. on Monday belongs to **Monday's** revenue, even if your system only processed it at 12:03 a.m. on Tuesday. If you used processing time, any slow day, outage or replay would move money into the wrong day, and running the same report twice could give different answers.

Processing time is still useful, but for a different question: "how far behind is our pipeline?"

</details>

---

## Going deeper

![Batch runs a bounded set later; streaming handles events continuously while data modeling controls read and write cost](/img/system-design-l6/batch-stream.svg)

## The four choices at a glance

| Choice | Use when | What it costs you |
| --- | --- | --- |
| **Batch** | Reports, re-processing old data (*backfills*), daily billing | Results come later. |
| **Stream** | Fraud alerts, live dashboards | You must handle order, replays and duplicates. |
| **Normalized tables** | You need correct data and easy, safe writes | Reading may need *joins* (combining several tables). |
| **Denormalized read model** | You've **measured** that a read is too slow | Copies can drift out of sync, so someone must keep them updated. |

## What a stream needs

A stream is like a conveyor belt that never stops. To make it safe, you need:

- **An ordering key:** events with the same key (say, the same card number) are kept in order.
- **Idempotency:** handling the same event twice has the same effect as handling it once.
- **Retention:** the stream keeps events for a while (say, 7 days) so you can replay them after a bug.
- **A DLQ (dead-letter queue):** a side shelf for events that keep failing, so one bad event doesn't block the belt.

## What a batch job needs

**Isolation.** A big nightly report scanning millions of rows must not slow down checkout. Run it on a copy of the data (a *replica* or data warehouse), or limit how much it can use.

## One order, two useful shapes

**Shape 1: the order database (normalized).** Tables like `orders`, `order_items` and `payments`. Each fact lives in one place. Constraints protect money and stock counts.

**Shape 2: the "My orders" screen (denormalized).** One ready-made row per order with the title, thumbnail, total and status. It's fast to read, but it **may be up to a minute behind**.

How to keep them connected, in order:

1. **Write the source of truth first** (the order tables).
2. In the same transaction, write an **outbox event** ("order 123 changed"). An *outbox* is a table of events saved together with the data, so you never save the order but forget the event.
3. A worker reads the outbox and **updates the "My orders" copy**, safely handling repeats.
4. Found a bug in the copy? **Rebuild it** from the saved events or the source tables.

Never let the copy be the **only** place important data lives.

## Batch or stream? A quick test

| Question | Batch | Stream |
| --- | --- | --- |
| When is the result needed? | Hourly or daily is fine. | Seconds or minutes matter. |
| Biggest risk | The report job slows down production. | Duplicate or late events. |
| How you prove it's healthy | Job finished, row counts match, data is fresh enough. | Lag is low, event age is low, duplicates are being caught. |

Both styles also need: **schema versioning** (a safe way to change the data's shape over time), **data-quality checks** (for example, "no negative prices"), and a named **owner** for records that fail.

## Quick recap

- 🗂️ **Source of truth:** normalized, protected by constraints, written first.
- ⚡ **Stream:** for speed. Use stable IDs, event-time windows and a plan for late events.
- 🧺 **Batch:** for exact reports, kept away from production traffic.
- 📋 **Copies (denormalized):** only when reads are proven slow, always rebuildable from the source.
