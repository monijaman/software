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

## A safe API contract

For `POST /orders`, document request fields, validation, response states, idempotency header, error format, pagination/cursor rules and versioning policy. A client should distinguish `400` invalid input, `401` no valid identity, `403` identity lacks access, `409` conflict, and retryable overload/timeouts.

Authentication answers “who is this?” Authorization answers “may this person read order 55?” A valid token alone is insufficient: check the resource owner, tenant and action at the service that owns the resource.

## Practical security review

- Validate and normalize input; use parameterized queries.
- Rate-limit by a combination of user, API key, IP and expensive endpoint.
- Keep secrets in a secret manager, rotate them, and never log them.
- Make audit entries for sensitive reads/changes with actor and request ID.
- Use short-lived credentials and least-privilege service identities.

Threat model the most valuable action first: for example, an attacker changing a bank recipient is more important than a cosmetic profile-field error.
