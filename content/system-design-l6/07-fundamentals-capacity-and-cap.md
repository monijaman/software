---
title: "Capacity, Availability, Latency and CAP"
summary: "The basic limits behind every design: how much traffic you get, how fast you answer, how often you're up, and what you do when parts of your system can't talk to each other."
level: Advanced
tags: [system-design, capacity, availability, latency, cap]
---

## The story in one minute

An online store gets **20 million** page reads a day. Its busiest moments are **10 times** the daily average. It keeps two copies of its database in two places.

Here is what goes wrong:

1. The team sized servers for the **average**, so peak hour feels sluggish.
2. One afternoon, the network link between the two database copies breaks. Each copy is still running, but they can't talk.
3. A phone has **1 unit** left. Copy A thinks "1 left" and sells it. Copy B also thinks "1 left" and sells it too.
4. Two customers paid for one phone.

Both problems came from not deciding ahead of time: "how busy will it get?" and "what do we do when the copies can't talk?"

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Throughput** | How much work gets done per second (e.g. requests per second, **RPS**). | Cars passing a toll booth per minute. |
| **Latency** | How long **one** piece of work takes. | How long **your** car takes to get through. |
| **Availability** | The share of time the system works and answers. | A shop that's open 99.9% of its opening hours. |
| **Network partition** | Parts of the system are running but can't reach each other. | Two bank branches whose phone line is cut. |
| **Consistency** (in CAP) | Every read sees the latest write, as if there were only one copy. | Both branches always agree on your balance. |

## The fix in three rules

### Rule 1: Do the numbers, starting from the peak

Average load:

**20,000,000 reads ÷ 86,400 seconds in a day ≈ 231 reads per second**

Peak is 10× that: **about 2,315 reads per second**.

Size for **2,315**, not 231. Then estimate the rest separately: bytes per request, how many users are connected at once, and growth over the next year.

### Rule 2: Set targets per action, not for the whole site

❌ **Wrong:** "The site has 99.9% availability and 200 ms average latency."

✅ **Right:** "**Checkout** succeeds 99.95% of the time with p99 under 800 ms. **Search** under 300 ms." (p99: 99 out of 100 requests are faster than this.)

Why? An average across all pages can look great while **checkout** is failing, because checkout is a small share of traffic.

### Rule 3: Decide, per action, what happens during a partition

When copies can't talk, you must pick for each action:

- **Answer anyway**, maybe with slightly old data, or
- **Refuse (or wait)** until you can be sure.

For the store:

- **Browsing the catalog:** answer from a cache (a stored copy). A slightly old product page is fine.
- **Reserving stock:** go only to the **one** owner of inventory. If you can't reach it safely, **refuse or wait** and tell the user "please try again".

## Walk through a failure

The link between copy A and copy B breaks during a stock update. Both think the last unit is free.

- ❌ Let both sides accept reservations on their own. Two buyers get one phone. The rule "never sell more than you have" is broken.
- ✅ Only the copy that is the **owner** of inventory may accept a reservation. The other side tells users "can't reserve right now, try again shortly." Browsing keeps working on both sides.

Your plan must say **which requests stop** and **what users see** during a partition.

## How to prove it works

Run a **partition drill**: cut the link between copies on purpose, in a test environment, and check:

1. Stock is **never** sold twice.
2. Browsing **keeps working** (measure its availability).
3. Reservations are **cleanly rejected** with a clear message (measure how many).

One common misunderstanding: CAP describes behaviour **during a partition**. It does **not** mean a healthy system permanently "picks only two" of three good things.

### Check your understanding

In this store, which action can serve old (stale) data during a partition, and how old is OK?

<details>
<summary>Show answer</summary>

**Catalog browsing and search** can serve stale data. A product description or a search result a few minutes old is fine, because the **checkout step checks the real price and stock** anyway. A team might set a bound like "at most 5 minutes old" (the exact number is a business choice you write down).

