---
title: "Message Delivery: Queues, Kafka, Ordering and DLQs"
summary: "Choose an async mechanism and make duplicates, ordering, poison messages and replay explicit."
level: Advanced
tags: [system-design, kafka, queues, dlq, delivery, schema-evolution]
---

## The problem in context

An order event consumer updates a shipment record and crashes before committing its stream offset. A malformed event later blocks a partition.

## What must be true

Process retries safely, preserve the needed ordering scope and recover poison messages without silently losing business work.

## Practical response

1. Choose queues for independently leased tasks or a retained log for replay and ordered partition streams.

2. Key related events by order ID and deduplicate durable side effects with event ID. Commit a local effect plus processing marker atomically where possible.

3. Bound retries and quarantine poison events with original payload, error and metadata. Define who repairs and replays them, and what happens to later dependent events.

### Walk through a failure and recovery

After the crash, the same event is delivered again. The stored processing marker prevents a second local effect. Kafka transaction guarantees do not automatically cover an external email or payment call.

## How to prove it worked

Test crash-before-offset, duplicate delivery, out-of-order versions and dead-letter replay. Measure consumer lag, oldest failed event and duplicate side effects; a DLQ is pending repair, not successful processing.

### Check your understanding

If event version 4 fails, is it safe to process version 5 for that order?

---

## Concepts and implementation details

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

## Consumer behavior that survives crashes

Read an event, validate its schema, then make the business write idempotent before committing its offset/acknowledgment. If the process crashes after the write but before acknowledgement, it will receive the event again; the unique event ID or conditional state update makes the second attempt harmless.

For an order, partition by `order_id`. That preserves the history of one order while allowing many orders in parallel. A message for order A can overtake one for order B and that is usually fine. Global ordering is costly and rarely a product requirement.

## DLQ procedure

Do not automatically replay a poison message forever. Store its payload reference, error, attempts, consumer version and original position. Alert an owner, fix the code/data, replay in a controlled way, and measure the DLQ's oldest age. A growing DLQ is customer work stuck out of sight.
