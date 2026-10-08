### Case Study: Designing a Reliable Instagram Like Counter

A user likes a photo on Instagram. The displayed count increases from 400 to 401, but after refreshing the page, it returns to 400.

The interviewer says: “Increment the like count in Redis.”

Answer the following:

1. What happens if the like is saved successfully but the Redis counter update fails?
2. If the same user taps Like from two phones simultaneously, can the count increase by two?
3. If Redis restarts, where does the value 401 come from?
4. What happens if the count is persisted to the database on every like and a celebrity photo receives 50,000 likes per minute?
5. Design a reliable, scalable, and idempotent like-counting system.

### Answer

The like event and the displayed count should be treated as separate concerns.

A robust design stores the user’s like as durable, idempotent data in the primary database:

```scss
photo_likes(
  photo_id,
  user_id,
  created_at,
  PRIMARY KEY(photo_id, user_id)
)
```

The primary key ensures that the same user can like a photo only once, even if requests arrive concurrently from multiple devices.

The request flow should be:

1. Authenticate the user.
2. Insert `(photo_id, user_id)` into the database using an idempotent operation such as `INSERT ... ON CONFLICT DO NOTHING`.
3. If a row was actually inserted, publish a `LikeCreated` event.
4. A background consumer increments the Redis counter.
5. The API returns the like state immediately and may return an optimistic count.

If the database write succeeds but the Redis update fails, the durable like is still safe. The event must be retried through a durable queue or an outbox table. The consumer should be idempotent so retries do not create incorrect counts. One approach is to include a unique event ID and record processed events. Another approach is to rebuild the Redis count from the database.

Redis should be treated as a cache or materialized view, not the source of truth. If Redis restarts, the count can be restored by:

- loading a persisted Redis snapshot, if available;
- rebuilding counts from the durable likes table;
- replaying like events from the event log; or
- temporarily calculating the count from the database for cold keys.

Redis increments are atomic, so two legitimate likes can safely execute `INCR`. However, the system must prevent duplicate likes at the database level. If both requests come from the same user, only the request that inserts a new `(photo_id, user_id)` row should generate a count-increment event.

Persisting the aggregate count to the database on every like does not scale for highly popular content. A celebrity photo receiving 50,000 likes per minute would create a hot row, heavy write contention, transaction-log pressure, replication lag, and increased database cost.

Instead, use sharded or partitioned counters. Like events can be distributed across multiple counter shards:

```ini
counter_shard = hash(user_id) % N
```

The displayed count is the sum of those shards. Redis can maintain the fast-path aggregate, while the durable database stores the individual likes and periodically reconciles aggregate counters.

The important guarantees are:

- The database records whether a user has liked the photo.
- A unique constraint prevents duplicate likes.
- The event/outbox guarantees eventual counter updates.
- Redis provides low-latency reads but is recoverable.
- Consumers retry failed events safely.
- Reconciliation detects and repairs count drift.
- High-volume writes are distributed instead of updating one hot database row.

The final count may be eventually consistent for a short period, but it will converge to the number of unique users who liked the photo.

---

### Case Study: Designing Safe Retries for a Timing-Out Payment API

A downstream payment API starts timing out. Its p99 latency rises from 80 ms to 4 seconds.

The service retries each request three times, and the retries have no timeout. Meanwhile, every timed-out call may still be running on the payment provider.

Answer the following:

1. What happens to the service’s thread pool?
2. What happens to the payment API?
3. When the dependency recovers, why can traffic get worse before it gets better?
4. How do you bound retry fanout?
5. Who owns the deadline: the incoming request or each hop?
6. Should the service retry a timeout, or only a clean failure?
7. If both sides keep the original work running, how do you prevent a double charge?

### Answer

Retries do not make a failing dependency healthy. Without per-attempt timeouts, requests occupy threads, connections, memory, and other resources until the downstream call eventually returns. Three retries can multiply the work for one incoming request while the original calls are still running. The service’s thread pool and connection pool can be exhausted, causing queue growth, rising latency, and failures for otherwise healthy endpoints.

The payment API receives the original requests plus the retries. This creates a retry storm and increases its own queueing, saturation, and timeout rate. When the dependency begins recovering, the backlog of queued work and the retries released by the recovering clients can produce a traffic surge. That surge can overload the dependency again, so recovery becomes oscillatory or gets worse before it gets better.

The design should enforce a bounded end-to-end deadline. The incoming request owns the overall deadline, and each hop receives the remaining time through a propagated deadline or timeout. Every individual attempt must also have a finite timeout shorter than the remaining request budget. A downstream service must never be allowed to run indefinitely on behalf of an upstream request.

Retry fanout must be explicitly bounded:

- Set a small maximum number of attempts, often one retry or none for payment operations.
- Stop immediately when the remaining deadline is too short for another attempt.
- Use exponential backoff with jitter.
- Apply concurrency limits and per-dependency bulkheads.
- Use circuit breakers or adaptive load shedding when the dependency is unhealthy.
- Avoid multiplying retries independently at every hop; designate one layer to retry.

Timeouts are ambiguous outcomes. A timeout may mean the payment was never received, is still processing, or completed successfully but the response was lost. Retrying blindly can therefore double-charge the customer. A clean, explicitly retryable failure such as a temporary transport rejection may be safer to retry, but even then the payment operation must be idempotent.

Each payment attempt should carry a stable idempotency key derived from the business operation, such as `order_id` or `payment_attempt_id`. The payment provider must durably deduplicate that key and return the original result for later requests with the same key. The client should also persist the operation state and reconcile ambiguous outcomes through a status query or webhook rather than issuing a new charge with a new key.

The important guarantees are:

- Every outbound call has a deadline and a bounded resource cost.
- The end-to-end request deadline is propagated across hops.
- Retries are limited, jittered, and coordinated at one layer.
- Concurrency limits and circuit breakers prevent dependency failure from consuming the whole service.
- A timeout is treated as an unknown outcome, not proof that no work happened.
- Stable idempotency keys prevent duplicate charges.
- Recovery is gradual, with controlled probing and load, rather than an unrestricted retry surge.
