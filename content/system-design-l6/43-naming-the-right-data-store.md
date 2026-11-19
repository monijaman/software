---
title: "Say DynamoDB, Not Redis: Naming the Right Data Store Under Interview Pressure"
summary: "A real interview lesson: the design was right, but saying the wrong store name cost a point. Learn to choose a store by durability and access patterns, and to name it clearly and justify it out loud."
level: Advanced
tags: [system-design, interview, data-stores, dynamodb, redis, postgresql, durability, key-value, communication]
---

## The problem in context

The interview prompt: a user uploads a PDF, the file goes to **S3**, and **two downstream services** process it. The discussion went deep into async processing, retries and what happens when a downstream service is down. All of that went well.

Then came one small decision. Each upload needs a status record (`requestId`, `userId`, `s3HashId`, processing state). The candidate wanted something lighter and cheaper than running a full PostgreSQL cluster: a **managed key-value store**. They were thinking of **DynamoDB**. They said **"Redis with persistence enabled."**

The feedback included a negative point for that choice. The reasoning was right, but the interviewer can only grade what you say, not what you meant.

## What must be true

The upload-state store is the **source of truth** for each upload. It must:

- **Not lose writes.** If it forgets an upload, the user's file is stuck forever and retries cannot find it.
- **Survive node failures** without manual recovery.
- **Stay cheap** as the number of records grows into millions, most of them old and rarely read.
- **Allow new queries later**, such as "show all failed uploads for user X."

## Practical response

1. **Name the store and its role in one sentence:** "Upload state goes into DynamoDB as the source of truth, keyed by `requestId`."
2. **Give the reason in terms of guarantees:** "It writes durably across multiple availability zones, it is serverless, and I pay per request, not for an always-on cluster."
3. **Show the access patterns:** "Get by `requestId` is the main read. For 'failed uploads per user' I add a GSI on `userId` + `status`."
4. **Say what you are *not* using and why:** "I would not use Redis as the source of truth here. It is a good cache in front, but it is not where I want this data to live."

### Walk through a failure and recovery

The primary Redis node crashes one second after accepting a status update to `PROCESSING_DONE`. With asynchronous replication (and AOF `everysec` fsync), that last write may never have reached the replica or the disk. The replica is promoted and still says `PROCESSING`. The worker thinks it finished, the store disagrees, and the upload sits in limbo until someone notices.

With DynamoDB, a successful `PutItem` or `UpdateItem` response means the write has already been stored durably across multiple availability zones. A node failure after the acknowledgement does not lose it.

## How to prove it worked

In the interview: the interviewer can repeat your choice and your reason back to you without guessing, for example "DynamoDB, because durable and per-request priced, with a GSI for user queries." In practice: kill a node or fail over during a load test and check that every acknowledged status update is still there.

### Check your understanding

Why is "Redis with persistence" still a weak answer for a source of truth, even though it writes to disk? And what one sentence would have earned the point instead?

---

## Concepts and implementation details

## Why "Redis with persistence" raises a flag

Redis is excellent. It is just built for a different job. Persistence makes it **recoverable**, not **durable by default** in the way a primary database is.

| Concern | Redis (with RDB/AOF) | DynamoDB |
| --- | --- | --- |
| **Durability on ack** | Ack comes from memory. AOF `everysec` can lose about 1 s of writes; RDB snapshots can lose minutes. `appendfsync always` is safer but much slower | Ack means stored durably across multiple AZs |
| **Failover** | Replication is asynchronous; a promoted replica may miss recent writes | Managed; no data lost on node failure |
| **Cost at scale** | Every record lives in RAM, which costs far more per GB than SSD | Data on SSD; on-demand or provisioned pricing |
| **New queries** | Only by key. "Failed uploads for user X" needs hand-built index sets you must keep in sync | Add a Global Secondary Index |
| **Old data** | Must fit in memory or be evicted | Cheap to keep; TTL can expire it automatically |

The interviewer is not saying "Redis is bad." They are asking: **do you know what happens to this data when things fail?**

## Picking the store by what the data needs

Ask these questions about the data, not about the tool:

1. **Is it the source of truth, or a copy?** A copy can live in a cache. The truth needs a durable store.
2. **What happens if the last second of writes is lost?** If the answer is "a user's upload is stuck," you need durable writes.
3. **What are the access patterns now, and what are the likely next ones?** Key lookups only → key-value works. Ad-hoc filters and joins → relational.
4. **How much data, for how long?** Millions of mostly-cold records belong on disk, not in RAM.

For this design the answers point to a **durable key-value store**. DynamoDB fits. PostgreSQL would also be a correct and defensible answer, just heavier to operate. Redis fits only as a **cache or a short-lived helper** (rate limits, locks, a fast status read in front of the real store).

## A simple table design

```text
Table: uploads
  PK  requestId   (string)
  userId          (string)
  s3Key / s3Hash  (string)
  status          PENDING | PROCESSING | DONE | FAILED
  serviceA        PENDING | DONE | FAILED
  serviceB        PENDING | DONE | FAILED
  attempts        (number)
  updatedAt       (ISO timestamp)
  ttl             (epoch seconds, optional cleanup)

GSI: byUserStatus
  PK  userId
  SK  status#updatedAt
```

- **Main read:** `GetItem(requestId)`.
- **"Failed uploads for user X":** query the GSI with `userId = X` and `begins_with(SK, "FAILED#")`.
- **Safe updates from two services:** use a conditional write so a retried or late message cannot move the state backwards.

```text
UpdateItem uploads
  Key: requestId = :id
  SET serviceA = :done, updatedAt = :now
  CONDITION serviceA <> :done
```

If the condition fails, the work was already recorded, so the retry is ignored. That is the idempotency you discussed earlier in the interview, backed by the store.

## Where Redis does belong in this design

Mentioning Redis is fine when you give it the right role:

- **Cache** for a hot "status" endpoint the client polls, with DynamoDB behind it.
- **Rate limiting** uploads per user.
- **Short-lived locks** or deduplication keys with a TTL, where losing one is harmless.

Saying "DynamoDB is the source of truth; Redis caches hot reads" shows you understand both tools. Saying "Redis with persistence" for the truth suggests you do not.

## How to avoid the slip under pressure

- **Slow down on nouns.** Tool names carry the most weight in a design answer. Pause for half a second before you say one.
- **Always pair the name with a reason:** "X, because Y." If the reason does not match the tool, you or the interviewer will catch it.
- **Write it on the diagram.** Label the box "DynamoDB (source of truth)". A written label is easier to check than a spoken word.
- **Correct yourself out loud.** "Sorry, I said Redis; I mean DynamoDB, because I need durable writes." A quick correction usually costs nothing. An uncorrected slip gets graded.
- **Recap your stores at the end:** "Quick summary: S3 for files, DynamoDB for upload state, SQS between services, Redis only as a cache."

## Common mistakes

- Choosing a store because it "feels lightweight" instead of by durability and access patterns.
- Treating "has persistence" as the same thing as "safe as a primary database."
- Forgetting cost: keeping millions of cold records in RAM.
- Designing only for today's key lookup with no path to "list by user" or "list by status."
- Naming a tool without a reason, so the interviewer cannot tell a slip from a misunderstanding.

## The L6 takeaway

Good architecture is only half of the answer; the other half is saying it clearly. Choose each store by **what happens to the data when something fails** and by **how it will be queried**, then say the name and the reason together.

DynamoDB for durable, cheap, key-based state. PostgreSQL when you need relations and flexible queries. Redis in front, as a cache, never as the only copy of something you cannot lose.
