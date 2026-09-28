---
title: "Design a Reliable Notification System"
summary: "Deliver email, SMS, push and in-app messages with preferences, isolation, idempotency, provider failover and auditable states."
level: Advanced
tags: [system-design, notifications, queues, retries, providers]
---

![Notification service: preferences feed priority queues, channel providers and idempotent delivery tracking](/img/system-design-l6/notifications.svg)

Create an immutable request with idempotency key, audience, channel, template version, priority and expiry. Enforce consent/preferences before enqueueing, and isolate transactional from marketing traffic.

Workers send and record provider ID plus Pending, Accepted, Delivered or Failed. Webhooks update outcomes idempotently. Retry transient errors with backoff; move poison work to a DLQ for investigation.

Watch oldest-job age, provider errors, retry rate, opt-out enforcement and tenant backlog.
