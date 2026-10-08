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

## A notification is not one API call

An order change writes business data and an outbox event in one transaction. A notification service expands it into eligible recipients after checking consent, channel preference, quiet hours and template version. It creates one durable delivery record per recipient/channel with a uniqueness rule such as `(event_id, user_id, channel)`.

Then workers send through email, push or SMS providers. Provider acceptance is not proof a person read it; keep `accepted`, `delivered`, `bounced` and `failed` distinct when the provider supports them.

| Situation | Expected behavior |
| --- | --- |
| User opted out | Do not enqueue marketing message. |
| Provider times out | Keep same delivery key; query/retry safely. |
| Provider is down | Queue bounded work and delay low-priority messages. |
| Bad template | Pause that version; do not repeatedly send it. |

Give transactional messages separate quotas and workers so a campaign cannot delay password resets.
