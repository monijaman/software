---
title: "Design a Logging and Monitoring Platform"
summary: "Ingest high-volume telemetry reliably, separate hot search from cheap retention, and make alerting useful rather than noisy."
level: Advanced
tags: [system-design, logging, monitoring, metrics, tracing, observability]
---

![Telemetry platform: agents batch into an ingestion layer, durable streams feed hot search, metrics and cold archival](/img/system-design-l6/telemetry-platform.svg)

Agents batch and compress logs, metrics and traces to an authenticated ingestion gateway. A durable stream absorbs bursts; processors index a bounded hot window and archive older data cheaply. Partition by tenant/time, enforce quotas and sample high-cardinality telemetry.

Alerts should use user-facing SLO symptoms and link to runbooks. Preserve tenant isolation, retention controls and an audit trail. Measure ingestion lag, dropped samples, query latency, cardinality and storage cost.

## Design the data lifecycle

Collect structured events with timestamp, service, environment, severity, request/trace ID and tenant-safe labels. The agent batches them to an authenticated gateway. The gateway validates quotas and schema, sends data to durable storage, and acknowledges only after the agreed durability point. Processors build indexes for recent queries; older data moves to cheaper storage with slower retrieval.

Logs, metrics and traces have different cost shapes. Metrics are compact aggregates. Logs contain detail but can explode in volume. Traces sample a subset of requests. Do not put unbounded user IDs or request IDs into metric labels; that creates high-cardinality cost and slow queries.

## Incident-ready questions

Can an engineer find all events for one request? Can each tenant access only its data? What happens if ingest is overloaded: sample debug logs first, or lose security audit records? Define retention and deletion rules before collecting data.
