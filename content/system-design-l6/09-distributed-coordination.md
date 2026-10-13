---
title: "Distributed Coordination: Consensus, Heartbeats and Gossip"
summary: "Use strong agreement, lightweight failure detection, integrity checks and membership propagation for the right problems."
level: Advanced
tags: [system-design, consensus, raft, heartbeats, gossip, checksums]
---

> **How to read this lesson:** STAR means **Situation → Task → Action → Result**. The scenario and targets below are worked design assumptions, not claims of measured production results.

## S — Situation: the problem in context

Three scheduler nodes coordinate work. A network pause makes two nodes suspect the current leader is dead, although it is still running.

## T — Task: requirements and success criteria

Prevent conflicting task ownership while detecting failures quickly enough to recover work.

## A — Action: design the normal path

1. Use quorum-backed agreement for leader terms and durable decisions. A heartbeat timeout is suspicion, not proof of death.

2. Attach an increasing fencing token to work and require the destination to reject older tokens.

3. Use gossip for membership dissemination where temporary disagreement is acceptable. Checksums detect data corruption; they do not elect a leader or prove an operation committed.

### Walk through a failure and recovery

The old leader resumes after a new leader starts. A lease alone cannot stop its delayed write. The receiving store must check the fencing token as part of the write.

## R — Result: how to validate the design

Pause the leader, elect another and resume the old process. Verify stale writes are rejected and ownership recovers within the target interval. Observe term changes, quorum loss and fencing rejections.

### Check your understanding

What happens when the scheduler uses only a Redis lock with a TTL?

---

## Concepts and implementation details

## Different problems, different tools

![Distributed coordination: leader agreement, heartbeats, gossip membership and checksums solve different failure questions](/img/system-design-l6/coordination.svg)

| Problem | Tool | Guarantee |
| --- | --- | --- |
| One ordered configuration/log | Raft or Paxos-style consensus | Majority agreement |
| Is a node probably alive? | Heartbeat + timeout | Suspicion, not certainty |
| Spread membership at scale | Gossip | Eventual convergence |
| Was data corrupted? | Checksum | Detect accidental modification |

Raft elects a leader and commits a log entry after a majority replicates it. Use it for a small control plane, not as a free replacement for high-throughput data paths. Heartbeats can be late during pauses; use leases/fencing when an old owner could cause damage.

## The stale-owner problem

Worker A holds a lease to process a payout. It pauses for 30 seconds; its lease expires and Worker B receives a new lease. If A wakes and writes anyway, two workers act as owner. A lock alone did not protect the payout.

Use a monotonically increasing **fencing token**: A has token 41 and B has 42. The protected database accepts writes only when the token is newer than the last accepted token. Now an old owner cannot damage state after a pause or network split.

## Use the smallest tool

| Need | Usually enough |
| --- | --- |
| Run one periodic job | Database claim with lease + fencing. |
| Discover healthy peers | Heartbeats/gossip, then verify before action. |
| Store cluster configuration | Small Raft/consensus cluster. |
| Protect a payment/inventory write | Atomic transaction at the durable owner. |

Consensus is powerful but adds latency and operational work. Do not use it where a local transaction already owns the invariant.
