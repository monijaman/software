---
title: "Capacity Planning, SLOs and Error Budgets"
summary: "Turn fuzzy goals like 'it must be fast and reliable at scale' into clear numbers: how much traffic to plan for, how fast and reliable to be, how much failure is allowed, and what to do when you run out."
level: Advanced
tags: [system-design, capacity, slo, sli, error-budget, availability]
---

## The story in one minute

Your **checkout** service handles **1,000 requests per second** at its busiest. The team agrees: "it should be up **99.9%** of the month."

Here is what goes wrong, step by step:

1. Nobody wrote down what "up" means. Does a slow answer count? Does "sold out" count as a failure?
2. A bug makes checkout return **error 500** (server error) in 5 ms. The latency graph looks great: everything is fast! But nobody can buy anything.
3. The team doesn't know how much failure they've "used" this month, so they keep shipping risky changes.
4. On sale day, traffic triples. Nobody load-tested that, and one server dying takes the rest down with it.

The 99.9% was a **wish**, not a plan. This lesson turns wishes like that into numbers you can measure and act on.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **SLI** (service level indicator) | The thing you **measure**. | "What % of pizzas arrived within 30 minutes?" |
| **SLO** (service level objective) | The **target** for that measurement. | "99% of pizzas arrive within 30 minutes." |
| **Error budget** | How much failure the target still allows. | 1% of pizzas may be late: that's 10 out of 1,000. |
| **Burn rate** | How fast you're using up the error budget. | Spending your monthly allowance in 3 days instead of 30. |
| **Headroom** | Spare capacity above your expected peak. | Booking a hall for 120 when you expect 100 guests. |
| **p99 latency** | 99 out of 100 requests are this fast or faster. | 99 of 100 buses arrive within 12 minutes. |

## The fix in three rules

### Rule 1: Define "good request" precisely

Write down exactly what counts as a **good** request, and count speed and success **together**.

❌ **Wrong:** measure latency alone. A fast 500 error looks "good".

✅ **Right:** a request is good only if it **succeeded** and finished **within the time limit**. A timeout counts as bad. A real "sold out" answer counts as a correct product result, not a failure.

Also keep the two kinds of availability apart:

- **Time-based:** "what fraction of minutes was the service working?"
- **Request-based:** "what fraction of real requests succeeded?"

### Rule 2: Turn the percentage into a budget

The budget is just "100% minus the target":

- **Time-based**, 30-day month, 99.9%: 30 × 24 × 60 = 43,200 minutes. 0.1% of that = **43.2 minutes** of allowed downtime.
- **Request-based**, 99.9%: 0.1% of the **eligible** requests may fail. If there were 50 million, that's **50,000** failures allowed.

### Rule 3: Use the budget to make decisions

- Load-test the **peak**, and the peak **while a dependency is slow or broken**.
- Watch the **burn rate** over a short window and a long window. A fast burn means "fix it now". A slow, steady burn means "pause risky releases and do reliability work".

## Walk through a failure

Checkout starts returning fast 500 errors for 10 minutes during the evening peak.

1. **Latency-only view:** p99 is 40 ms. Looks wonderful. Wrong.
2. **Success + latency view:** good requests drop from 99.95% to 60%. Alert fires.
3. **Budget view:** at 1,000 requests/s, 10 minutes = 600,000 requests. 40% failed = **240,000 bad requests**. If the month has 2 billion eligible requests and the target is 99.9%, the budget is 2,000,000 failures. This one incident used **12%** of it.

Notice: 10 minutes at the **evening peak** hurt far more customers than 10 minutes at 3 a.m. would. Request-based budgets capture that; time-based budgets treat every minute the same.

## How to prove it works

1. **Draw a capacity curve:** increase load step by step and plot throughput, latency of good requests, and failures. Find where it bends.
2. **Test a short spike:** a 1-minute blip should not page someone at 3 a.m.
3. **Test a long outage:** a sustained failure must alert quickly.
4. **Check the outcome:** every target should lead to a clear action ("budget gone → freeze risky releases"). A number nobody acts on is just decoration.

### Check your understanding

How many failed requests are allowed among **ten million** eligible requests at **99.9%** success?

<details>
<summary>Show answer</summary>

Allowed failures = 100% − 99.9% = **0.1%**.

0.1% of 10,000,000 = 10,000,000 × 0.001 = **10,000 failed requests**.

Only **eligible** requests count: for example, invalid requests that are correctly rejected, or honest "sold out" answers, are left out of both the total and the failures.

</details>

---

## Going deeper

## Start with a promise, not a server count

An **SLI** is what we measure. An **SLO** is the target we set for ourselves. An **error budget** is how much failure that target allows.

**Example: checkout API**

