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
