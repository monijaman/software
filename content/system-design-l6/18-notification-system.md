---
title: "Design a Reliable Notification System"
summary: "Send email, SMS, push and in-app messages that respect user choices, keep urgent messages fast, avoid sending twice, survive a provider outage and leave a clear record of what happened."
level: Advanced
tags: [system-design, notifications, queues, retries, providers]
---

## The story in one minute

A marketplace sends three kinds of messages: **password resets**, **order receipts** and **promotional pushes**. On Black Friday, marketing launches a campaign: **one million messages**. At the same moment, the email provider gets slow.

Here is what goes wrong with one shared queue:

1. The million promo emails go into the queue first.
2. A user clicks "forgot password". Their reset email lands **behind** a million promos.
3. The email provider times out. Your system doesn't know if the email went out, so it sends again. Some users get **two** receipts.
4. A user who said "no marketing, please" gets the promo anyway.

This lesson is about sending messages that are **on time, sent once (as far as possible), and respectful**.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Transactional message** | A message the user needs because of something they did (reset, receipt). | A shop handing you your receipt. |
| **Marketing message** | A message *you* want to send them (sales, promos). | A flyer in the mailbox. |
| **Provider** | The outside company that actually delivers the email, SMS or push. | The postal service. |
| **Idempotency key** | A unique ID for "this exact message", so a repeat request is recognized and not sent twice. | A cheque number: the bank won't cash the same number twice. |
| **Accepted vs delivered** | "The provider took it" is not the same as "it reached the person". | Handing a letter to the post office is not the same as it arriving. |

## The fix in three rules

### Rule 1: Write it down before you send it

When something happens (an order ships), first save a **notification intent**: a durable record that says

- who it's for,
- which template and which **version** of it,
- which channel (email, SMS, push, in-app),
- which business event caused it (e.g. `order_shipped` for order 991).

Now, even if the server crashes, nothing is forgotten.

### Rule 2: Separate lanes for urgent and bulk

❌ **Wrong:** one queue for everything. A campaign delays password resets.

✅ **Right:** two (or more) **bounded queues** (queues with a size limit), with their own workers and their own sending quotas:

| Lane | Examples | When busy |
| --- | --- | --- |
| Urgent | Password reset, 2FA code, receipt | Always keeps capacity |
| Bulk | Campaigns, weekly digest | Slows down, waits |

Before calling a provider, check the user's **preferences** (did they opt out?) and **rate limits** (don't send them 20 pushes an hour).

### Rule 3: Don't guess after a timeout

The provider might have sent the email and the answer just got lost. So:

1. Send the **same idempotency key** on any retry, if the provider supports it.
2. Record the attempt as `accepted`, `failed`, or **`unknown`**.
3. For `unknown`, **look it up** with the provider (or wait for their callback) before sending again.

❌ **Wrong:** "Provider A timed out, send it through Provider B right now." You may send it twice.

## Walk through a failure

The email provider accepts a receipt, but the reply **times out**.

- Our record says `unknown`.
- Switching to a backup provider immediately could mean the user gets **two receipts**.
- Instead, we keep the attempt, ask Provider A "what happened to message X?", and retry in a controlled way only if it truly failed.

How much duplication is OK depends on the channel. A duplicate promo push is annoying. A duplicate **2FA code** is mostly harmless. A duplicate **"your payment was taken" SMS** can scare people. Decide this **per channel and per message type**.

## How to prove it works

In a test environment:

1. **Flood the bulk lane** with a fake campaign. Urgent messages must still go out fast. Measure the **age of the oldest urgent message** in the queue.
2. **Make the provider time out** on purpose. Check that no message is sent twice without a lookup.
3. Watch: accepted rate, duplicate complaints, and how long `unknown` attempts stay unknown.

Remember: "the provider accepted it" is **not** proof it reached the inbox.

### Check your understanding

Which preference rules should differ between a receipt and a marketing campaign?

<details>
<summary>Show answer</summary>

**Marketing** needs the user's consent and must obey opt-outs, quiet hours (e.g. no pushes at 3 a.m.) and frequency caps (e.g. at most 2 promos a week). **Receipts and other transactional messages** are expected because of something the user did, so a "no marketing" opt-out does not block them, and they shouldn't be delayed by quiet hours or promo caps. The user may still choose *which channel* gets them (email vs SMS), and legal rules still apply.

</details>

---

## Going deeper

![Notification service: preferences feed priority queues, channel providers and idempotent delivery tracking](/img/system-design-l6/notifications.svg)

## A notification is not one API call

Here is the full journey, step by step:

1. **The business event:** an order changes. The order service saves the order **and** an "outbox" event in the **same database transaction**. (An **outbox** is a table of "things to announce". Saving both together means you never save the order but forget to announce it.)
2. **Expand to recipients:** the notification service reads the event and figures out who should hear about it. It checks consent, channel preference, quiet hours and the template version.
3. **One delivery record per person per channel**, with a uniqueness rule like `(event_id, user_id, channel)`. If the event is processed twice, the database refuses the second copy. No duplicate.
4. **Workers send** through email, push or SMS providers, and save the provider's message ID.
5. **Webhooks** (callbacks the provider sends to you later, like "delivered" or "bounced") update the status. Handle them **idempotently**: getting the same webhook twice changes nothing.

## The request record

Each request is **immutable** (never edited after creation) and holds:

| Field | Why |
| --- | --- |
| Idempotency key | Spot repeats |
| Audience | Who gets it |
| Channel | Email, SMS, push, in-app |
| Template version | So you know exactly what text was sent |
| Priority | Urgent or bulk lane |
| Expiry | A 2FA code sent 2 hours late is useless; drop it instead |

## Keep statuses separate

| Status | Meaning |
| --- | --- |
| `pending` | Saved, not yet sent |
| `accepted` | Provider took it |
| `delivered` | Provider says it reached the device or mailbox (if they support this) |
| `bounced` | Address doesn't work |
| `failed` | Gave up |
| `unknown` | Timed out; must look it up |

None of these means "the person **read** it".

## What should happen when...

| Situation | Expected behavior |
| --- | --- |
| User opted out of marketing | Don't even queue the marketing message. |
| Provider times out | Keep the same delivery key; look it up or retry safely. |
| Provider is down | Queue work (with a size limit) and delay low-priority messages first. |
| Template is broken | Pause that template version; don't keep sending a broken message. |
| A message fails again and again | Move it to a **dead-letter queue** (DLQ, a "problem messages" shelf) for a human to look at. |

Retry temporary errors with **backoff** (wait longer each time: 1 s, 2 s, 4 s...).

## Worked numbers: why separate lanes matter

Your email workers send **2,000 emails per second**. A campaign of **1,000,000** emails takes 1,000,000 ÷ 2,000 = **500 seconds** (over 8 minutes). With one shared queue, a password reset that arrives just after the campaign waits **8+ minutes**. With a separate urgent lane and reserved workers, it waits **under a second**.

## What to watch

- **Age of the oldest job** in each lane
- Provider error rates
- Retry rate
- Whether opt-outs are really being obeyed
- Backlog per **tenant** (per customer business, if you serve many)

## Quick recap

- 📝 **Save the intent first:** a durable record, then send.
- 🚦 **Two lanes:** urgent messages never wait behind a campaign.
- 🙋 **Respect choices:** check consent, quiet hours and limits before sending.
- 🔑 **Same key on retry:** after a timeout, look it up instead of guessing.
- 📬 **Accepted is not delivered:** track each status separately.
