---
title: "System Design Interview Framework"
summary: "A simple seven-step path that turns a vague question like 'design a chat app' into a clear design, with reasons for every choice."
level: Advanced
tags: [system-design, interviews, requirements, capacity, trade-offs]
---

## The story in one minute

The interviewer says: **"Design a messaging app."** That's it. No details.

Here is how it often goes wrong:

1. The candidate starts drawing boxes right away: "Load balancer, Kafka, Cassandra, Redis..."
2. After 20 minutes, the interviewer asks: "Is this for 2-person chats or groups of 100,000?" The candidate never asked. Half the design doesn't fit.
3. The interviewer asks: "What if a server crashes right after saving a message?" There's no answer, because the candidate was busy listing tools.
4. Time runs out. There's a big diagram, but no clear story of **why** anything is there.

The fix isn't knowing more tools. It's following a **clear order of steps**. This lesson gives you one.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Requirements** | What the system must do, and how well. | A shopping list before you go to the store. |
| **Capacity estimate** | Rough math on how much traffic and storage you need. | "8 guests × 2 slices = 16 slices, so 2 pizzas." |
| **Source of truth** | The one place whose data wins when copies disagree. | The bank's records, not your notes about your balance. |
| **Trade-off** | Getting one good thing by giving up another. | A faster train ticket costs more money. |
| **Deep dive** | Zooming in on the hardest part in detail. | A doctor checking the knee that hurts, not every bone. |

## The approach in three rules

### Rule 1: Ask before you draw

The first 5 minutes are for questions. Who uses it? Which part matters most? Then **agree** on the important promises out loud, for example:

- Messages are **never lost** once the sender sees "sent".
- Messages are **in order within one chat** (not across all chats in the world).
- New messages show up in **under 1 second** for online users.
- **Not in scope today:** voice calls, video, payments.

A handy way to organize your thinking is **Situation, Task, Action, Result**:

- **Situation:** who uses it, and what's the busiest workload?
- **Task:** what must be true (no lost messages, order per chat, speed)?
- **Action:** your estimates, APIs, data and main flow.
- **Result:** how you'd test it and what you'd measure.

### Rule 2: Draw one path, then go deep where it's risky

❌ **Wrong:** draw 15 boxes, explain none of them.

✅ **Right:** estimate peak traffic, define the **APIs** (the calls the app makes) and the **data keys** (how you look things up), then draw **one** path: "Alice sends, Bob receives." Then spend your deep dive on the **riskiest failure**.

### Rule 3: Finish with proof and limits

Save the last few minutes to say: "Here's how I'd test this, here's what I'd measure, here's where it stops scaling, and here's what I'd change next."

## Walk through a failure

This is the best way to show you really understand your design.

**Scenario:** a gateway server saves Alice's message, then **crashes before telling her** "sent."

A strong answer:

1. Alice's app never got the "sent" reply, so it **retries** with the **same message ID**.
2. The database already has that ID, so it **doesn't create a duplicate**. It just returns the saved message.
3. Bob's app reconnects to a different gateway and asks: "Give me everything after message #120" (a **cursor**). He gets the message even though the live push failed.

Explaining this clearly beats adding another box to the diagram.

## How to judge your answer

A good answer has all of these:

1. **Assumptions said out loud** ("I'm assuming groups up to 500 people").
2. **One source of truth** for messages.
3. **One normal flow**, explained step by step.
4. **One failure flow**, like the crash above.
5. **Measurable targets** ("99% of messages delivered in under 1 second").

In an interview, results are **what you would check**, not made-up production numbers. Say "I'd measure X," not "this achieves 99.999% uptime."

### Check your understanding

Practice a **2-minute** explanation of a chat app. Then name **one assumption** that, if it changed, would change your design.

<details>
<summary>Show answer</summary>

A sample 2-minute outline:

