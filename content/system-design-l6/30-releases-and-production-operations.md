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
