---
title: Brokers, Replication & Durability
summary: How Kafka survives server failures. Brokers, leaders and followers, in-sync replicas, min.insync.replicas, leader election and KRaft, drawn step by step.
level: Intermediate
tags: [kafka, replication, brokers, isr, kraft, durability]
---

## The big idea

Important documents are kept in **several safes in different buildings**. One copy is the **master** that everyone writes to; the others are **copies** kept up to date. If the building with the master burns down, one of the up-to-date copies becomes the new master, and work continues.

In Kafka, every partition has one **leader** replica and several **follower** replicas on different brokers.

![Each partition has a leader and followers on different brokers](/img/kafka/replication.svg)

## Brokers and clusters

- A **broker** is a Kafka server. It stores partition replicas and serves producers and consumers.
- A **cluster** is a group of brokers (3 at minimum for production; large clusters run hundreds).
- Partitions and their replicas are **spread across brokers** so load and risk are shared.

## Replication factor

`replication.factor=3` means every partition has **3 copies** on 3 different brokers: one leader + two followers.

```mermaid
flowchart TB
    subgraph B1["🖥️ Broker 1"]
      P0L["P0 👑 leader"]
      P1F1["P1 follower"]
      P2F1["P2 follower"]
    end
    subgraph B2["🖥️ Broker 2"]
      P0F1["P0 follower"]
      P1L["P1 👑 leader"]
      P2F2["P2 follower"]
    end
    subgraph B3["🖥️ Broker 3"]
      P0F2["P0 follower"]
      P1F2["P1 follower"]
      P2L["P2 👑 leader"]
    end
```

- **Producers write** to the leader.
- **Followers fetch** from the leader to stay in sync.
- **Consumers read** from the leader by default (or from a nearby follower, with rack-aware settings).
- Leadership is spread so each broker leads some partitions.

## In-sync replicas (ISR)

A follower is **in sync** if it has caught up with the leader recently (within `replica.lag.time.max.ms`, 30 s by default). The leader plus all caught-up followers form the **ISR** (in-sync replica set).

```mermaid
flowchart LR
    L["👑 Leader<br/>offsets 0-100"] --> F1["Follower A<br/>0-100 ✅ in ISR"]
    L --> F2["Follower B<br/>0-62 🐢 fell behind<br/>removed from ISR"]
```

## The durability trio ⭐

These three settings together decide whether an acknowledged write can ever be lost:

| Setting | Where | Recommended |
| --- | --- | --- |
| `replication.factor` | Topic | **3** |
| `min.insync.replicas` | Topic / broker | **2** |
| `acks` | Producer | **all** |

With these, a write is acknowledged only when **at least 2 replicas** have it. So:

| Brokers down | Can still write? | Data lost? |
| --- | --- | --- |
| 0 | ✅ | No |
| 1 | ✅ (2 replicas left in sync) | No |
| 2 | ❌ Producers get `NotEnoughReplicas` (writes pause) | No |

```mermaid
flowchart LR
    Q{"Is ISR size ≥ min.insync.replicas?"} -->|yes| W["✅ Accept writes with acks=all"]
    Q -->|no| R["⛔ Reject writes<br/>(better than silently risking data loss)"]
```

> 💡 Kafka chooses **consistency over availability** here: with too few in-sync copies, it refuses writes rather than risk losing confirmed data.

## When a broker fails: leader election

```mermaid
sequenceDiagram
    participant P as Producer
    participant B1 as Broker 1 (leader of P0)
    participant B2 as Broker 2 (follower, in ISR)
    participant C as Controller
    P->>B1: writes to P0
    Note over B1: 💥 crashes
    C->>C: detects missing heartbeats
    C->>B2: you are the new leader of P0 👑
    P->>B2: producer refreshes metadata, keeps writing
    Note over B1: later: B1 restarts, catches up as a follower
```

Only replicas **in the ISR** can become leader, so the new leader has every acknowledged record. (Setting `unclean.leader.election.enable=true` allows an out-of-sync replica to become leader: more available, but it **can lose data**. Keep it `false` for important topics.)

## The controller and KRaft

One broker acts as the **controller**: it tracks which brokers are alive and elects partition leaders.

```mermaid
flowchart LR
    subgraph Old["Before: ZooKeeper"]
      ZK[(ZooKeeper ensemble)] <--> KB1[Brokers]
    end
    subgraph New["Now: KRaft (Kafka 3.3+, required in 4.0)"]
      CQ["Controller quorum<br/>(Raft consensus)"] <--> KB2[Brokers]
    end
```

Kafka used to depend on a separate **ZooKeeper** cluster for metadata. **KRaft** mode moves metadata into Kafka itself using the **Raft** consensus algorithm: one fewer system to run, faster failover, and support for millions of partitions. Kafka 4.0 removed ZooKeeper entirely.

## Racks and regions

- **Rack awareness** (`broker.rack`): Kafka places replicas in different racks or availability zones, so losing a whole zone doesn't lose a partition.
- **Multi-region:** tools like **MirrorMaker 2** or Cluster Linking copy topics between clusters for disaster recovery and geo-locality.

```mermaid
flowchart LR
    subgraph AZ1["Zone A"]
      BA["Broker 1<br/>P0 👑"]
    end
    subgraph AZ2["Zone B"]
      BB["Broker 2<br/>P0 copy"]
    end
    subgraph AZ3["Zone C"]
      BC["Broker 3<br/>P0 copy"]
    end
    BA --> BB & BC
```

## Key takeaways

- A cluster is a group of **brokers**; each partition has one **leader** and several **followers** on different brokers.
- The **ISR** is the set of replicas that are caught up with the leader.
- `replication.factor=3` + `min.insync.replicas=2` + `acks=all` = no acknowledged data loss when one broker fails.
- When a leader dies, the controller elects a new leader from the ISR.
- **KRaft** replaced ZooKeeper; rack awareness spreads replicas across failure zones.
