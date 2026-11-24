---
title: Kafka for Backend Services
summary: "Use Apache Kafka in real backend code: when to reach for it, designing events, topics and keys, publishing safely with the transactional outbox, idempotent consumers, retries and dead-letter topics, ordering, graceful shutdown, schema evolution, testing, tracing, and common backend patterns, with Node.js/TypeScript examples and interview questions."
level: Advanced
tags: [backend, kafka, event-driven, messaging, outbox, idempotency, nodejs]
---

## The big idea

Lesson 7 showed **queues** (RabbitMQ): a message is a **task** that one worker takes and then it's gone. **Kafka** is different: it's a **durable, ordered log of events**. Many services can read the same events, each at its own pace, and events can be **replayed** later.

Think of it like this:

- A **queue** is a **to-do list**: a job is crossed off when someone does it.
- **Kafka** is a **newspaper archive**: every edition is kept, any number of readers can read it, and a new reader can start from last year's editions.

This lesson is about **writing backend services that use Kafka correctly**. The concepts behind it (partitions, offsets, consumer groups, replication, delivery guarantees) are explained step by step in the **Apache Kafka** section. Start with [What Is Apache Kafka?](/learn/kafka/what-is-kafka) if those words are new.

![An Orders API writes the order and an outbox row in one database transaction; a relay publishes to the orders topic; Payments, Email and Search consumer groups each read every event independently and idempotently](/img/backend/kafka-backend-flow.svg)

## When should a backend use Kafka?

| Use Kafka when… | Example |
| --- | --- |
| **Several services** react to the same event | `OrderPlaced` → payments, email, analytics, search index |
| You need **replay** | Rebuild a search index or a new read model from past events |
| **High throughput** | Clicks, logs, IoT readings, tens of thousands of events per second |
| **Ordering per entity** matters | All events of order `o-123` must be processed in order |
| You stream data **between systems** | Database changes (CDC) → data warehouse |

Prefer something simpler when:

| Need | Better fit |
| --- | --- |
| Background jobs for one app (send email, resize image) | A job queue: RabbitMQ, SQS, BullMQ (Redis) |
| Delayed or scheduled jobs, per-message priorities | RabbitMQ, SQS, a job scheduler |
| A synchronous answer for the user ("is this card valid?") | A normal HTTP/gRPC call |
| Small team, low volume, no replay needed | A queue, or a Postgres table polled by a worker |

> 💡 Kafka shines as the **event backbone** between services. It's a poor replacement for a simple job queue or for request/response calls.

## Commands vs events

| | Command | Event |
| --- | --- | --- |
| Meaning | "Please do this" | "This happened" |
| Name | Imperative: `ChargeCard`, `SendEmail` | Past tense: `OrderPlaced`, `PaymentFailed` |
| Receivers | Exactly one handler | Zero, one or many subscribers |
| Can it be refused? | Yes | No, it's a fact |
| Best transport | Queue or direct call | **Kafka topic** |

Kafka works best with **events**. The producer doesn't know or care who listens, which keeps services decoupled: you can add a new `loyalty-service` next year without touching the Orders service.

## Designing events

### A standard event envelope

Give every event the same outer shape, so tooling, logging and consumers can handle any event:

```json
{
  "eventId": "7f1c2a9e-3b0d-4b8e-9a51-2f6c1d0e8a44",
  "eventType": "OrderPlaced",
  "schemaVersion": 2,
  "occurredAt": "2026-11-25T09:14:03.512Z",
  "source": "orders-service",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "data": {
    "orderId": "o-123",
    "customerId": "c-42",
    "totalCents": 4599,
    "currency": "EUR",
    "items": [{ "sku": "BOOK-1", "qty": 1, "priceCents": 4599 }]
  }
}
```

| Field | Why |
| --- | --- |
| `eventId` | Unique ID so consumers can **deduplicate** |
| `eventType` + `schemaVersion` | Consumers know how to parse it |
| `occurredAt` | When it happened in the business, not when it was read |
| `source` | Who produced it (debugging) |
| `traceId` | Follow one request across services |
| `data` | The business payload |

### Thin or fat events?

| Style | Payload | Pros | Cons |
| --- | --- | --- | --- |
| **Event notification** (thin) | `{ orderId: "o-123" }` | Small, no stale data | Every consumer calls the Orders API back → coupling and load |
| **Event-carried state transfer** (fat) | Full order details | Consumers work alone, even if Orders is down | Bigger messages, schema must be maintained |

