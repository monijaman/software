---
title: "The Hot SKU Alert Problem"
summary: "One product's price drops and ten million people are watching it. Tell every one of them exactly once, without freezing the price update, overloading the email provider or delaying urgent messages."
level: Advanced
tags: [system-design, notifications, Kafka, fan-out, idempotency, backpressure, consistency]
---

## The story in one minute

A popular product (a **SKU**, "stock keeping unit", the shop's ID for one item) drops from **₹5,000 to ₹3,999**. **Ten million** users have clicked "tell me when the price drops".

Here is what can go wrong, step by step:

1. The price update tries to find and notify all 10 million watchers **inside the same database transaction**. The product row stays locked for minutes, and nobody else can update it.
2. Everything for this product lands on **one** worker, because events are grouped by product. That one worker can't send 10 million messages quickly.
3. The email provider starts saying "slow down" (rate limiting). Some sends time out. Did those emails go out or not? Nobody knows, so the system resends, and some users get **two** emails.
4. **800 ms later** the price changes again, to ₹3,899. Should users get a second alert?
5. Meanwhile, a user trying to log in waits for their one-time login code, because it's stuck in the same queue behind 10 million price alerts.

This lesson is about sending a huge burst of alerts **correctly and calmly**, without breaking anything else.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Fan-out** | Turning one event into many messages, one per receiver. | One wedding announcement, mailed to 300 guests. |
| **Outbox** | A table where you write "this event must be published" in the **same** transaction as the real change. A separate process publishes it later. | Dropping a letter in your own outbox tray: it's guaranteed to be posted, even if the postman comes later. |
| **Kafka / partition** | Kafka is a durable message log. It's split into **partitions**: separate ordered lanes. Events with the same key always go to the same lane, in order. | Supermarket checkout lanes: everyone in one lane is served in order, but one lane can't serve the whole store. |
| **Idempotency key** | A unique ID for one delivery, so sending it twice is recognised and the second one is skipped. | A cheque number: the bank won't cash cheque #1042 twice. |
| **Coalescing** | Merging several quick updates into one message. | Waiting until everyone has replied before you send one summary text. |
| **Backpressure** | Saying "slow down, I'm full" instead of accepting unlimited work. | A restaurant saying "no more walk-ins tonight." |

## The fix in four rules

### Rule 1: Keep the price update tiny

The price change touches **one product row** and writes **one outbox event**, in one small transaction. That's it. Finding watchers happens later, outside the transaction.

❌ **Wrong:** "update price, then loop over 10 million watchers" all in one transaction. The row is locked for minutes.

✅ **Right:** commit price + outbox event in milliseconds. A publisher sends the event to Kafka afterwards.

### Rule 2: Split the audience into small, resumable jobs

Don't make one worker handle all 10 million. Create many **fan-out jobs**, each covering a range of watchers (for example 10,000 users each, so 1,000 jobs). Each job saves its progress, so if a worker dies, another picks up where it stopped.

Keep in mind: **order of price events** and **how many workers send in parallel** are two separate things. Price events stay in order per product. The sending is spread wide.

### Rule 3: Give each delivery a fixed identity

Each message gets a key like `price-alert:{product}:{version}:{user}:{channel}`. It's saved in the database with a "must be unique" rule **before** sending. A retry with the same key can't create a second alert.

### Rule 4: Keep bulk alerts in their own lane

Price alerts are **bulk** traffic. Login codes and payment alerts are **urgent**. Give urgent messages reserved capacity, and give bulk its own rate-limited lane. Also check each user's notification preferences and each provider's limits **before** sending.

## Walk through a failure

A worker is halfway through job #417 (watchers 4,170,000 to 4,179,999) and crashes after 6,000 sends.

1. The job's saved progress says "done up to watcher 4,175,800" (it saves every so often, so it may be slightly behind).
2. A new worker picks up job #417 from that point.
3. Some users between 4,175,800 and 4,176,000 were already sent to. Their idempotency keys already exist, so they're **skipped**.
4. Nobody re-scans the full 10 million, and nobody touches the price transaction again.

One case stays tricky: a **provider timeout**. We asked the email provider to send, and the call timed out. Maybe it sent, maybe it didn't. If the provider lets us pass our own idempotency key, or lets us look up "did message X go out?", we can resolve it. If not, there is no perfect answer: we must choose between a possible duplicate and a possible miss.

## How to prove it works

1. **Do the capacity maths.** If the provider accepts **10,000 alerts per second**, then 10,000,000 ÷ 10,000 = **1,000 seconds ≈ 16.7 minutes**, at the very least, before any overhead. Load-test that you really reach that rate.
2. **Kill workers mid-job.** Every user still gets exactly one alert.
3. **Make the provider time out.** Count duplicates and misses; they must match the policy you chose.
4. **Watch the urgent lane.** Login codes must stay fast while the bulk lane is full.
5. **Track the age of the oldest waiting alert.** If it keeps growing, you're falling behind.

### Check your understanding

The price goes ₹5,000 → ₹3,999 (version 7), then 800 ms later → ₹3,899 (version 8). Your policy is to **coalesce** (merge) these into one alert. Which users are eligible, and which price do they see?

<details>
<summary>Show answer</summary>

**They see the latest price, ₹3,899 (version 8).** Showing ₹3,999 would be out of date the moment it arrives.

**Eligibility is checked against version 8**, for users who haven't been sent an alert yet. That means users who are still watching, whose rules are met by ₹3,899 (for example "tell me below ₹3,950" now qualifies even though ₹3,999 didn't), and whose preferences allow this channel. Use the audience snapshot or version tied to version 8 so the result can be reproduced.

