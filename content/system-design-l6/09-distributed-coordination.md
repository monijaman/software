---
title: "Distributed Coordination: Consensus, Heartbeats and Gossip"
summary: "Computers that work together must agree on who is in charge, notice who has died and spot broken data. Use the right tool for each job, and never trust an old boss who wakes up late."
level: Advanced
tags: [system-design, consensus, raft, heartbeats, gossip, checksums]
---

## The story in one minute

You have **3 scheduler machines** (call them S1, S2, S3). One of them is the **leader**: the only one allowed to hand out jobs. Right now that is **S1**.

Here is what goes wrong, step by step:

1. S1 freezes for **20 seconds** (a long garbage-collection pause, or the network hiccups). It is not dead, just stuck.
2. S2 and S3 stop hearing from S1. They think "S1 must be dead" and pick **S2** as the new leader.
3. S2 starts handing out jobs.
4. S1 wakes up. It still *thinks* it is the leader, and it sends out the job writes it was in the middle of.
5. Now **two leaders** are giving orders. The same job may run twice, or two workers may overwrite each other.

The scary part: S1 did nothing "wrong" from its own point of view. It just woke up late. This lesson is about making that harmless.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Consensus** | A group of machines agreeing on one answer, decided by a **majority** (more than half). | A team vote: 2 of 3 people agree, so it's decided. |
| **Quorum** | The smallest group that counts as a majority (2 of 3, 3 of 5). | Enough people present for the meeting's vote to count. |
| **Heartbeat** | A small "I'm still alive" message sent every few seconds. | A friend texting "still here" every hour on a hike. |
| **Lease** | Permission to be in charge that runs out after a set time unless renewed. | A parking ticket that's valid for 1 hour. |
| **Fencing token** | A number that goes up every time a new owner is chosen. Bigger number = newer owner. | Ticket numbers at a deli: number 42 is served, 41 is old and ignored. |

## The fix in three rules

### Rule 1: A missed heartbeat is a guess, not proof

If S1's heartbeat is late, S1 *might* be dead. Or it might be slow, or the network might be broken between you and it. You can't tell from the outside.

❌ **Wrong:** "No heartbeat for 5 seconds, so S1 is dead. I'm the leader now."

✅ **Right:** treat a missed heartbeat as **suspicion**. Then use a proper **majority vote** (consensus, like Raft) to pick a new leader for a new **term** (a numbered "reign": term 7, term 8, ...). Only the machine a majority agrees on is leader for that term.

### Rule 2: Give every owner a number, and let the data check it

Each time a new leader or owner is chosen, it gets a bigger **fencing token**. S1 had token **41**. S2 now has **42**.

Every write carries its token. The place that stores the data remembers the biggest token it has seen and **refuses anything older**.

❌ **Wrong:** S1 checks "do I still hold the lock?" and then writes. It can freeze *between* the check and the write.

✅ **Right:** the **storage** checks the token as part of the write itself. When S1 wakes up and sends token 41, storage says "I've already seen 42. Rejected."

### Rule 3: Use the right tool for each question

Different problems need different tools. Mixing them up causes bugs.

- **Who is in charge?** Consensus (majority vote).
- **Is that machine probably alive?** Heartbeats.
- **Who is in the cluster?** Gossip (machines passing news to each other, like office gossip). It's fine if everyone learns the news a few seconds apart.
- **Did this data get damaged?** Checksums (a small "fingerprint" of the data).

A checksum tells you data got corrupted. It does **not** pick a leader, and it does **not** prove that a write was saved.

## Walk through a failure

S1 pauses. S2 becomes leader with token 42. S1 wakes up and sends a delayed write with token 41.

- ❌ If S1's **lease** is the only protection, nothing stops it. S1 doesn't know its lease ran out, because it was frozen while the clock ticked. The late write goes through.
- ✅ The storage compares tokens **as part of the write**: "41 is older than 42, reject." The old leader can't cause damage, even though it still believes it is in charge.

## How to prove it works

In a test environment, do this on purpose:

