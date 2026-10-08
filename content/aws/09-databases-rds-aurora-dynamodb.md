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
| Multi-AZ | A standby can take over during infrastructure failure |
| Read replica | Extra copy for read-heavy work, not automatic write failover |

Test a restore procedure before trusting a backup.

## DynamoDB: key-value storage

DynamoDB is not SQL. You design from the access pattern first: “get order by order ID” or “list a customer’s orders by date.” The partition key decides where data lives; a sort key orders related data.

Use conditional writes for rules such as “create this item only if it does not exist.” That prevents race conditions without a separate lock.

## Cache is not the source of truth

ElastiCache speeds up repeated reads. If the cache disappears, the real database must still be correct. Set expiration and handle cache misses safely.

## Remember this

- RDS is the friendly default for relational app data.
- Multi-AZ is availability; read replicas are for reading scale.
- DynamoDB starts from access patterns and keys, not tables and joins.
- A cache improves speed but does not replace durable data.