Most teams use **fat-enough** events: include what typical consumers need, so they don't have to call back.

### Topic naming and keys

- Name topics consistently, for example `<domain>.<entity>.<event>`: `shop.orders.placed`, or one topic per entity: `shop.orders` with many event types.
- Events that must stay **in order** relative to each other must go to the **same topic and same key**.
- The **key** decides the partition, and ordering is only guaranteed **within a partition**. Use the entity ID: `orderId`, `customerId`, `accountId`.

| Key | Result |
| --- | --- |
| `orderId` | All events of one order in order ✅ |
| `null` (no key) | Spread across partitions, **no ordering** |
| `country` | Hot partition: most traffic might be one country ❌ |

More detail: [Topics, Partitions & Offsets](/learn/kafka/topics-partitions-offsets).

## Local setup: one-node Kafka for development

```yaml
# docker-compose.yml (development only: one broker, no security)
services:
  kafka:
    image: apache/kafka:4.0.0
    ports: ["9092:9092"]
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 1
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 1
```

```bash
docker compose up -d
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --create --topic shop.orders --partitions 6 --replication-factor 1
npm install kafkajs pg
```

> ℹ️ Examples use **KafkaJS** because its API is short and readable. For new production Node.js services, also look at **`@confluentinc/kafka-javascript`** (actively maintained, based on librdkafka, with a KafkaJS-compatible API). The patterns below are the same in every client: Java (Spring Kafka), Go (franz-go, confluent-kafka-go), Python (confluent-kafka).

For running a real multi-broker cluster, see [Running Kafka in Production](/learn/linux-devops/running-kafka-in-production).

## Step 1: Publish events safely (the dual-write problem)

The most common Kafka bug in backend code:

```ts
// ❌ Two separate writes: they can disagree
await db.query("INSERT INTO orders ...");
await producer.send({ topic: "shop.orders", messages: [...] });   // what if this fails?
```

| What happens | Result |
| --- | --- |
| DB insert succeeds, Kafka send fails | Order exists, but payments and email never hear about it |
| Kafka send succeeds, DB transaction rolls back | Everyone processes an order that doesn't exist |
| Process crashes between the two lines | Same as the first row |

You can't put a database and Kafka in one transaction. The fix is the **transactional outbox**: write the event to a table **in the same database transaction**, and let a separate relay publish it.

```sql
CREATE TABLE outbox (
  id            UUID PRIMARY KEY,
  aggregate_id  TEXT        NOT NULL,       -- becomes the Kafka key
  topic         TEXT        NOT NULL,
  event_type    TEXT        NOT NULL,
  payload       JSONB       NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at  TIMESTAMPTZ
);
CREATE INDEX outbox_unpublished ON outbox (created_at) WHERE published_at IS NULL;
```

```ts
// orders-service/src/placeOrder.ts
import { randomUUID } from "node:crypto";
import { pool } from "./db";

export async function placeOrder(input: { customerId: string; items: Item[] }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orderId = `o-${randomUUID()}`;
    const totalCents = input.items.reduce((sum, i) => sum + i.qty * i.priceCents, 0);
    await client.query(
      "INSERT INTO orders (id, customer_id, total_cents, status) VALUES ($1, $2, $3, 'PLACED')",
      [orderId, input.customerId, totalCents],
    );

    const event = {
      eventId: randomUUID(),
      eventType: "OrderPlaced",
      schemaVersion: 2,
      occurredAt: new Date().toISOString(),
      source: "orders-service",
      data: { orderId, customerId: input.customerId, totalCents, currency: "EUR", items: input.items },
    };
    await client.query(
      "INSERT INTO outbox (id, aggregate_id, topic, event_type, payload) VALUES ($1, $2, $3, $4, $5)",
      [event.eventId, orderId, "shop.orders", event.eventType, event],
    );

    await client.query("COMMIT");          // order + event saved together, or not at all
    return { orderId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
```

The **relay** reads unpublished rows and sends them to Kafka:

