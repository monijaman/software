---
title: "Capacity, Availability, Latency and CAP"
summary: "The constraints that shape every distributed design: load, response time, uptime and partition-time policy."
level: Advanced
tags: [system-design, capacity, availability, latency, cap]
---

> **How to read this lesson:** STAR means **Situation → Task → Action → Result**. The scenario and targets below are worked design assumptions, not claims of measured production results.

## S — Situation: the problem in context

A retailer serves 20 million reads/day, with a peak ten times the daily average. A network partition separates two database replicas during a stock update.

## T — Task: requirements and success criteria

Size traffic and choose a partition-time policy per operation rather than assigning one consistency label to the whole product.

## A — Action: design the normal path

1. Calculate average load: 20,000,000 / 86,400 ≈ 231 reads/s; a 10× peak is about 2,315 reads/s. Estimate bytes, concurrency and growth separately.

2. Define latency and availability targets for specific endpoints. An aggregate average can hide failed checkout requests.

3. Allow cached catalog reads during isolation, but require the authoritative inventory owner for reservation. Refuse or defer a write when safe ownership cannot be established.

### Walk through a failure and recovery

Both sides believe the last unit is available. Permitting independent reservation writes violates the stock invariant. A partition policy must state which requests stop and what users see.

## R — Result: how to validate the design

Partition drills must preserve stock ownership while measuring browse availability and reservation rejection. CAP discusses behavior during partitions; it does not mean a healthy system permanently chooses only two desirable properties.

### Check your understanding

Which endpoint can serve stale data, and how stale may it be?

---

## Concepts and implementation details

## Start with numbers

Estimate peak RPS, bytes per request, read/write ratio, storage growth and concurrent users. **Throughput** is work per second; **latency** is time for one operation.

![Capacity and CAP: a design chooses latency targets, availability targets and a partition-time consistency policy](/img/system-design-l6/capacity-cap.svg)

## Availability and CAP

Availability = uptime / (uptime + downtime). A 99.9% monthly target allows about 43 minutes of downtime; redundancy and tested recovery make the target real.

During a network partition, a distributed store cannot guarantee both the latest value on every read and a successful answer to every request. Payments/inventory normally reject uncertain writes; feeds/counters can serve a stale value. CAP is about partitions, not ordinary-day latency.

## Turn requirements into a starting calculation

For 1 million daily users, do not divide by 86,400 and call it capacity. First find the peak. If 15% arrive in ten minutes and each sends four API calls, that is about 1,000 RPS before retries. Then split it: perhaps 90% reads can use cache, while 10% writes must reach the source of truth.

Estimate storage too: `events/day × bytes/event × retention × replication`. Treat every number as a testable assumption and load-test the real bottleneck.

## Consistency choices in plain language

| Data | If network is uncertain | Why |
| --- | --- | --- |
| Seat reservation | Reject or wait briefly | A wrong “yes” oversells. |
| Bank balance | Reject/verify | Stale money is harmful. |
| Like count | Show an older value | Availability is more valuable. |
| Product search | Show a slightly old index | Checkout will verify later. |

Say what a user sees during a failure. “Eventually consistent” is incomplete until the visible behavior and repair process are stated.
