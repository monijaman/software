---
title: "Time, Consistency and Distributed Transactions"
summary: "Reason about clocks, ordering, split brain, locks, CRDTs and transactions without promising impossible global certainty."
level: Advanced
tags: [system-design, clocks, lamport, vector-clocks, locks, saga, crdt]
---

> **How to read this lesson:** STAR means **Situation → Task → Action → Result**. The scenario and targets below are worked design assumptions, not claims of measured production results.

## S — Situation: the problem in context

Two regions edit an account and process an order. Their wall clocks differ, and a paused worker resumes after its lease expires.

## T — Task: requirements and success criteria

Define ordering and ownership without trusting wall-clock timestamps to establish all causal or financial truth.

## A — Action: design the normal path

1. Use monotonic clocks for local elapsed durations, and versions or logical clocks for the ordering the domain actually requires.

2. Use fencing tokens for stale owners and require the storage boundary to validate them.

3. Use a saga for cross-service order steps with durable progress and explicit compensations. CRDTs suit operations with merge rules; they do not make arbitrary money transfers safe.

### Walk through a failure and recovery

The old worker writes after a new worker acquired ownership. A timestamp check or expired lock in the old worker is insufficient; reject its stale fencing token at the destination.

## R — Result: how to validate the design

Inject clock skew, process pauses and duplicate saga messages. Require valid state transitions and no stale-owner writes; measure unresolved workflow age and compensation failures.

### Check your understanding

Why is “latest timestamp wins” unsafe for simultaneous account withdrawals?

---

## Concepts and implementation details

![Distributed correctness: clocks order observations, fencing protects ownership, and sagas compensate cross-service work](/img/system-design-l6/time-transactions.svg)

Physical clocks drift, so never assume timestamps alone establish causality. Lamport clocks establish a causal ordering; vector clocks can identify concurrent updates. Network partitions can create split brain: two owners act at once.

For exclusive work, use a lease plus **fencing token** that the protected resource rejects when stale. Avoid distributed locks where atomic database/queue claiming owns the state.

Two-phase commit offers coordinated atomicity but can block during failures. Prefer a Saga: each local transaction emits an event and has a defined compensation. An outbox writes business state and its event in one local transaction. CRDTs converge without coordination for suitable mergeable data; operational transformation resolves collaborative edits with an explicit transformation model.

## A checkout Saga in plain language

Reserve inventory locally, then request payment, then create shipment. Each step is durable and emits an event through its outbox. If payment permanently fails, issue a compensating command to release the reservation. Compensation is a new business action; it is not a time machine, so every step must be idempotent and auditable.

Do not use a distributed lock to pretend many databases are one transaction. First ask whether one service can own the invariant. If not, make intermediate states visible (`PENDING`, `UNKNOWN`, `CANCELLED`) and build reconciliation for stuck work.

Choose a consistency model per fact: a cart can merge or be stale; inventory and money need a single authoritative decision.