```ts
// orders-service/src/outboxRelay.ts
import { Kafka } from "kafkajs";
import { pool } from "./db";

const kafka = new Kafka({ clientId: "orders-outbox-relay", brokers: ["localhost:9092"] });
const producer = kafka.producer({ idempotent: true });   // no duplicates from producer retries

export async function runRelay() {
  await producer.connect();
  while (true) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // SKIP LOCKED lets several relay instances run without picking the same rows
      const { rows } = await client.query(
        `SELECT id, aggregate_id, topic, event_type, payload FROM outbox
          WHERE published_at IS NULL ORDER BY created_at LIMIT 100
          FOR UPDATE SKIP LOCKED`,
      );
      for (const row of rows) {
        await producer.send({
          topic: row.topic,
          acks: -1,
          messages: [{
            key: row.aggregate_id,
            value: JSON.stringify(row.payload),
            headers: { eventId: row.id, eventType: row.event_type },
          }],
        });
      }
      if (rows.length) {
        await client.query("UPDATE outbox SET published_at = now() WHERE id = ANY($1)", [rows.map((r) => r.id)]);
      }
      await client.query("COMMIT");
      if (!rows.length) await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("relay error, retrying", err);
      await new Promise((r) => setTimeout(r, 2000));
    } finally {
      client.release();
    }
  }
}
```

If the relay crashes after sending but before marking rows published, those events are sent **again**. That's fine, because consumers are idempotent (Step 2). The outbox gives you **at-least-once** publishing and never loses an event.

> 💡 At larger scale, replace the polling relay with **change data capture**: **Debezium** reads the database's write-ahead log and publishes outbox rows to Kafka with low latency. Clean up published rows with a scheduled job. More: [Sagas & the Outbox Pattern](/learn/microservices/data-sagas-and-outbox).

## Step 2: Consume events idempotently

Kafka (and the outbox) deliver **at least once**, so a consumer **will** sometimes see the same event twice: after a crash, a rebalance, or a relay retry. Processing must be **idempotent**: doing it twice has the same effect as doing it once.

The reliable recipe: record the `eventId` **in the same database transaction** as the side effect.

```sql
CREATE TABLE processed_events (
  consumer   TEXT NOT NULL,
  event_id   UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer, event_id)
);
```

```ts
// payments-service/src/consumer.ts
import { Kafka } from "kafkajs";
import { pool } from "./db";

const kafka = new Kafka({ clientId: "payments-service", brokers: ["localhost:9092"] });
const consumer = kafka.consumer({ groupId: "payments-service" });   // one group per service

async function handleOrderPlaced(event: OrderPlacedEvent) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO processed_events (consumer, event_id) VALUES ('payments', $1)
       ON CONFLICT DO NOTHING`,
      [event.eventId],
    );
    if (inserted.rowCount === 0) {            // already handled: skip safely
      await client.query("ROLLBACK");
      return;
    }
    await client.query(
      "INSERT INTO payments (order_id, amount_cents, status) VALUES ($1, $2, 'PENDING')",
      [event.data.orderId, event.data.totalCents],
    );
    await client.query("COMMIT");             // side effect + "seen" marker saved together
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function start() {
  await consumer.connect();
  await consumer.subscribe({ topics: ["shop.orders"], fromBeginning: false });

  await consumer.run({
    // KafkaJS commits the offset only after this function finishes without throwing
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value!.toString());
      if (event.eventType !== "OrderPlaced") return;   // ignore event types we don't care about
      await handleOrderPlaced(event);
    },
  });
}
```

| Side effect | How to make it idempotent |
| --- | --- |
| Insert a row | `processed_events` table, or a unique constraint + `ON CONFLICT DO NOTHING` |
| Update a value | Set absolute values (`status = 'PAID'`), not increments (`balance = balance + 10`) |
| Upsert a read model | `INSERT ... ON CONFLICT (id) DO UPDATE` with a version check |
| Call an external API | Pass an **idempotency key** (`eventId`) if the API supports it (Stripe does) |
| Send an email | Record "sent for eventId" before or with the send; accept rare duplicates or use a provider idempotency key |

> ⚠️ **Commit offsets after processing**, never before. Committing first gives at-most-once: a crash after commit loses the event. Details: [Delivery Guarantees](/learn/kafka/delivery-guarantees).

## Step 3: Retries and dead-letter topics

Not every failure is the same:

| Error type | Examples | What to do |
| --- | --- | --- |
| **Transient** | Database timeout, downstream API 503, network blip | Retry with backoff |
| **Permanent** (poison message) | Invalid JSON, missing required field, unknown schema version, business rule violation | Don't retry forever: send to a **dead-letter topic (DLT)** and move on |

If you just throw on every error, the consumer retries the **same message forever** and the whole partition is stuck behind it. Lag grows and every later order waits.

```ts
const MAX_ATTEMPTS = 5;

