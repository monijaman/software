---
title: "Timeouts, Retries & Backpressure"
summary: "When something you depend on gets slow, stop waiting forever, don't pile on retries, and say 'not now' before you drown."
level: Advanced
tags: [system-design, backpressure, timeouts, retries, resilience]
---

## The story in one minute

Your **order service** needs the **shipping service** to finish an order. Normally shipping answers in **80 ms**. One day shipping gets sick and takes **3 seconds** to answer.

Here is what goes wrong, step by step:

1. Every order request now sits and waits 3 seconds for shipping.
2. While they wait, they hold on to a worker (a thread or connection). Workers run out.
3. Some requests give up and **retry**, which sends *even more* calls to the already-sick shipping service.
4. Now even pages that have nothing to do with shipping (like "view my profile") are slow, because all the workers are busy waiting.

One slow service has made the **whole app** slow. This lesson is about stopping that.

## Three words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Timeout** | "I'll wait this long, then I give up." | You wait 10 minutes for a bus, then walk. |
| **Retry** | "That failed, let me try again." | Redialing a phone number that was busy. |
| **Backpressure** | "I'm full, please slow down or come back later." | A restaurant saying "no more walk-ins tonight." |

## The fix in three rules

### Rule 1: Have one deadline, and share it

The user is willing to wait **500 ms** total. That is the whole budget. Every step spends part of it, like spending money from one wallet.

❌ **Wrong:** every step gets its own 500 ms timeout. Three steps could take 1,500 ms, and the user already left.

✅ **Right:** split the 500 ms between steps. If time runs out, stop and answer the user.

### Rule 2: Put a limit on how much waiting you allow

Say: "At most **50** calls to shipping may be in progress at once." If a 51st arrives, don't let it wait forever. Either:

- tell the user "we got your order, shipping details coming soon", or
- reply "busy, try again shortly".

This way shipping's problem stays **shipping's problem**. Other pages keep their workers and stay fast.

### Rule 3: Retry carefully, not blindly

Retry only when **all** of these are true:

- the error is temporary (a timeout or "service busy", not "invalid address"),
- trying again is safe (it won't charge or ship twice),
- there's still time left in the deadline.

And when you do retry, **wait a random little bit first** (this is called *jitter*). If 1,000 clients all retry at exactly the same moment, they hit the sick service like a wave.

## Walk through a failure

A call to "buy a shipping label" times out. **Did it work or not?** You don't know. Maybe shipping bought the label and the answer just got lost on the way back.

- ❌ If you blindly retry, you might buy **two** labels.
- ✅ Send the same **request ID** on the retry (an *idempotency key*). Shipping sees "I already did this one" and returns the first result instead of buying again.

If shipping keeps failing, use a **circuit breaker**: like a fuse in your house, it "trips" and stops sending calls for a short while. Every so often it lets **one** test call through. If that works, traffic slowly returns. If not, it stays off.

## How to prove it works

Make shipping slow **on purpose** in a test environment, then check:

1. The number of calls waiting on shipping **never goes above your limit**.
2. Pages that don't use shipping **stay fast**.
3. When shipping recovers, you don't get a giant **burst of retries**.

### Check your understanding

200 calls arrive every second, and each one now takes 3 seconds. With no limit, how many calls are stuck waiting at the same time?

<details>
<summary>Show answer</summary>

**200 × 3 = 600 calls** waiting at once. Each one is holding a worker. That's why you need a cap: without it, a slow service quietly eats all your workers.

</details>

---

## Going deeper

## The big idea: a queue doesn't create more tables

Think of a restaurant with 10 tables. If 50 people show up, writing all 50 names on the waiting list doesn't make food come faster. It just means everyone waits longer, and many leave angry.

A **queue** (waiting line) in software works the same way. A queue is fine for short bursts. But if work arrives faster than you can finish it, the queue just grows and grows until memory runs out.

![A bounded request path: deadline budgets, limited concurrency, a queue and explicit overload shedding](/img/system-design-l6/backpressure.svg)

## Splitting the deadline: a worked example

The user will wait **1,000 ms** for checkout. Here's one way to split it:

| Step | Gets | If it runs out of time |
| --- | ---: | --- |
| Our own app code | 150 ms | Stop before calling anyone else. |
| Inventory check | 250 ms | Show "try again" message. |
| Payment | 450 ms | Check later using the payment's request ID. |
| Spare time | 150 ms | So we answer *before* the user's browser gives up. |
| **Total** | **1,000 ms** | |

Pass the **remaining time** along with each call. If payment receives a request with only 20 ms left, it should not even start.

## Retries can make things worse

Imagine a service running at 90% busy. A few requests time out. Each one retries 3 times. Suddenly the service gets **much more** traffic than before, right when it's weakest. It falls over completely. This is called a **retry storm**.

How to avoid it:

- **Limit attempts**: e.g. at most 2 retries.
- **Back off**: wait longer after each try (100 ms, then 200 ms, then 400 ms), plus a random bit.
- **Retry in one place only**: if the browser, the gateway *and* the app all retry 3 times, one click becomes 3 × 3 × 3 = **27** calls.
- **Listen to the server**: if it replies with a `Retry-After` header, wait that long.
- **Stop when the deadline has passed**. Nobody is waiting for the answer anymore.

## Ways to say "not now"

When you're overloaded, you have a few polite options:

- **Limit how many** expensive jobs run at once.
- **Cap the queue size.** When it's full, reject new work or save it for later instead of holding it all in memory.
- **Drop the nice-to-haves first.** Turn off recommendations before you turn off checkout.
- **Park broken jobs.** If a job fails again and again, move it to a separate "problem jobs" queue (a *dead-letter queue*, or DLQ) so it doesn't block everything else.

## A worked example: 5,000 uploads at once

Your image service can process **100 images at a time**. Suddenly **5,000** uploads arrive.

❌ **Accept everything into memory:** everyone waits a long time, and the service might crash and lose all of it.

✅ **Better plan:**

1. Save uploads to a **durable queue** (one that survives a restart) with a known maximum size.
2. Show the user "processing…" right away.
3. Workers pull jobs from the queue at a safe speed.
4. If the queue is full, reply "busy, please try again in a minute."

**Tip:** don't just watch *how many* jobs are waiting. Ten tiny jobs and ten huge jobs look the same by count. Also watch **how old the oldest job is**. If that number keeps rising, your workers are falling behind.

## Decide the rules before the bad day

Make these decisions calmly *now*, not during an outage at 3 a.m.:

| Kind of work | When overloaded | Why |
| --- | --- | --- |
| Payment status check | Always keep room for it | It's about the customer's money. |
| Order confirmation email | Delay it (keep it in a queue) | Arriving 5 minutes late is fine. |
| Product recommendations | Turn off for now | Nice to have, not needed. |
| File conversion | Accept only up to the limit | Stops one feature eating all the machines. |

## What to watch on your dashboard

- **How long** the oldest item has been waiting in the queue
- **How full** each limit is (e.g. 48 of 50 shipping slots in use)
- **How much work** you rejected
- **How slow** each service you depend on is
- **How many retries** are happening

## Quick recap

- ⏱️ **Timeout:** one total deadline, split across steps.
- 🚦 **Backpressure:** cap the waiting; say "not now" clearly instead of piling up.
- 🔁 **Retries:** only for temporary, safe errors, with random waits, in one place.
- 🔌 **Circuit breaker:** stop calling a sick service for a bit, then test gently.
