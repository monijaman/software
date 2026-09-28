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