class PermanentError extends Error {}

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    for (let attempt = 1; ; attempt++) {
      try {
        const event = parseAndValidate(message.value);   // throws PermanentError on bad data
        await handleOrderPlaced(event);
        return;                                          // success → offset will be committed
      } catch (err) {
        const permanent = err instanceof PermanentError;
        if (permanent || attempt >= MAX_ATTEMPTS) {
          await producer.send({
            topic: `${topic}.dlt`,
            messages: [{
              key: message.key,
              value: message.value,
              headers: {
                ...message.headers,
                "x-error": String((err as Error).message).slice(0, 500),
                "x-original-topic": topic,
                "x-original-partition": String(partition),
                "x-original-offset": message.offset,
                "x-attempts": String(attempt),
              },
            }],
          });
          return;                                        // move on; the DLT keeps the evidence
        }
        await new Promise((r) => setTimeout(r, 2 ** attempt * 200));   // 400ms, 800ms, 1.6s…
      }
    }
  },
});
```

For long waits (minutes), don't sleep inside the consumer. A long sleep can exceed the session timeout and trigger a rebalance. Use **retry topics** instead: `shop.orders.retry.1m`, `shop.orders.retry.10m`, each read by a consumer that waits until the message is old enough, then processes it again.

Operate the DLT like a real inbox:

- **Alert** when messages arrive in a DLT.
- Build a small tool or script to **inspect and replay** DLT messages after fixing the bug.
- Keep DLT retention long (for example 14 to 30 days).

> ⚠️ Retry topics and DLTs **break strict ordering** for the affected key: later events for `o-123` may be processed before the failed one. If ordering matters, either block that key (pause the partition and alert) or make handlers tolerate out-of-order events with version checks.

## Step 4: Ordering and concurrency in consumers

- Kafka orders events **per partition**. One consumer in a group reads each partition.
- A consumer group can run at most **as many active consumers as partitions**. 6 partitions → up to 6 parallel instances.
- To go faster inside one instance, process **different keys in parallel** but keep **the same key in sequence** (KafkaJS: `partitionsConsumedConcurrently`; libraries like Confluent Parallel Consumer for Java do per-key parallelism).

Out-of-order safety with **versions**: include a version or sequence number in events and ignore stale ones:

```sql
-- read model update that ignores older events
INSERT INTO order_view (order_id, status, version)
VALUES ($1, $2, $3)
ON CONFLICT (order_id) DO UPDATE
  SET status = EXCLUDED.status, version = EXCLUDED.version
  WHERE order_view.version < EXCLUDED.version;
