---
title: "The L6 System-Design Thinking Loop"
summary: "A simple routine for any design question: say what must never break, size the busiest moment, plan for things going wrong, and show how you'd prove it works."
level: Advanced
tags: [system-design, staff, l6, reliability, interviews]
---

## The story in one minute

A concert puts **50,000 seats** on sale at noon. In the first **5 minutes**, **500,000 people** open the site. Some double-click "Pay". Some refresh the page when it feels slow.

Here is what goes wrong in a design that only thinks about the happy path:

1. The team picks tools first ("let's use Kafka and Redis") without saying what must never break.
2. The seat page and the "buy" button share the same busy database, so browsing slows down buying.
3. A buyer clicks "Pay", the card is charged, and then the server crashes before saving the result.
4. The buyer retries. The system has no memory of the first try, so it **charges the card again**, or it gives the seat to someone else.

The design looked fine on a whiteboard. It broke on the one bad moment that mattered. This lesson gives you a routine that finds those moments **before** they happen.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Invariant** | A rule that must **always** be true, no matter what. | "A theater seat has at most one ticket holder." |
| **Peak** | The busiest moment, not the average. | The checkout lines on the day before a holiday. |
| **Failure window** | The short gap where a crash leaves things half-done. | You paid at the counter, then the receipt printer jammed. Did they record it? |
| **Reconcile** | Compare two records and fix any mismatch. | Checking your bank app against your receipts at month end. |
| **Blast radius** | How much else breaks when one part breaks. | One blown fuse turning off the whole house instead of one room. |

## The fix in four rules

### Rule 1: Say what must never break, first

Before drawing any boxes, write the promise in one plain sentence.

❌ **Wrong:** "We'll use a queue and a cache for scale."

✅ **Right:** "One seat is sold **at most once**. One payment attempt causes **at most one** charge. The seat map may be a few seconds old; a **confirmed** seat may not be wrong."

Notice the second half. It also says what is **allowed** to be slightly out of date. That tells you where you can cheat for speed.

### Rule 2: Size the busiest moment, not the day

500,000 people in 5 minutes (300 seconds) is:

**500,000 ÷ 300 ≈ 1,667 buyers per second**, before anyone retries.

Now split the work in two:

- **Browsing** the seat map: lots of reads, can come from a cache (a fast copy of data kept close by).
- **Reserving** a seat: a write that must hit the real database (the *source of truth*, the one place whose answer counts).

Keep these apart so a flood of browsing can't slow down buying.

### Rule 3: Let the database decide who wins

A **queue** (a waiting line) is useful to control how many people are let in at once. But a queue **cannot** decide who owns the last seat. Only one place can: the real database, using a **conditional write** ("give seat 12 to Ana **only if** it is still free").

### Rule 4: Save your intent before you call anyone outside

Before you contact the payment company, **write down** "I am about to charge Ana ৳X for seat 12, attempt ID abc". Then, in the same database step that confirms the seat, also save a note saying "send a receipt" (this note table is called an **outbox**). A separate worker reads the outbox and sends receipts, and it can retry on its own without touching payments.

## Walk through a failure

The payment company charges the buyer. Then our server crashes before it saves "paid".

- ❌ **Blind retry:** charge again. Now the buyer paid twice.
- ❌ **Blind release:** "We don't know if they paid, so free the seat." Now someone else can buy a seat that was already paid for.
- ✅ **Look it up:** on retry, find the same saved attempt (ID abc). Ask the payment company "what happened to abc?" and **reconcile**. Keep the seat held while the answer is unknown.

## How to prove it works

In a test environment:

1. Send **many buyers at the same last seat** at the same moment. Exactly **one** must win.
2. **Crash the server on purpose** right after the payment company says "charged". There must be **no second charge**.
3. Check that every "unknown" payment gets **resolved within a set time** (for example, 10 minutes).

### Check your understanding

Arrivals triple, from about 1,667 to about 5,000 buyers per second. Which work can wait, and which database write must stay all-or-nothing?

<details>
<summary>Show answer</summary>