1. "Users send text messages in 1-to-1 chats and small groups (up to 500). Messages must never be lost once marked sent, and must be in order within each chat."
2. "Peak is about 100,000 messages per second."
3. "Phones keep a WebSocket open to a gateway. A message goes to the message service, is saved with a per-chat sequence number, then pushed to online recipients. Offline users get a push notification and fetch by cursor when they open the app."
4. "Retries are safe because each message has a client message ID with a unique constraint."
5. "I'd measure delivery time, undelivered-message age and gaps in sequence numbers."

An assumption that changes the design: **group size**. If a group can have **100,000 members**, you can't push to all of them during Alice's send request. You'd save the message once, then let background workers send it out in batches, and maybe have members pull new messages instead.

Other good answers: **end-to-end encryption** (the server can't read messages, so no server-side search) or **"keep messages forever"** (storage grows huge, so you need a plan for old data).

</details>

---

## Going deeper

![Interview flow: clarify requirements, estimate scale, draw the core path, then deep dive into risks and recovery](/img/system-design-l6/interview-framework.svg)

## The seven steps

1. **Clarify:** who are the users, what are the main actions, what's in and out of scope, how fast, how available, how consistent (does everyone need to see the same thing at the same moment?).
2. **Estimate:** busiest **RPS** (requests per second), storage, network **bandwidth** (data per second) and growth.
3. **Draw** the smallest path that does the main job.
4. **Model data:** what tables or records exist, and which one is the **source of truth** for each fact.
5. **Define APIs:** each call, who is allowed to make it (**authorization**), and how retries stay safe (**idempotency**).
6. **Deep dive** into the hardest rule or the tightest bottleneck.
7. **Close:** what breaks, how you'd watch it (**observability**), what it costs, and how it grows.

Say your assumptions out loud. Keep the first design **simple**. Name what you're **leaving for later**, and say which **number** would tell you a trade-off has stopped being OK.

## A worked estimate (step 2)

Rough math is enough. Example for chat:

| Fact | Number |
| --- | ---: |
| Daily active users | 10 million |
| Messages per user per day | 40 |
| Messages per day | 10M × 40 = **400 million** |
| Average per second | 400M ÷ 86,400 ≈ **4,600 /s** |
| Busiest moment (say 3× average) | ≈ **14,000 /s** |
| Storage per message (text + metadata) | ~200 bytes |
| Storage per day | 400M × 200 B = **80 GB /day** |

Now you know: one database won't hold years of data (80 GB × 365 ≈ 29 TB per year), so you'll need to split data across machines, probably by chat ID.

## A 45-minute plan

| Minutes | Do | Example question to ask yourself |
| ---: | --- | --- |
| 0–5 | Clarify the product and what "success" means | Is a late notification OK? |
| 5–10 | Estimate the peak and storage | What happens on a product launch day? |
| 10–20 | Draw one normal request path | Where is the source of truth? |
| 20–32 | Deep-dive the hardest rule | How do we stop a duplicate payment? |
| 32–40 | Break it on purpose | What if the payment provider times out? |
| 40–45 | Running it and growing it | Which number alerts us first? |

## Habits that make answers weak

| ❌ Weak | ✅ Strong |
| --- | --- |
| Opening with a list of trendy tools. | Opening with questions about users and promises. |
| "It's **exactly once**." | "Each message has a unique ID with a database constraint, so a retry can't create a second copy." |
| "We'll add a **cache**." | "We cache for 60 seconds. When data changes we delete the cached copy. A user may see old data for up to 60 seconds, which is OK here." |
| Ending mid-sentence when time runs out. | Ending with a decision: "I'm keeping this simple now. When the database passes 70% CPU, I'd split it by chat ID." |

## Quick recap

- ❓ **Ask first:** users, promises, scope. Say assumptions out loud.
- 🔢 **Estimate:** rough numbers tell you where the hard part is.
- ✏️ **One path, one deep dive:** explain the normal flow, then break it on purpose.
- 🏁 **Close with proof:** what you'd measure, and which number triggers the next change.