| Question | Clear answer |
| --- | --- |
| How fast? | 99% of `POST /checkout` requests finish in under 800 ms. |
| How reliable? | 99.95% of valid requests succeed, over a 30-day window. |
| How much may fail? | About 22 minutes' worth of failures per month (0.05% × 43,200 min = 21.6 min). |
| What happens when the budget is gone? | Pause risky releases; spend effort on reliability. |

The important detail: a valid request that's turned down because the item is **truly sold out** is not an availability failure. The service did its job. Define the measurement carefully.

## A small capacity estimate

Suppose a ticket sale expects **2 million visits in one hour**, and the first **five minutes** bring **20%** of them.

```text
Opening rush = 400,000 visitors / 300 seconds
             ≈ 1,333 requests per second before retries and assets
```

Step by step:

1. 20% of 2,000,000 = 400,000 visitors.
2. 5 minutes = 300 seconds.
3. 400,000 ÷ 300 ≈ **1,333 visitors per second**.
4. If each visitor makes 3 API calls: 1,333 × 3 ≈ **4,000 requests per second**.

Notice the rush is **3×** busier than the hour's average (2,000,000 ÷ 3,600 ≈ 556 per second). Plan for the rush, not the average.

Then break it down further: how many are reads vs writes? Cache hits vs database queries? Queue messages? Bytes over the network? Add **headroom** for retries and for losing a server. A capacity plan is a **guess to be tested** with a load test, not a magic formula.

## Latency has a budget too

For an 800 ms checkout target, don't give every downstream service 800 ms each. Split it, like spending from one wallet:

```text
Gateway + validation: 100 ms
Inventory:              150 ms
Payment:                350 ms
Response + safety:      200 ms
```

Total: 100 + 150 + 350 + 200 = **800 ms**.

Pass **one deadline** down the whole request path. When the time left is too small, stop instead of starting work the caller has already given up on.

## L6 checklist

- State **peak and normal traffic**, read/write ratio, request size and how fast it grows.
- Name **p50, p95 and p99** latency targets. Averages hide the painful slow requests: if 99 requests take 100 ms and 1 takes 10 s, the average is 199 ms, which hides that 10-second wait.
- **Reserve room for failure:** a service with N servers should survive losing one server, one zone (a data-centre building) or one dependency, where that matters. Example: if you need 6 servers at peak, run at least 7.
- **Measure saturation** (how close to full each resource is): CPU, connection-pool use, how old the oldest queue message is, disk, provider quota, database locks.
- **Link cost to design:** caching, extra copies and multiple regions all cost money.

## From SLO to an operating decision

Say checkout has a **99.95%** monthly success target. That allows roughly **22 minutes' worth** of failed valid requests in a 30-day month.

It is **not** permission to schedule 22 minutes of downtime. Lots of short, repeated failures use the same budget. Define what's excluded carefully: an honestly sold-out item is a product result, a 500 error is a service failure.

Track two things:

- **Budget left this month** (like money left in the account).
- **Burn rate** (how fast it's going). A burn rate of **1** means you'd use exactly the whole budget by month's end. A burn rate of **10** means you'd use it all in about 3 days.

Worked example: at 99.95%, normally 0.05% of requests fail. If **5%** of requests fail for 10 minutes, that's 5 ÷ 0.05 = a **100× burn rate**. Ten minutes at 100× uses as much budget as 1,000 minutes (about 17 hours) of normal failure, roughly **2.3%** of the month's budget in 10 minutes.

| Burn | Meaning | Action |
| --- | --- | --- |
| Fast (e.g. 100× for minutes) | Something is badly broken right now. | Page someone, fix or roll back immediately. |
| Slow (e.g. 2× for days) | Steady leak; budget will run out early. | Pause risky changes, schedule reliability work. |

Using **two windows** (say, the last 5 minutes *and* the last hour) avoids paging people for a single short spike while still catching real outages fast.

## Capacity review checklist

| Layer | Ask |
| --- | --- |
| Edge | Can it absorb bots and static files (images, scripts) and rate-limit fairly? |
| App | Is there still headroom after losing one server or one zone? |
| Database | Are writes, locks and connection pools measured at peak? |
| Queue | Does the oldest message's age stay limited while a dependency is down? |
| Provider | Do we know its quotas, how it behaves on timeout, and our fallback? |

Load tests should include **failure cases**, not only the happy path: cache misses, one zone down, a slow database and pressure from retries.

## Quick recap

- 📏 **SLI** = what you measure, **SLO** = the target, **error budget** = the failure the target allows.
- ✅ **A good request** is successful *and* fast; fast errors still count as bad.
- 🧮 **Do the maths:** 99.9% of 30 days = 43.2 minutes; 99.9% of 10M requests = 10,000 failures allowed.
- 🔥 **Watch burn rate** in short and long windows: fast burn = act now, slow burn = slow down releases.
- 🏋️ **Plan for the rush plus a failure**, then prove it with a load test.
