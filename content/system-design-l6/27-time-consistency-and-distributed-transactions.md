---
title: "Time, Consistency and Distributed Transactions"
summary: "Reason about clocks, ordering, split brain, locks, CRDTs and transactions without promising impossible global certainty."
level: Advanced
tags: [system-design, clocks, lamport, vector-clocks, locks, saga, crdt]
---

![Distributed correctness: clocks order observations, fencing protects ownership, and sagas compensate cross-service work](/img/system-design-l6/time-transactions.svg)

Physical clocks drift, so never assume timestamps alone establish causality. Lamport clocks establish a causal ordering; vector clocks can identify concurrent updates. Network partitions can create split brain: two owners act at once.

For exclusive work, use a lease plus **fencing token** that the protected resource rejects when stale. Avoid distributed locks where atomic database/queue claiming owns the state.

Two-phase commit offers coordinated atomicity but can block during failures. Prefer a Saga: each local transaction emits an event and has a defined compensation. An outbox writes business state and its event in one local transaction. CRDTs converge without coordination for suitable mergeable data; operational transformation resolves collaborative edits with an explicit transformation model.
