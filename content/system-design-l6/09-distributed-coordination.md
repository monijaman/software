---
title: "Distributed Coordination: Consensus, Heartbeats and Gossip"
summary: "Use strong agreement, lightweight failure detection, integrity checks and membership propagation for the right problems."
level: Advanced
tags: [system-design, consensus, raft, heartbeats, gossip, checksums]
---

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