```

## Step 5: Graceful shutdown and rebalances

When you deploy a new version, Kubernetes (or systemd) sends `SIGTERM`. A clean shutdown stops fetching, finishes the current message, commits, and leaves the group so partitions move quickly to other instances.

```ts
const shutdown = async (signal: string) => {
  console.log(`${signal} received, shutting down consumer`);
  try {
    await consumer.disconnect();   // finish in-flight message, commit, leave group
    await producer.disconnect();   // flush pending sends
    await pool.end();
  } finally {
    process.exit(0);
  }
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

Rebalance tips:

| Problem | Fix |
| --- | --- |
| Constant rebalances during deploys | Graceful shutdown; **cooperative sticky** assignor; static membership (`group.instance.id`) in clients that support it |
| "Consumer kicked out of group" | Processing takes longer than `max.poll.interval.ms` / session timeout: process faster, use smaller batches, or call `heartbeat()` in long batch handlers |
| Duplicates after rebalance | Expected with at-least-once: that's why handlers are idempotent |

More: [Consumers & Consumer Groups](/learn/kafka/consumers-and-consumer-groups).

## Step 6: Evolving event schemas

Events live for a long time and many teams read them, so you can't change them freely.

| Change | Safe? |
| --- | --- |
| Add an **optional** field | ✅ Old consumers ignore it |
| Add a field with a default | ✅ |
| Remove a field consumers use | ❌ Breaks them |
| Rename a field | ❌ It's remove + add |
| Change a type (`"45.99"` → `4599`) | ❌ |
| Change meaning (cents → euros) | ❌ The worst kind: nothing crashes, data is just wrong |

Rules that keep you safe:

1. Only make **backward-compatible** changes to an existing event version.
2. For breaking changes, publish a **new version** (`schemaVersion: 3`, or a new topic `shop.orders.v3`) **alongside** the old one, migrate consumers, then retire the old one.
3. Use a **Schema Registry** with Avro, Protobuf or JSON Schema and compatibility mode `BACKWARD`, and check compatibility **in CI** so a breaking change fails the pull request.
4. Consumers should be **tolerant readers**: ignore unknown fields and unknown event types.

Validate at the edges in TypeScript too, so a bad event becomes a `PermanentError` instead of a crash deep inside your code:

```ts
import { z } from "zod";

const OrderPlacedV2 = z.object({
  eventId: z.string().uuid(),
  eventType: z.literal("OrderPlaced"),
  schemaVersion: z.literal(2),
  data: z.object({
    orderId: z.string(),
    customerId: z.string(),
    totalCents: z.number().int().nonnegative(),
    currency: z.string().length(3),
  }).passthrough(),                       // tolerant reader: keep unknown fields
});

function parseAndValidate(value: Buffer | null) {
  try {
    return OrderPlacedV2.parse(JSON.parse(value!.toString()));
  } catch (err) {
    throw new PermanentError(`invalid OrderPlaced: ${(err as Error).message}`);
  }
}
```

## Step 7: Observability

| Signal | What to watch |
| --- | --- |
| **Consumer lag** (per group, per partition) | The #1 health metric: growing lag = falling behind |
| **Processing time** per message | Slow handlers cause lag and rebalances |
| **Error and DLT rate** | Bugs or bad data from a producer |
| **Outbox backlog** | `SELECT count(*) FROM outbox WHERE published_at IS NULL`: growing = relay stuck |
| **End-to-end latency** | `now() - occurredAt` when the consumer finishes |

**Distributed tracing across Kafka:** put the trace context into message **headers** when producing (`traceparent` in W3C format), and continue the trace in the consumer. OpenTelemetry has instrumentation for KafkaJS and other clients that does this automatically, so one trace shows `POST /orders → outbox → Kafka → payments-service → email-service`.

Log with the event's identity so you can search for one order across services:

```ts
logger.info({ eventId: event.eventId, orderId: event.data.orderId, topic, partition, offset: message.offset },
            "processed OrderPlaced");
```

More: [Observability](/learn/backend/observability).

## Step 8: Testing services that use Kafka

| Level | How |
| --- | --- |
| **Unit** | Test `handleOrderPlaced(event)` as a plain function with a fake DB; no Kafka needed |
| **Contract / schema** | Validate example events against the schema; schema compatibility check in CI |
| **Integration** | Real Kafka in a container (**Testcontainers**) + real Postgres; produce an event, assert the DB result |
| **Idempotency test** | Deliver the **same event twice**; assert exactly one payment row |
| **Poison message test** | Send invalid JSON; assert it lands in the DLT and the next message is still processed |

```ts
// integration test sketch with Testcontainers
import { KafkaContainer } from "@testcontainers/kafka";

const kafkaC = await new KafkaContainer("confluentinc/cp-kafka:7.7.0").start();
const brokers = [`${kafkaC.getHost()}:${kafkaC.getMappedPort(9093)}`];
// start the consumer with these brokers, produce OrderPlaced twice with the same eventId,
// then poll the database until one payment row exists, and assert there is exactly one
```

## Common backend patterns with Kafka

| Pattern | What it is | Where to learn more |
| --- | --- | --- |
| **Transactional outbox** | Reliable publish from a DB transaction | This lesson, [Sagas & Outbox](/learn/microservices/data-sagas-and-outbox) |
| **Choreography saga** | Services react to each other's events to complete a multi-step process (order → payment → stock → shipping) with compensating events on failure | [Sagas & Outbox](/learn/microservices/data-sagas-and-outbox) |
| **CQRS read models** | Consume events to build query-optimized views (search index, dashboards) | [CQRS & Event Sourcing](/learn/microservices/cqrs-and-event-sourcing) |
| **Change data capture (CDC)** | Debezium turns database changes into events without changing app code | [Kafka ecosystem](/learn/kafka/kafka-vs-rabbitmq-and-ecosystem) |
| **Compacted "table" topics** | Keep the latest value per key (customer profile, product price) so new services can bootstrap state | [Topics, Partitions & Offsets](/learn/kafka/topics-partitions-offsets) |
| **Stream processing** | Join, aggregate and window events (Kafka Streams, Flink) | [Kafka ecosystem](/learn/kafka/kafka-vs-rabbitmq-and-ecosystem) |

### Anti-patterns to avoid

| ❌ Anti-pattern | Why it hurts | ✅ Instead |
| --- | --- | --- |
| Request/response over Kafka for user-facing calls | Slow, complex correlation, timeouts | HTTP/gRPC for queries; Kafka for events |
| Dual writes (DB then Kafka) | Lost or phantom events | Transactional outbox / CDC |
| Huge messages (MBs, files) | Slow brokers and consumers | Store the file in S3, send a reference |
| Sharing a consumer group between different services | They steal each other's messages | One group per service |
| No key on entity events | No ordering | Key by entity ID |
| Infinite retry on poison messages | Partition stuck, lag explodes | Classify errors, DLT |
| Using Kafka as the main database for queries | Kafka can't query by field | Build read models in a real database |
| Auto-creating topics in production | Wrong partitions/replication, typos become topics | Topics as code with reviewed settings |

## Production checklist for a Kafka-backed service

- [ ] Events have `eventId`, `eventType`, `schemaVersion`, `occurredAt`, and a meaningful **key**
- [ ] Publishing uses the **outbox** (or CDC), not dual writes
- [ ] Producer: `acks=all`, idempotence on
- [ ] Consumer: **one group per service**, commit after processing, **idempotent** handlers
- [ ] Transient errors retried with backoff; poison messages go to a **DLT** with error headers; DLT alerts
- [ ] Graceful shutdown on `SIGTERM`
- [ ] Schemas versioned, compatibility checked in CI, tolerant readers
- [ ] Metrics for lag, errors, outbox backlog; tracing through headers
- [ ] Integration tests with a real broker, including duplicate and poison-message cases

## Interview questions

**When would you choose Kafka over RabbitMQ?**
When many independent consumers need the same events, when you need replay or long retention, very high throughput, or ordered processing per key. For task queues with routing, priorities and per-message acknowledgment, RabbitMQ (or SQS) is usually simpler.

**How do you publish an event reliably when you also write to a database?**
With the transactional outbox: write the business row and an outbox row in one local transaction, then a relay or Debezium publishes the outbox to Kafka. This is at-least-once, so consumers must be idempotent.

**How do you make a consumer idempotent?**
Store the processed `eventId` in the same transaction as the side effect (unique constraint), use upserts with version checks, prefer absolute updates over increments, and pass idempotency keys to external APIs.

**How does Kafka guarantee ordering?**
Only within a partition. Records with the same key go to the same partition, so key by the entity whose events must stay in order. One consumer in a group reads a partition, in order.

**What do you do with a message that keeps failing?**
Retry transient failures a few times with backoff (or via retry topics), then send it to a dead-letter topic with error metadata, alert, fix, and replay. Never block the partition forever.

**How do you scale consumers?**
Add instances to the consumer group, up to the number of partitions. Beyond that, add partitions (planning for the key-mapping change) or process different keys in parallel inside each instance.

**Does Kafka give exactly-once?**
Within Kafka (read from Kafka, write to Kafka) yes, with idempotent producers and transactions. Once a database, email or external API is involved, you get at-least-once delivery and make the effect exactly-once through idempotency.

## Key takeaways

- Use Kafka as an **event backbone** between services; use queues for jobs and HTTP for queries.
- Design events with a standard **envelope**, past-tense names, and the **entity ID as key**.
- Never dual-write: publish through a **transactional outbox** (or CDC).
- Expect duplicates: make consumers **idempotent**, commit after processing.
- Separate transient from permanent errors; use **retries and a dead-letter topic**.
- Evolve schemas **compatibly**, shut down gracefully, and watch **consumer lag**.

## Try it yourself

Build two tiny services with the local Compose file: an `orders-service` with `POST /orders` that writes an order and an outbox row, plus a relay; and a `payments-service` consumer with a `processed_events` table. Then:

1. Kill the relay after it sends but before it marks rows published, and restart it. Confirm only **one** payment row exists.
2. Produce a message with invalid JSON and confirm it lands in `shop.orders.dlt` while later orders are still processed.
3. Scale `payments-service` to 3 instances and watch partitions get shared with `kafka-consumer-groups.sh --describe --group payments-service`.
