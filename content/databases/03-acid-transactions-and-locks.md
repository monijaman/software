---
title: "ACID, Transactions & Locks"
summary: "Make multi-step changes correct with atomic transactions, isolation choices, constraints and short-lived locks."
level: Advanced
tags: [database, acid, transactions, isolation, locks, consistency]
---

## The bank-transfer test

A transfer moves 100 from A to B. If the service crashes after debiting A but before crediting B, money must not disappear. Put both changes in one local transaction: either both commit or both roll back.

![A transaction either commits all related changes or rolls back; locks and isolation protect concurrent writers](/img/database/acid.svg)

## ACID without vague definitions

| Property | What it protects | Concrete example |
| --- | --- | --- |
| Atomicity | Partial change | Order and its items save together or neither does. |
| Consistency | Broken invariant | Stock never falls below zero because constraints/conditional update reject it. |
| Isolation | Concurrent interference | Two buyers cannot both reserve the last item. |
| Durability | Crash after success | A committed payment record is recovered from WAL/replication. |

Consistency is not a promise that every replica is instantly current; it means the transaction moves valid state to valid state.

## Isolation anomalies you should recognize

| Anomaly | Example | Typical protection |
| --- | --- | --- |
| Dirty read | Read data another transaction may roll back | Read committed or stronger |
| Non-repeatable read | Same row changes during transaction | Repeatable read or explicit lock |
| Phantom | New matching row appears in a range | Serializable isolation/predicate protection |
| Lost update | Two writers overwrite each other | Conditional update, version column or lock |

The exact behavior is engine-specific. In an interview, name the isolation level and the anomaly you are preventing instead of saying “use transactions” alone.

## Correct inventory update

Do not read available stock, subtract in application memory, then write it back. Let the database make the decision atomically:

    UPDATE inventory
    SET available = available - 1
    WHERE sku = :sku AND available > 0;

If zero rows change, inventory was unavailable. This avoids a race without a distributed lock.

## Locks, deadlocks and good habits

Locks protect conflicting work, but long transactions hold them too long. A deadlock happens when transactions wait in a cycle; databases normally abort one. Retry only the aborted transaction with bounded backoff and idempotency.

Keep transactions short, access tables in a consistent order, avoid network calls inside them, and monitor lock-wait time, deadlock count and transaction age.
