---
title: "Releases, Observability and Production Safety"
summary: "Ship changes safely with rollout strategy, flags, migration discipline, rollback plans and observable service-level outcomes."
level: Advanced
tags: [system-design, deployment, canary, feature-flags, observability, tls, secrets]
---

> **How to read this lesson:** STAR means **Situation → Task → Action → Result**. The scenario and targets below are worked design assumptions, not claims of measured production results.

## S — Situation: the problem in context

A new checkout release changes an order column and payment behavior. Old and new instances must coexist during deployment.

## T — Task: requirements and success criteria

Ship the change while bounding customer impact and preserving a viable rollback or forward-repair path.

## A — Action: design the normal path

1. Use an expand-and-contract migration: add compatible fields, deploy compatible readers/writers, backfill, then remove old usage in a later release.

2. Build an immutable artifact and canary it against representative traffic. Gate rollout on successful checkout latency, errors and business invariants.

3. Use a flag to disable new behavior and document rollback constraints. Rotate secrets and validate configuration without exposing secret values.

### Walk through a failure and recovery

The canary increases duplicate payment attempts while HTTP success stays high. Stop rollout using business metrics and disable the new path. A destructive schema migration can prevent binary rollback, so compatibility must be designed beforehand.

## R — Result: how to validate the design

Exercise rollback with mixed versions and verify migration compatibility. Measure customer failures, detection time, recovery time and invariant violations; a deployment finishing successfully is not a customer outcome.

### Check your understanding

Can yesterday’s application run against today’s database schema?

---

## Concepts and implementation details

![Safe release: CI validates an immutable artifact, controlled rollout observes SLOs, and a rollback path limits blast radius](/img/system-design-l6/release-operations.svg)

| Tool | Purpose |
| --- | --- |
| Rolling rollout | Replace instances gradually |
| Blue-green | Switch between two complete environments |
| Canary | Expose a small cohort before expansion |
| Feature flag | Change behavior without redeploying |
| Schema migration | Keep old/new app versions compatible |

Use immutable artifacts, reversible migrations and a measured rollback trigger. Correlate logs, metrics and traces with request IDs; alert on SLO burn, not noise. Protect traffic with TLS, encrypt sensitive data at rest, rotate secrets, use least-privilege RBAC, and audit sensitive actions.

## Safe release sequence

Build once, test the immutable artifact, deploy it to a small cohort, and compare its error rate, latency and business success to the old version. Expand only while those signals remain inside an agreed threshold. A feature flag can turn off new behavior without redeploying, but it needs an owner and removal date.

Database change? Expand first: add a compatible field/table, release readers that understand both forms, backfill safely, switch writers, then remove old structure only after all old code is gone. Never deploy an irreversible migration and an untested app change together.

| Before release | During | After |
| --- | --- | --- |
| Rollback owner and trigger | Watch SLO, logs, saturation | Verify real user flow and clean flags |

Rollback is not always “deploy old code”: data migrations and external side effects require a specific recovery plan.