Users who **already received** the version 7 alert are handled by your written policy: for example "one alert per user per price epoch" means they get nothing more, while "alert on each further meaningful drop" might send them one more. The dedup key must match whichever rule you pick, and it must be stored in the database, not in memory.

</details>

---

## Going deeper

## The interview prompt

A popular SKU drops from ₹5,000 to ₹3,999. Ten million users are watching it. Every eligible watcher should receive one alert.

The first answer often sounds reasonable:

> "Publish the price change to Kafka and let the notification service fan out."

Kafka is useful here, but that sentence is only the beginning. The interesting questions start **after** the event is published:

- If one partition holds that product, **who** processes ten million notifications?
- If the provider times out after it may already have accepted the message, do we send again?
- If two price changes arrive 800 ms apart, does a user get one alert or two?
- If the watch table is the source of truth, does the price update lock ten million rows?

These aren't syntax questions. They're about **who owns what**, **ordering**, **doing things in parallel**, **delivery guarantees** and **recovering from failure**.

## Separate the price write from the fan-out

The price update should be a small, fast transaction on the product's official record (the **source of truth**). It must not scan ten million watchers or call the provider ten million times while the transaction is open.

```text
Price command
    ↓
Product transaction
    ├─ update current price
    └─ write an outbox event: PriceChanged(product, version, old, new)
             ↓
        outbox publisher
             ↓
           Kafka
             ↓
    fan-out and delivery pipeline
```

Why the outbox? Without it, you'd update the price and then publish to Kafka as two separate steps. If the app crashes between them, the price changed but nobody ever hears about it. With the outbox, "price changed" and "someone must publish this" are saved **together**, or not at all.

The publisher can safely retry rows it hasn't sent yet. But that also means an event might be published **twice** (this is "at-least-once" delivery: never lost, sometimes repeated). So everything downstream must handle duplicates.

The "who watches what" table stays separate from the product row. A price update changes one product record. It doesn't lock or rewrite ten million watcher rows.

## A partition is not a worker pool

Putting events into partitions by `product_id` keeps one product's events **in order**. But it also means a hot product's events all sit in **one lane**, read by one consumer. One consumer can't turn one event into ten million provider calls fast enough.

Ways to handle that hotspot, each with a cost:

| Strategy | Benefit | Cost |
| --- | --- | --- |
| Keep one product partition | Simple ordering | One hot key limits how much runs in parallel |
| Bucket the fan-out task | Parallel workers each take a range of watchers | Order is now per bucket, not for the whole product |
| Create a fan-out job per page/range | Small, bounded jobs that are easy to retry | Needs a saved cursor (progress marker) and job state |
| Snapshot watchers to object storage | A fixed, replayable audience list | Extra storage, and the list can go slightly stale |
| Use a dedicated hot-key lane | Normal traffic isn't slowed down | More routing and more to operate |

**A practical design:** keep the price event small and ordered. Then create durable fan-out jobs like `(product_id, price_version, watcher_range)`. Spread those jobs across many partitions using a **bucket key** (for example `hash(watcher_range) % 64`), so 64 consumers can work at once while the original price event stays in order.

## Delivery is a state machine, not yes/no

The provider timeout is the hardest case. After a timeout, the message might be **not sent, accepted, delivered or still in progress**. We simply don't know.

So `send()` can't mean "delivered". Instead, record a fixed identity for each notification and move it through clear states:

```text
Pending → Sending → Accepted → Delivered
                    ├────────→ Failed
                    └────────→ Unknown → Reconcile / retry policy
```

- **Pending:** created, not tried yet.
- **Sending:** we called the provider.
- **Accepted:** the provider said "got it".
- **Delivered:** the provider confirmed it reached the user.
- **Unknown:** the call timed out. We must check (reconcile) or follow the retry policy.

Use a stable idempotency key such as:

```text
price-alert:{product_id}:{price_version}:{user_id}:{channel}
```

Save it with a **unique constraint** (the database refuses a second row with the same key) **before** trying to deliver. Pass the same key to the provider if it supports idempotency. If it doesn't, an "Unknown" result can't be solved perfectly. You have to pick: risk a duplicate (resend) or risk a miss (don't). Then write that choice into the product's promise so everyone knows.

When the provider sends **webhooks** (it calls *you* back with "message X was delivered"), update the notification record using the provider's message ID, in a way that's safe to repeat.

Retries need:

- **exponential backoff** (wait 1 s, then 2 s, then 4 s, ...),
- **jitter** (add a random bit so retries don't all hit at once),
- a **maximum age** (a price alert from 6 hours ago isn't worth sending),
- a **dead-letter path** (a separate holding area for messages that keep failing).

Never let a flood of retries crowd out urgent messages or eat the whole provider quota.

## What does "one alert" mean?

Two price changes 800 ms apart force a **product decision**. You need a written coalescing policy, not just a queue.

| Policy | How it works | Good | Bad |
| --- | --- | --- | --- |
| **Every version** | One alert per price version. | Full history. | Noisy: 2 alerts in 1 second. |
| **Latest value** | While a user's alert is still waiting, replace it with the newest price. | Fewer messages. | Middle prices are skipped on purpose. |
| **Debounced change** | Wait for a short quiet period (say 30 s), then send the latest price. | Calm for prices that jump around. | Alerts arrive a little later. |
| **Threshold-based** | Alert only when the price crosses the user's own target (an amount or a %). | Very relevant to each user. | Users must set a target. |

The dedup key and the database uniqueness rule must **match** the policy. If the rule is "one alert per product per user per price epoch", define exactly what an **epoch** is (for example "a sale period" or "a 24-hour window") and store it. Don't rely on an in-memory cache to remember who was already notified: a restart wipes it.

## Protect the provider and the rest of the system

Ten million alerts to send doesn't mean ten million requests **at the same moment**. Use:

- a **fixed number of workers** (bounded concurrency),
- **rate limits per provider** (e.g. at most 10,000 per second to the email provider),
- **separate queues per channel** (email, SMS, push),
- **circuit breakers** (stop calling a failing provider for a while, then test gently),
- **backpressure** (when full, slow intake rather than piling up).

Split work by how much it matters:

```text
Transactional / security alerts  → reserved capacity, short SLA
Hot SKU price alerts             → large, rate-limited bulk lane
Marketing notifications          → lowest priority, easiest to pause
```

(**SLA** = the delivery-time promise, like "login codes within 10 seconds".)

If the provider is slow, the backlog should grow **in the bulk lane**, while login codes, payment failures and security alerts keep flowing. A queue only helps if you can **see** how big it's getting and it has a **maximum size**.

## The L6 answer

The strong answer isn't "use Kafka". It is:

1. Commit the price change and an outbox event, without doing any fan-out in that same transaction.
2. Keep the "who watches what" data separate from the product write path.
3. Create bounded, retryable fan-out jobs so a hot product can use many workers.
4. Decide whether the product promises **every price version** or **only the latest meaningful change**.
5. Use durable idempotency keys and clear notification states for uncertain provider results.
6. Rate-limit and separate bulk delivery so one viral product can't block critical messages.
7. Measure: oldest backlog age, fan-out lag, provider acceptance rate, uncertain timeouts, duplicate rate, how many alerts were coalesced, and load per hot product.

That's the difference between naming familiar tools and designing a system that still behaves when one product becomes the whole internet's favourite deal.

## Quick recap

- 📦 **Tiny transaction:** price + outbox event only; fan-out happens afterwards.
- 🧩 **Split the audience** into resumable range jobs so many workers can help.
- 🏷️ **One key per delivery** (product, version, user, channel), saved before sending.
- 🔀 **Write down the coalescing policy** and make the dedup key match it.
- 🚦 **Separate lanes:** bulk alerts are rate-limited; urgent messages keep reserved room.
