---
title: "Design a Logging and Monitoring Platform"
summary: "Ingest high-volume telemetry reliably, separate hot search from cheap retention, and make alerting useful rather than noisy."
level: Advanced
tags: [system-design, logging, monitoring, metrics, tracing, observability]
---

## The problem in context

A fleet of 5,000 services emits 200,000 log events/s. During an outage, debug logging increases tenfold and the search cluster falls behind.

## What must be true

Keep telemetry useful without letting observability failure take down production. Define which signals must survive and which may be sampled.

## Practical response

1. Batch at agents with bounded local buffers; prioritize critical events and avoid blocking application threads on ingestion.

2. Append to a durable ingestion stream, then build hot searchable indexes and cheaper archival storage independently.

3. Control high-cardinality fields, retention and access. Query bounded time ranges and separate ingest capacity from interactive search capacity.

### Walk through a failure and recovery

The indexer is down but the ingestion stream is healthy. Retain and replay within the declared retention window. If buffers fill, apply explicit priority-based loss rather than consuming unlimited application memory.

## How to prove it worked

Test indexer outages and a log storm. Measure ingestion lag, dropped events by class, search freshness and application latency. A dashboard remaining online does not prove critical events were retained.

### Check your understanding

Which logs can be sampled, and which require a durable audit trail?

---

## Concepts and implementation details

![Telemetry platform: agents batch into an ingestion layer, durable streams feed hot search, metrics and cold archival](/img/system-design-l6/telemetry-platform.svg)

Agents batch and compress logs, metrics and traces to an authenticated ingestion gateway. A durable stream absorbs bursts; processors index a bounded hot window and archive older data cheaply. Partition by tenant/time, enforce quotas and sample high-cardinality telemetry.

Alerts should use user-facing SLO symptoms and link to runbooks. Preserve tenant isolation, retention controls and an audit trail. Measure ingestion lag, dropped samples, query latency, cardinality and storage cost.

## Design the data lifecycle

Collect structured events with timestamp, service, environment, severity, request/trace ID and tenant-safe labels. The agent batches them to an authenticated gateway. The gateway validates quotas and schema, sends data to durable storage, and acknowledges only after the agreed durability point. Processors build indexes for recent queries; older data moves to cheaper storage with slower retrieval.

Logs, metrics and traces have different cost shapes. Metrics are compact aggregates. Logs contain detail but can explode in volume. Traces sample a subset of requests. Do not put unbounded user IDs or request IDs into metric labels; that creates high-cardinality cost and slow queries.

## Incident-ready questions

Can an engineer find all events for one request? Can each tenant access only its data? What happens if ingest is overloaded: sample debug logs first, or lose security audit records? Define retention and deletion rules before collecting data.
