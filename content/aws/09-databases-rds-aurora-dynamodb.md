---
title: "AWS Databases: Choose the Right One"
summary: "Choose SQL, key-value, or cache storage by the problem you need to solve, then protect it with backups and private networking."
level: Beginner
tags: [aws, rds, aurora, dynamodb, elasticache, database, multi-az]
---

## Start with the data shape

| Need | Good first choice |
| --- | --- |
| Orders, users, payments, joins, SQL | RDS PostgreSQL or MySQL |
| Very high-scale lookups by a known key | DynamoDB |
| Fast temporary cache or sessions | ElastiCache Redis/Valkey |
| MySQL/PostgreSQL compatible SQL with AWS-managed clustered storage | Aurora |

Do not choose a database because it is fashionable. Start from the queries and guarantees your app needs.

## RDS: managed SQL database

RDS runs engines such as PostgreSQL and MySQL while AWS handles hardware, backups, and many maintenance tasks. Put it in private subnets. Allow its port only from the app security group.

| Feature | Why it matters |
| --- | --- |
| Automated backups | Recover to an earlier point in time |
| Multi-AZ DB instance | A standby can take over during infrastructure failure; it does not serve reads |
| Read replica | Extra copy for read-heavy work, not automatic write failover |

Test a restore procedure before trusting a backup.

## DynamoDB: key-value storage

DynamoDB is not SQL. You design from the access pattern first: “get order by order ID” or “list a customer’s orders by date.” The partition key decides where data lives; a sort key orders related data.

Use conditional writes for rules such as “create this item only if it does not exist.” That prevents race conditions without a separate lock.

## Cache is not the source of truth

ElastiCache speeds up repeated reads. If the cache disappears, the real database must still be correct. Set expiration and handle cache misses safely.

## Model the shop's data before selecting a service

The shop stores customers, orders, and order items. It needs queries such as “show an order with its customer and books” and a transaction that saves both the order and its items. Relational storage is a natural starting point.

A delivery-status service might instead need only “get the latest status by order ID.” A key-based store could fit that separate responsibility. Different services can use different databases, but add that complexity only when the access patterns justify it.

## A SQL example you can run locally

Use any practice PostgreSQL database first; you do not need to pay for RDS to learn the data model.

```sql
CREATE TABLE customers (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE orders (
  id BIGINT PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  status TEXT NOT NULL
);

INSERT INTO customers VALUES (42, 'Amina');
INSERT INTO orders VALUES (1001, 42, 2500, 'paid');

SELECT o.id, c.name, o.total_cents, o.status
FROM orders o
JOIN customers c ON c.id = o.customer_id
WHERE o.id = 1001;
```

**Expected result:** one row for order 1001, Amina, 2500 cents, and `paid`. Integer cents avoid floating-point rounding in this simple money example; real payment models also account for currency and accounting rules.

RDS hosts the database engine, but your schema design, query performance, transactions, and user permissions remain your responsibility.

## A guided RDS connection design

Before creating a billable database, draw its network path. Put the database in a DB subnet group using private subnets spanning the required AZs. Disable public accessibility. Allow PostgreSQL port 5432 from the application security group.

Use a supported engine version, appropriate storage, encryption, a backup retention policy, and an application database user with limited privileges. Store credentials in a secret service rather than source code.

Connect from an authorized application host inside the intended network, using the database hostname and verified TLS according to the engine's guidance. A private database is not expected to be directly reachable from your home laptop. A public IP and a broad firewall rule are not necessary just to debug it; use an approved private access path.

**Expected result:** the app can connect, while an unrelated internet client cannot. A timeout suggests network/listening issues; an authentication error suggests credentials or database permissions. These require different fixes.

## Availability and read scale are distinct

A traditional **Multi-AZ DB instance deployment** has a primary and a standby. The standby supports failover and does not serve application reads. A **Multi-AZ DB cluster** is a different deployment option with readable instances. Aurora also has its own cluster architecture.

A read replica can handle selected read workloads, but replication lag means a new write may not be immediately visible there. If a user just paid for an order, send the confirmation read to a source that meets the required consistency guarantee.

Backups protect against a different class of problem than failover. A healthy standby can faithfully replicate an accidental deletion. Test restoration into a new database and record how the app would switch endpoints.

## A DynamoDB key example

For “list a customer's orders newest first,” you could organize items as:

```text
PK             SK                       total_cents  status
CUSTOMER#42    ORDER#2026-10-01#1001      2500         paid
CUSTOMER#42    ORDER#2026-10-02#1002      1800         shipped
```

Query `PK = CUSTOMER#42` and the order sort-key prefix. Reverse sort order for newest first. To get an order only by order ID, you need another deliberate access path, such as an index or a differently designed primary key. A table scan is not an efficient substitute for a key design.

## Cache without losing correctness

Use cache-aside: the app checks the cache, loads the database on a miss, and stores the result with an expiry. When an order changes, invalidate or update the appropriate cache entry. A cached balance or inventory count can become stale; enforce critical write rules in the authoritative database.

**Practice:** should an old cached book description block checkout if the cache is unavailable? Usually no: read the source database and keep the app correct, while protecting it from excessive fallback traffic.

**Cleanup:** for a dedicated RDS lab, decide whether you need a final snapshot, then delete the instance and review remaining snapshots/storage. Never skip backup decisions for valuable data.

Further reading: [RDS Multi-AZ DB instances](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html), [DynamoDB key concepts](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.CoreComponents.html).

## Choose the database using order correctness

An order involves a customer, line items, stock, and payment state. If your design requires joins and a transaction across related rows, a relational database is a natural starting point. DynamoDB can serve high-volume known access patterns, but you must explicitly design keys, indexes, conditional updates, and consistency behavior.

### Concurrent stock updates

Two customers both see one book remaining. Reading stock and then separately writing `stock = 0` can accept both orders. Use a database transaction with a conditional stock update and verify that exactly one request succeeds. A larger database does not fix incorrect concurrency logic.

### Connections are a finite resource

If 20 app copies each allow 50 database connections, the potential total is 1,000. Include workers, migrations, administrative sessions, and failover capacity in the budget. Set bounded pools and timeouts rather than allowing every request to open a new connection.

**Exercise:** Write access patterns for your shop before choosing a store. Include customer order history, order details, stock reservation, and an administrative report. Explain which operations need immediate consistency and which tolerate lag. Then define how a backup will be restored into a new environment and validated before switching the app.

## Remember this

- RDS is the friendly default for relational app data.
- Multi-AZ is availability; read replicas are for reading scale.
- DynamoDB starts from access patterns and keys, not tables and joins.
- A cache improves speed but does not replace durable data.
