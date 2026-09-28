---
title: Consumers & Consumer Groups
summary: How consumers read in parallel with consumer groups, how partitions are assigned and rebalanced, how offsets are committed, and how to handle lag, errors and retries.
level: Intermediate
tags: [kafka, consumer, consumer-group, offsets, rebalance]
---

## The big idea

A pile of mail must be sorted. **One person** can do it alone, slowly. A **team** can split the pile so each person takes a few mail bags, and nobody sorts the same bag twice. If someone goes home, their bags are handed to the others. A **different team** (say, the auditors) can read the same mail independently, without affecting the sorters.

- The team = a **consumer group**.
- The mail bags = **partitions**.
- Each team member = a **consumer**.

![A consumer group splits partitions among its members; another group reads independently](/img/kafka/consumer-groups.svg)

## Consumer groups: the rules

1. Each partition is read by **exactly one consumer in a group** at a time.
2. One consumer can read **several partitions**.
3. **Different groups** each get **all** the messages, independently, with their own offsets.

```mermaid
flowchart LR
    subgraph Topic["Topic: orders (4 partitions)"]
      P0[P0]
      P1[P1]
      P2[P2]
      P3[P3]
    end
    subgraph G1["Group: email-service"]
      C1[consumer 1]
      C2[consumer 2]
    end
    subgraph G2["Group: analytics"]
      C3[consumer 1]
    end
    P0 & P1 --> C1
    P2 & P3 --> C2
    P0 & P1 & P2 & P3 -.-> C3
```

### Scaling a group

| Consumers in the group | 4 partitions → |
| --- | --- |
| 1 | That consumer reads all 4 |
| 2 | 2 partitions each |
| 4 | 1 partition each ✅ maximum parallelism |
| 6 | 4 busy, **2 idle** ❌ (no partition left for them) |

> 💡 **The number of partitions is the maximum parallelism of a consumer group.** Plan partitions for the number of consumers you'll need at peak.

## Offsets and commits

Each group stores, per partition, the **offset of the next record to read**. This is the **committed offset**, saved in Kafka's internal `__consumer_offsets` topic. If a consumer crashes, its replacement continues from the last committed offset.

```mermaid
flowchart LR
    subgraph P["Partition 0"]
      direction LR
      r0[0 ✓] --> r1[1 ✓] --> r2[2 ✓] --> r3[3 ⏳] --> r4[4] --> r5[5]
    end
    CO["committed offset = 3<br/>(next to read)"] -.-> r3
```

### When to commit decides your guarantee

```mermaid
flowchart TB
    subgraph Before["Commit BEFORE processing"]
      b1[read] --> b2[commit] --> b3["process 💥 crash"]
      b3 --> b4["message LOST<br/>(at-most-once)"]
    end
    subgraph After["Commit AFTER processing ✅"]
      a1[read] --> a2["process ✅"] --> a3["commit 💥 crash"]
      a3 --> a4["message processed AGAIN<br/>(at-least-once)"]
    end
```

The standard choice is **at-least-once**: process, then commit, and make processing **idempotent** so a repeat does no harm.

```js
const consumer = kafka.consumer({ groupId: "email-service" });
await consumer.connect();
await consumer.subscribe({ topic: "shop.orders.placed" });

await consumer.run({
  autoCommit: false,
  eachMessage: async ({ topic, partition, message }) => {
    const eventId = message.headers.eventId.toString();
    if (!(await processedEvents.has(eventId))) {         // idempotency check
      await sendOrderConfirmation(JSON.parse(message.value.toString()));
      await processedEvents.add(eventId);
    }
    await consumer.commitOffsets([
      { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }, // commit the NEXT offset
    ]);
  },
});
```

> ⚠️ Auto-commit (the default in many clients) commits on a timer, **regardless** of whether processing finished. Understand it before relying on it.

## Rebalancing

When a consumer **joins**, **leaves** or **crashes**, the group **rebalances**: partitions are reassigned among the remaining members.

```mermaid
sequenceDiagram
    participant C1 as Consumer 1
    participant C2 as Consumer 2
    participant GC as Group coordinator (broker)
    Note over C1,C2: C1 has P0, P1 · C2 has P2, P3
    C2--xGC: stops sending heartbeats 💀
    GC->>C1: rebalance!
    Note over C1: C1 now has P0, P1, P2, P3
    Note over C1: resumes P2, P3 from their committed offsets
```

- A consumer is considered dead if it misses heartbeats for `session.timeout.ms`, or doesn't call `poll` within `max.poll.interval.ms` (processing too slowly!).
- Older **eager** rebalancing stopped the whole group; modern **cooperative** rebalancing moves only the affected partitions.
- **Static membership** (`group.instance.id`) avoids rebalances when a pod simply restarts.

## Consumer lag: the key health metric

**Lag** = latest offset in the partition − committed offset of the group. It tells you how far behind a consumer is.

```mermaid
xychart-beta
    title "Consumer lag during a traffic spike"
    x-axis ["09:00", "09:05", "09:10", "09:15", "09:20", "09:25"]
    y-axis "messages behind" 0 --> 50000
    line [200, 300, 42000, 35000, 12000, 400]
```

Growing lag means consumers can't keep up: **add consumers** (up to the partition count), speed up processing, or process in batches. Alert on lag that keeps growing. Tools: Burrow, Kafka UI, Prometheus exporters.

## Handling failures: retries and dead-letter topics

What if a message **can't** be processed (bad data, a downstream API is down)? Don't block the partition forever.

```mermaid
flowchart LR
    T[orders] --> C[Consumer]
    C -->|transient error| R1["orders.retry.1m"]
    R1 -->|after delay| C
    C -->|still failing / bad data| DLT[("☠️ orders.dlt<br/>dead-letter topic")]
    DLT --> Ops["👩‍💻 inspect, fix, replay"]
```

- Retry **transient** errors a few times with backoff (in-process, or through retry topics).
- Send **poison messages** to a **dead-letter topic** with error details in headers, then move on.
- Monitor the DLT and replay messages after fixing the bug.

## Consumer checklist

- [ ] One group per logical application (`email-service`, `analytics`)
- [ ] Commit after processing; make processing idempotent
- [ ] Keep processing time under `max.poll.interval.ms`, or process asynchronously in batches
- [ ] Monitor consumer lag and alert on growth
- [ ] Retry transient errors; dead-letter poison messages
- [ ] Graceful shutdown: finish the current batch, commit, leave the group

## Key takeaways

- A **consumer group** shares a topic's partitions: each partition goes to one consumer in the group.
- Different groups read the same data independently, each with its own **committed offsets**.
- Partitions cap parallelism; extra consumers sit idle.
- Commit **after** processing for at-least-once, and make handlers idempotent.
- Rebalances reassign partitions when members change; watch **lag**; use dead-letter topics for poison messages.
