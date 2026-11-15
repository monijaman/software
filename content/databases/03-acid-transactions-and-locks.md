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

## Locks and good habits

Locks protect conflicting work, but long transactions hold them too long. Keep transactions short, access tables in a consistent order, avoid network calls inside them, and monitor lock-wait time, deadlock count and transaction age.

## Deadlocks

A **deadlock** happens when two or more transactions each hold a lock the other one needs, so they wait for each other forever. Picture two cars meeting on a one-lane bridge: neither can move forward until the other backs up.

![Transaction A holds row 1 and waits for row 2, while Transaction B holds row 2 and waits for row 1. The cycle never ends until the database aborts one](/img/database/deadlock.svg)

### How it happens: two transfers in opposite directions

Ana sends money to Ben while Ben sends money to Ana, at the same moment:

| Time | Transaction A (Ana → Ben) | Transaction B (Ben → Ana) |
| --- | --- | --- |
| t1 | `UPDATE accounts SET balance = balance - 50 WHERE id = 1;` 🔒 locks row 1 | |
| t2 | | `UPDATE accounts SET balance = balance - 30 WHERE id = 2;` 🔒 locks row 2 |
| t3 | `UPDATE accounts SET balance = balance + 50 WHERE id = 2;` ⏳ waits for B | |
| t4 | | `UPDATE accounts SET balance = balance + 30 WHERE id = 1;` ⏳ waits for A |
| t5 | 💥 Deadlock: the database picks a victim | |

Neither transaction can continue. The database runs a **deadlock detector**, finds the cycle, and **aborts one transaction** (the "victim") so the other can finish:

- PostgreSQL: `ERROR: deadlock detected` (SQLSTATE `40P01`)
- MySQL / InnoDB: `ERROR 1213: Deadlock found when trying to get lock`
- SQL Server: error `1205`, "chosen as the deadlock victim"

> 💡 A deadlock is not data corruption. The database already resolved it by rolling back the victim. Your job is to **make deadlocks rare** and **retry safely** when one happens.

### Fix 1: Always lock in the same order

Deadlocks need a **cycle**. If every transaction takes locks in the same order (for example, lowest ID first), a cycle can't form: the second transaction simply waits its turn.

```sql
BEGIN;
-- Lock both rows in ID order, no matter who is sending to whom
SELECT id FROM accounts WHERE id IN (1, 2) ORDER BY id FOR UPDATE;

UPDATE accounts SET balance = balance - 50 WHERE id = 1;
UPDATE accounts SET balance = balance + 50 WHERE id = 2;
COMMIT;
```

Now both transfers try to lock row 1 first. One gets it and the other waits, with no cycle and no deadlock.

The same applies to tables. If one code path writes `orders` then `inventory`, every code path should write `orders` then `inventory`.

### Fix 2: Keep transactions short

The longer a transaction holds locks, the bigger the window for a collision.

- Do validation, API calls, file uploads and emails **before** `BEGIN` or **after** `COMMIT`.
- Never wait for user input inside a transaction.
- Update in small batches (for example 1,000 rows at a time) instead of one giant `UPDATE` across millions of rows.

### Fix 3: Index the columns you filter on

Without an index, `UPDATE ... WHERE email = ?` may have to **scan and lock many rows** (or, in InnoDB, the gaps between them) just to find the one it needs. More locked rows means more chances to collide with other transactions.

```sql
-- Without this, the UPDATE scans and locks far more than one row
CREATE INDEX idx_orders_customer_status ON orders (customer_id, status);

UPDATE orders SET status = 'cancelled'
WHERE customer_id = 42 AND status = 'pending';
```

With a good index, the database locks **only the matching rows**.

### Fix 4: Retry the victim transaction

Even well-designed systems see occasional deadlocks under heavy load. Catch the deadlock error and **retry the whole transaction** a few times with a short, random delay:

```ts
const RETRYABLE_CODES = new Set(["40P01", "40001"]); // PostgreSQL: deadlock, serialization failure

async function withRetry<T>(work: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await work(); // work() must run BEGIN … COMMIT itself
    } catch (err: any) {
      if (!RETRYABLE_CODES.has(err.code) || i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 50 * i + Math.random() * 50)); // backoff + jitter
    }
  }
}

await withRetry(() => transferMoney(fromId, toId, amount));
```

Retry rules:

- Retry the **entire transaction** from `BEGIN`, not just the last statement. The victim's work was already rolled back.
- Keep it **bounded** (2–3 attempts) and add jitter so the two transactions don't collide again in lockstep.
- Make the operation **idempotent**: don't send the "transfer complete" email until the commit succeeds.

### Finding deadlocks in production

| Database | Where to look |
| --- | --- |
| PostgreSQL | Server log (shows both queries in the cycle); set `log_lock_waits = on`; `pg_stat_database.deadlocks` counter |
| MySQL / InnoDB | `SHOW ENGINE INNODB STATUS` → "LATEST DETECTED DEADLOCK"; `innodb_print_all_deadlocks = ON` |
| SQL Server | `system_health` Extended Events session → deadlock graph |

Alert on the **deadlock rate**, not single events. A sudden rise usually points to a new code path that locks in a different order or a missing index.

### Deadlock vs lock wait vs livelock

| | What happens | Resolves itself? |
| --- | --- | --- |
| **Lock wait** | B waits for A, A finishes normally | ✅ Yes, B continues after A commits |
| **Deadlock** | A waits for B **and** B waits for A | ❌ No, the database must abort one |
| **Livelock** | Both keep retrying and backing off in sync, never finishing | ❌ No, add random jitter to retries |

### Interview answer

**Q: What is a database deadlock, and how do you prevent it?**

> "A deadlock happens when transactions wait for locks held by each other in a cycle. For example, Transaction A locks row 1 and waits for row 2, while Transaction B locks row 2 and waits for row 1. Neither can proceed, so the database detects the cycle and aborts one as the victim.
>
> To prevent it, I lock resources in a consistent order, keep transactions short with no network calls inside, and add proper indexes so updates lock only the rows they need. Because deadlocks can still happen under load, I catch the deadlock error and retry the whole transaction a few times with backoff and jitter, and I monitor the deadlock rate in production."
