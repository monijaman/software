---
title: "Capacity, Availability, Latency and CAP"
summary: "The constraints that shape every distributed design: load, response time, uptime and partition-time policy."
level: Advanced
tags: [system-design, capacity, availability, latency, cap]
---

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
