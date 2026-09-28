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