1. **Pause** the leader (freeze the process, don't kill it).
2. Wait until a **new leader** is elected.
3. **Resume** the old leader and let it try its writes.

Then check:

1. Every write from the old leader is **rejected** (look for "fencing rejection" counts).
2. A new owner takes over **within your target time** (for example, under 15 seconds).
3. Your dashboards show the **term change**, any moment where **no majority** was reachable, and the **rejected stale writes**.

### Check your understanding

Your scheduler uses only a Redis lock with a **TTL** (time to live: the lock deletes itself after, say, 30 seconds). What can go wrong?

<details>
<summary>Show answer</summary>

The lock holder can freeze for longer than 30 seconds. The lock expires, a second machine grabs it, and then the first machine wakes up and keeps working, thinking it still owns the lock. Now **two machines act as owner** at once.

A TTL lock only tells you "nobody *should* be holding this." It can't stop a late write that's already on its way. (Also, a single Redis server can crash or fail over and forget the lock.)

The fix: hand out a **fencing token** with the lock, and make the **storage** reject writes with an older token.

</details>

---

## Going deeper

## Different problems, different tools

![Distributed coordination: leader agreement, heartbeats, gossip membership and checksums solve different failure questions](/img/system-design-l6/coordination.svg)

| Problem | Tool | What it promises |
| --- | --- | --- |
| One agreed list of decisions, in order | Raft or Paxos-style consensus | A majority agreed. |
| Is a machine probably alive? | Heartbeat + timeout | A guess, not certainty. |
| Spread "who's in the cluster" across many machines | Gossip | Everyone *eventually* hears the same news. |
| Was data damaged by accident? | Checksum | Detects accidental changes. |

## How Raft works, in plain words

**Raft** is a popular consensus method. Think of it as a club with strict voting rules:

1. Machines vote to pick a **leader** for a numbered **term**.
2. The leader keeps a **log**: an ordered list of decisions ("job 9 goes to worker B").
3. A decision counts as **committed** (final) only after a **majority** of machines have saved a copy.

With 3 machines, 2 must agree. With 5 machines, 3 must agree. So a 5-machine group keeps working even if 2 machines die.

**The catch:** every decision waits for a majority to answer, which adds delay. Use Raft for a **small control center** (who's leader, cluster settings), not for millions of everyday writes per second.

## Why heartbeats can lie

Heartbeats can arrive late for boring reasons: a busy CPU, a slow network, a long pause. If you set the timeout too short, you'll "kill" healthy machines often. Too long, and real failures take ages to notice.

So heartbeats are good for **noticing trouble**. When a mistake could cause damage (like a double payout), add **leases and fencing tokens** on top.

## The stale-owner problem: a worked example

Worker A holds a lease to send a **payout**. Here's the timeline:

| Time | What happens |
| ---: | --- |
| 0 s | Worker A gets the lease with **token 41**. |
| 5 s | Worker A freezes. |
| 30 s | A's lease expires. Worker B gets a new lease with **token 42**. |
| 31 s | Worker B pays out and writes with token 42. Database remembers "42 is the newest." |
| 35 s | Worker A wakes up and tries to write with token 41. |

- Without fencing: A's write goes through. The payout happens **twice**. The lock didn't protect anything.
- With fencing: the database only accepts writes whose token is **at least as new** as the last one it accepted. 41 < 42, so A's write is **rejected**.

The token must **always go up** (it's *monotonically increasing*). That's what lets the database tell old from new.

## Use the smallest tool that works

Consensus is powerful, but it costs speed and extra work to run. Often something simpler is enough:

| What you need | Usually enough |
| --- | --- |
| Run one job every hour on exactly one machine | A row in your database that a worker "claims" with a lease + fencing token. |
| Find healthy machines to talk to | Heartbeats or gossip, then double-check before doing anything risky. |
| Store cluster settings everyone must agree on | A small Raft/consensus cluster (3 or 5 machines). |
| Protect a payment or stock-count write | A normal **atomic transaction** (all-or-nothing) in the database that owns that data. |

If one database already guards the rule (for example, "stock can't go below zero"), let it. Don't add consensus on top of a problem that's already solved.

## Quick recap

- 🗳️ **Consensus:** pick the leader and make key decisions by majority vote.
- 💓 **Heartbeats:** a late heartbeat means "maybe dead," never "definitely dead."
- 🎫 **Fencing tokens:** bigger number wins; the **storage** rejects old numbers.
- 📣 **Gossip and checksums:** gossip spreads membership news; checksums spot damaged data. Neither picks a leader.