**Can wait or be cut back:** receipt emails, analytics, recommendations, seat-map refresh (show a slightly older map), and other nice-to-haves. Put them in a queue or turn them off for now.

**Must stay all-or-nothing (atomic):** the seat reservation. "Mark seat 12 as Ana's **only if** it's free" must happen in **one** database step, together with creating the payment attempt record. If you split it into "check, then write", two buyers can both see "free" and both get the seat.

More traffic changes **how many** people you let in at once. It never changes the rule that one seat has one owner.

</details>

---

## Going deeper

## The big idea

A strong senior (L6, Staff-level) answer is **not** a list of technologies. It explains:

- what must **never** break,
- what changes at the **busiest** moment,
- what happens when something you depend on **fails**.

Think of an airport. Nobody judges it only on sunny days. It must keep people safe in a storm, use another runway when one is closed, and tell passengers what happens next.

![The L6 design loop: invariant first, then scale, failure, recovery and blast radius](/img/system-design-l6/design-loop.svg)

## Five questions before drawing boxes

| Question | Why it matters | Example |
| --- | --- | --- |
| **Invariant:** what must always be true? | It defines "correct". | A card is never charged twice. |
| **Peak:** how busy is the worst moment? | The average hides the real limit. | 2 million checkouts in 5 minutes. |
| **Failure window:** where can a crash leave work half-done? | That's where duplicates and lost work hide. | The charge succeeds, then the app crashes before saving. |
| **Recovery:** how do we fix it after? | Retries need facts, not guesses. | Ask the payment company using the same attempt key. |
| **Blast radius:** what else gets hurt? | Shared parts spread trouble. | A big data export uses up all of checkout's database connections. |

## A simple answer shape

Use these five steps for almost any design question:

1. State your **assumptions** and the **invariant**.
2. Draw the **smallest design** that works on a normal day.
3. Name the **first thing that breaks** at peak.
4. Walk through **one** crash, timeout or retry.
5. Explain what you'd **measure**, the quick fix during an incident, and the lasting fix.

> 💡 A good trade-off is specific. "I accept that your playback position may be a few seconds behind, so that video keeps playing" is much stronger than "eventual consistency is fine". (*Eventual consistency* means copies of data may disagree for a short time but catch up later.)

## A complete example, start to finish

**Prompt:** "Design checkout for a ticket sale."

**1. Plain promise.** A buyer can reserve one seat, pay once, and get a clear result. The key rule is **not** "use Kafka". It is: **one seat is sold at most once, and one payment attempt causes at most one charge.**

**2. Size the scary moment.** 500,000 people in 5 minutes. The first limit is the **seat-reservation write**. So keep browsing, recommendations, email and analytics **away** from that write. A queue can smooth out the non-urgent work, but it can't decide who owns the last seat.

**3. Tell the failure story.** Payment may succeed while the reply gets lost. So:

- save a lasting payment attempt with an **idempotency key** (a unique ID for this one attempt, so repeats are recognized as the same thing),
- if the call times out, mark the attempt `UNKNOWN`,
- **reconcile** with the payment company instead of charging again.

## What a strong design review asks

| Question | Good answer |
| --- | --- |
| Where does the truth live? | The reservation and payment database, not a cache or a dashboard. |
| What may be a little out of date? | Seat counts on the browse page and recommendations. **Not** who owns a seat. |
| What do we switch off first when overloaded? | Analytics, emails, previews, then low-priority browsing. |
| How do we know it works? | Count reservation conflicts, how old the oldest unresolved charge is, checkout success rate, and p99 latency (the time that 99 out of 100 requests beat). |

Use this loop for every lesson in this course: **name the promise, show the normal path, break one thing, then explain recovery and how you'd prove it.**

## Quick recap

- 🎯 **Promise first:** write what must never break, and what may be slightly stale.
- 📈 **Size the peak:** 500,000 in 5 minutes is about 1,667 per second, before retries.
- 🗄️ **The database decides:** a queue controls the crowd, a conditional write picks the winner.
- 🔁 **Unknown means look it up:** never blindly re-charge or blindly release.
- ✅ **Prove it:** race for the last seat, crash on purpose, and time how fast unknowns get resolved.
