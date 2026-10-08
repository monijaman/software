---
title: "Releases, Observability and Production Safety"
summary: "Ship changes safely with rollout strategy, flags, migration discipline, rollback plans and observable service-level outcomes."
level: Advanced
tags: [system-design, deployment, canary, feature-flags, observability, tls, secrets]
---

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
