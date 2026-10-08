---
title: "Debug Latency Like an Investigator"
summary: "High CPU is not required for high latency. Follow percentile shape and trace wait time before scaling blindly."
level: Advanced
tags: [system-design, latency, observability, incidents, databases]
---

## Start with the shape, not a guess

If p50 is normal but p99 grows, a smaller group is queued, locked, paused, or waiting on a dependency. CPU can be low throughout.

![A latency investigation follows added time through traces, pool wait, database waits and downstream services](/img/system-design-l6/latency-investigation.svg)

| Symptom | Test first |
| --- | --- |
| p50 and p99 rise | Broad capacity, network, deploy, or dependency issue. |
| Only p99 rises | Queueing, locks, GC, pool wait, retries, slow subset. |
| Every morning | Batch reports, backup, cache expiry, scheduled work. |
| Restart helps briefly | Warm cache, leak, churn, periodic trigger. |

## Safe response sequence

1. Record window, route/tenant/region, percentiles, error rate.
2. Compare healthy and slow traces; locate the span that gained time.
3. Inspect queue age, pool acquisition, query plan/locks, pauses, or dependency timing.
4. Apply the smallest reversible mitigation and verify the same metric improves.
5. Fix root cause and alert on the leading signal.

> ⚠️ Do not scale first. More app servers can mean more borrowers for the same exhausted connection pool. Prove where the wait lives.

## Example investigation

At 10:00, checkout p99 rises from 500 ms to 5 s but p50 stays near 300 ms. A trace shows only slow requests spend four seconds acquiring a database connection. Database CPU is 40%, so “add database CPU” is not an evidence-based fix. Pool metrics show all connections are borrowed by a reporting endpoint introduced that morning.

Mitigation: limit/report traffic and reserve a pool for checkout. Durable fix: move reports to a replica or asynchronous warehouse, set per-route concurrency, and alert on pool wait before customer latency rises.

## Useful evidence order

1. Compare p50/p95/p99 and error rate over the same window.
2. Segment by route, region, release, tenant, status code and dependency.
3. Compare a healthy and a slow trace; find added waiting time.
4. Inspect the owning resource: queue, pool, lock, query plan, network or CPU pause.
5. Change one reversible control and verify the predicted metric moves.

Record the trigger, leading signal, mitigation and prevention in the incident note. “Restarted it” is not a root cause.