The **"in stock" badge** can be a little stale too, as long as reservation double-checks.

**Reserving stock** and **taking payment** must **not** be stale. A wrong "yes" means overselling or charging wrongly, so these should refuse or wait when the owner can't be reached.

</details>

---

## Going deeper

## Start with numbers

Estimate:

- **peak** requests per second,
- **bytes** per request,
- **read/write ratio** (how many reads per write),
- **storage growth**,
- **concurrent users** (users active at the same moment).

Remember the difference: **throughput** is work per second; **latency** is the time for **one** operation. A highway can carry many cars per hour (high throughput) while each car still takes 30 minutes (latency).

![Capacity and CAP: a design chooses latency targets, availability targets and a partition-time consistency policy](/img/system-design-l6/capacity-cap.svg)

## Availability in plain numbers

**Availability = time up ÷ (time up + time down)**

A month of 30 days has 30 × 24 × 60 = **43,200 minutes**.

| Target | Allowed downtime per 30-day month |
| --- | ---: |
| 99% | about 7 hours 12 minutes |
| 99.9% | about **43 minutes** |
| 99.99% | about 4.3 minutes |

Writing "99.9%" in a document doesn't make it true. **Spare copies** (redundancy) and **recovery you've actually tested** make it real.

## CAP in plain words

CAP stands for **C**onsistency, **A**vailability, **P**artition tolerance.

During a **network partition**, a system with copies of data **cannot guarantee both**:

- **C:** every read returns the latest value, **and**
- **A:** every request gets a successful answer.

You have to choose, and you can choose **differently for different data**:

- **Payments and inventory** usually **refuse** uncertain writes (choose C).
- **Feeds and counters** usually **show an older value** (choose A).

When there's **no** partition, the everyday trade-off is a different one: **speed vs. freshness**. Waiting for all copies to agree makes each request slower. (This extension of CAP is sometimes called **PACELC**: during a Partition, pick A or C; Else, pick Latency or Consistency.)

## Turning requirements into a first estimate

Say you have **1 million daily users**. Don't divide by 86,400 and call that your capacity. Find the peak:

1. If **15%** of users arrive in the same **10 minutes**: 1,000,000 × 0.15 = **150,000 users**.
2. Each makes **4 API calls**: 150,000 × 4 = **600,000 calls**.
3. Over 10 minutes (600 seconds): 600,000 ÷ 600 = **1,000 RPS**, before retries.
4. Split it: maybe **90% reads** (900 RPS) can come from cache, and **10% writes** (100 RPS) must reach the source of truth (the one place whose answer counts).

Estimate storage the same way:

```text
events per day × bytes per event × days kept × number of copies
```

Example: 10 million events/day × 1 KB × 365 days × 3 copies ≈ **11 TB**.

Treat every number as a **guess to test**, then load-test the real bottleneck.

## What happens to each kind of data when the network is unsure

| Data | If the network is uncertain | Why |
| --- | --- | --- |
| Seat reservation | Refuse, or wait briefly | A wrong "yes" sells one seat twice. |
| Bank balance | Refuse, or double-check | Showing the wrong money amount causes real harm. |
| Like count | Show an older number | Staying up matters more than being exact. |
| Product search | Show a slightly old index | Checkout will check the real price and stock later. |

Always say **what the user sees** during a failure. "Eventually consistent" (copies may disagree briefly but catch up later) is incomplete until you also say **what's visible** in the meantime and **how it gets repaired**.

## Quick recap

- 📈 **Size the peak:** 231 reads/s on average can mean 2,315 at peak.
- 🎯 **Targets per action:** checkout and search need their own goals; averages hide failures.
- ⏱️ **Know the budget:** 99.9% per month is about 43 minutes of downtime.
- 🔀 **CAP is about partitions:** per action, choose "answer with old data" or "refuse until sure".
- 👀 **Say what users see** during a failure, and how it's repaired.
