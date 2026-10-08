---
title: "Networking, DNS and Traffic Routing"
summary: "Understand the request path from OSI layers and DNS through load balancers, anycast and reverse proxies."
level: Advanced
tags: [system-design, networking, dns, anycast, load-balancing]
---

![Traffic routing: DNS and anycast select a nearby entry point, then a reverse proxy and load balancer choose a healthy service](/img/system-design-l6/network-routing.svg)

The OSI model is a troubleshooting map: application protocols run over transport (TCP/UDP), then network routing (IP), then links/physical delivery. A hostname becomes IP addresses through DNS; DNS load balancing can return different healthy endpoints by region or policy.

**Anycast** advertises one IP from multiple locations, so routing usually reaches a nearby edge. A layer-4 balancer routes connections; a layer-7 proxy understands HTTP and can route by host/path, terminate TLS and apply policies.

Monitor DNS TTL/propagation, edge health, connection errors, regional latency and uneven load. A DNS answer is not a guarantee that an endpoint is healthy now.

## Follow one request

A browser resolves a name through DNS, opens a TLS connection to an edge/load balancer, then the reverse proxy picks a healthy application target. The proxy may route `/api` to an API pool and `/images` to a CDN, add request IDs, enforce a rate limit, and retry only safe upstream failures. The application still must set deadlines and authorization; a proxy cannot make an unsafe service safe.

## Failure decisions

| Failure | Useful response |
| --- | --- |
| One instance fails health check | Remove it from new traffic; let in-flight work drain. |
| One zone fails | Load balance to other zones with capacity headroom. |
| Region fails | Fail over according to RPO/RTO and data policy. |
| DNS record changed | Keep TTL realistic; expect old answers to linger. |

Health checks should represent the ability to serve the requested route, not merely that a process is running.
