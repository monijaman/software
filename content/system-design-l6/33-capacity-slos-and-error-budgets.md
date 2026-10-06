---
title: "Capacity Planning, SLOs and Error Budgets"
summary: "Turn vague scale requirements into traffic, latency, availability and cost decisions that a team can operate."
level: Advanced
tags: [system-design, capacity, slo, sli, error-budget, availability]
---

## Start with a promise, not a server count

An **SLI** is what we measure. An **SLO** is the target we promise ourselves. An **error budget** is how much failure that promise permits.

**Example: checkout API**

| Question | Clear answer |
| --- | --- |
| How fast? | 99% of `POST /checkout` requests finish in under 800 ms. |
| How reliable? | 99.95% successful valid requests in a 30-day window. |
| What is allowed to fail? | About 22 minutes of unavailable time per month. |
| What happens when the budget is gone? | Pause risky releases; spend effort on reliability. |

The important detail is that a valid request which is rejected because inventory is truly sold out is not automatically an availability failure. Define the measurement carefully.

## A small capacity estimate

Suppose a ticket sale expects 2 million visits in one hour, with a five-minute opening rush containing 20% of them.

```text
Opening rush = 400,000 visitors / 300 seconds
             ≈ 1,333 requests per second before retries and assets
```

If each visitor sends three API requests, the API may see roughly 4,000 RPS. Then ask: how many are reads, writes, cache hits, database queries, queue messages and bytes? Add headroom for retries and a failed instance. A capacity plan is a hypothesis to load-test, not a magic calculation.

## Latency has a budget too

For an 800 ms checkout target, do not allow every downstream service 800 ms.

```text
Gateway + validation: 100 ms
Inventory:              150 ms
Payment:                350 ms
Response + safety:      200 ms
```

Pass one deadline down the request path. When the remaining time is too small, stop work instead of starting a request that the caller has already abandoned.

## L6 checklist

- State peak and normal traffic, read/write ratio, payload size and growth rate.
- Name p50, p95 and p99 latency targets; averages hide painful slow requests.
- Reserve failure headroom: an N-instance service should survive one instance, zone or dependency loss where required.
- Measure saturation: CPU, connection-pool use, queue age, disk, provider quota and database locks.
- Connect cost to the design: caching, replication and multi-region copies are not free.
