---
title: "Transactions, Indexes & Concurrency"
summary: "Interview answers for triggers, ACID, clustered indexes, deadlock/livelock and RAID. Covers PDF questions 8-11 and 18."
level: Advanced
tags: [database, interview, acid, indexes, locks, deadlock, raid]
---

![Correct updates: transactions protect invariants while indexes speed access and locks coordinate writers](/img/database-interviews/transactions.svg)

## Q8: What is a trigger?

A trigger is database code automatically invoked by an INSERT, UPDATE or DELETE. It can enforce local rules or audit changes, but hidden work makes writes harder to understand. Prefer declarative constraints when possible.

## Q9: Transaction and ACID

A transaction groups changes so they commit together or roll back together. Atomicity is all-or-nothing; consistency preserves constraints; isolation defines concurrent visibility; durability survives failure. Never wait for a remote service while holding database locks.

## Q10: Clustered and non-clustered indexes

The useful distinction is row ordering versus a separate index that points to rows. Names and behavior vary by engine: state the database product you mean.

## Q11: Livelock versus deadlock

Deadlock is circular waiting, so the database aborts one transaction. Livelock means actors keep retrying/changing but make no useful progress. Use consistent lock order, short transactions and bounded backoff.

## Q18: Why RAID?

RAID combines disks for redundancy, throughput or both. It is not a backup: deletion and corruption replicate too. Restore-tested independent backups remain necessary.
