---
title: "Architecture Patterns at Scale"
summary: "Choose client-server, microservices, serverless, event-driven or peer-to-peer architecture based on ownership, failure boundaries and operational cost."
level: Advanced
tags: [system-design, architecture, microservices, serverless, event-driven, p2p]
---

![Architecture patterns: central services, independently deployed services, event functions and decentralized peers](/img/system-design-l6/architecture-patterns.svg)

| Style | Good fit | Main cost |
| --- | --- | --- |
| Client-server | Most products starting out | Central service capacity |
| Microservices | Independent domain ownership/deployments | Distributed operations and contracts |
| Serverless | Bursty event-driven work | Cold starts, limits, observability |
| Event-driven | Decoupled side effects | Ordering, replay, eventual consistency |
| Peer-to-peer | Direct decentralized sharing | Discovery, trust, NAT traversal |

Start with the smallest shape that meets the product need. A peer-to-peer network removes a central data path but does not remove coordination, security or abuse problems.
