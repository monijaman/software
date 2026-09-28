---
title: "API Contracts, Gateways and Security"
summary: "Make APIs evolvable and safe with explicit formats, versioning, idempotency, gateway policy, authentication and authorization."
level: Advanced
tags: [system-design, api, gateway, auth, oauth, jwt, security]
---

![API boundary: a gateway applies authentication, authorization, rate limits and routing before services enforce resource-level policy](/img/system-design-l6/api-security.svg)

Define resource/command contracts, error shapes, pagination, idempotency and compatibility before implementation. JSON is common; Protobuf is compact and typed for gRPC. Version deliberately and evolve fields additively where possible.

Authentication proves identity; authorization decides permission. Sessions are server-managed state; signed tokens carry claims but still need expiry, rotation and revocation strategy. OAuth delegates consent, SSO centralizes identity, and RBAC maps roles to permissions.

A gateway is a policy boundary, not the only authorization check. Services must enforce object-level access too. Use TLS, rate limits, audit logs and secrets management.
