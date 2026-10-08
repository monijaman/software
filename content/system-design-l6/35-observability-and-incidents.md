---
title: "Observability and Incident Response"
summary: "Use logs, metrics and traces together to find a real production failure and recover with evidence."
level: Advanced
tags: [system-design, observability, logs, metrics, tracing, incident-response]
---

## Three views of the same request

Imagine checkout becomes slow at 2:05 PM.

- **Metrics** say p99 latency rose from 400 ms to 3.2 seconds and database connections are exhausted.
- **Traces** show 2.7 seconds is spent waiting for the inventory database.
- **Logs** show a new query is missing an index for one product category.

Each tool answers a different question. Metrics tell you **that** something changed, traces tell you **where** time went, and logs help explain **why**.

## Minimum useful request record

```text
request_id=R-82 tenant=acme route=/checkout order_id=981
duration_ms=812 payment_state=UNKNOWN inventory_version=44
```

Propagate `request_id`/trace context through HTTP calls and events. Never log passwords, card numbers, access tokens or unnecessary personal data.

## Alert on user harm

Good alert: "checkout success SLO will exhaust its monthly error budget in 45 minutes."  
Noisy alert: "one CPU sample was 85%."

An L6 incident loop is simple:

1. Confirm the user-visible symptom and the time it began.
2. Limit blast radius: pause a rollout, shed optional traffic, or isolate a bad queue consumer.
3. Use dashboards, traces and recent changes to form and test a hypothesis.
4. Recover safely, then verify the real user path—not only a health endpoint.
5. Write the timeline, root cause, durable fix and a prevention signal.

The goal is not to find someone to blame. It is to make the next failure smaller and easier to see.
