---
title: "Message Delivery: Queues, Kafka, Ordering and DLQs"
summary: "Choose an async mechanism and make duplicates, ordering, poison messages and replay explicit."
level: Advanced
tags: [system-design, kafka, queues, dlq, delivery, schema-evolution]
---

## A queue is not always Kafka

A work queue usually means "one worker should handle this job." Kafka is a durable, partitioned event log: several consumer groups can independently read the same event and replay history. Both can decouple services, but they solve different problems.

**Example: order placed**

```text
Order database + outbox row (one transaction)
              -> event stream: OrderPlaced(order_id, version, event_id)
                 -> inventory consumer group
                 -> email consumer group
                 -> analytics consumer group
```

The outbox prevents the classic gap where the order commits but the process crashes before publishing its event.

## Delivery language matters

| Term | Real meaning | Consumer responsibility |
| --- | --- | --- |
| At-most-once | May lose a message, no retry | Accept loss only when safe. |
| At-least-once | May receive duplicates | Deduplicate with a durable event ID/unique rule. |
| Exactly-once effect | The business outcome happens once | Usually needs idempotent writes plus transaction boundaries. |

Do not promise global ordering unless you can name the ordering key. Partitioning by `order_id` can preserve order for that order, but not across all orders.

## Poison messages and change

After bounded retries, place an unprocessable message in a **dead-letter queue (DLQ)** with error and attempt data. A DLQ is not a trash can: alert on it, fix/replay it and expire it deliberately.

Events should have a schema version. Add optional fields compatibly first; do not silently change what `amount` means. Consumers can be older than producers during a gradual deployment.
