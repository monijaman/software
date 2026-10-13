---
title: "Design a URL Shortener"
summary: "Generate durable short links, redirect in milliseconds, prevent abuse and keep analytics off the redirect path."
level: Advanced
tags: [system-design, url-shortener, redirects, analytics]
---

> **How to read this lesson:** STAR means **Situation → Task → Action → Result**. The scenario and targets below are worked design assumptions, not claims of measured production results.

## S — Situation: the problem in context

A marketing team creates short links for campaigns. One link goes viral at 10,000 redirects/s, while the security team must disable malicious destinations promptly.

## T — Task: requirements and success criteria

Keep redirect p99 below a proposed 100 ms target while resolving only valid, unexpired mappings. Analytics may arrive minutes later.

## A — Action: design the normal path

1. Expose POST /links and GET /{code}. Validate destinations and write a unique code, owner, status, expiry and destination durably.

2. Read cache before storage and return a redirect. Use collision-checked random codes or encoded allocated IDs; choose based on enumeration risk.

3. Send click events asynchronously. Bound redirect caching and define active invalidation for disablement; long browser-cached permanent redirects undermine fast revocation.

### Walk through a failure and recovery

The cache fails during a viral campaign. Limit fallback concurrency and coalesce misses instead of sending all 10,000 requests/s to storage. A disabled link must not remain served indefinitely from an edge cache.

## R — Result: how to validate the design

Load-test a hot code, remove the cache and disable that code during traffic. Measure redirect latency, storage fallback rate and disablement propagation. State whether analytics loss is tolerated under overload.

### Check your understanding

When would you choose a temporary redirect instead of a permanently cached redirect?

---

## Concepts and implementation details

A short code must resolve to its intended unexpired destination or safely fail.

![URL shortener: durable mappings, cache-backed redirects and asynchronous analytics](/img/system-design-l6/url-shortener.svg)

Generate a Base62 database ID or collision-checked random code. Store code, destination, owner, expiry and status with a unique key. Redirects read edge/cache then durable storage; click analytics is asynchronous.

Protect users with rate limits, phishing scans and destination validation. Disabled links must invalidate quickly.

## Start with the product contract

Before choosing Redis or a database, decide what a link means. A user expects `go.example/xY7` to send them to the same safe destination until it expires or is disabled. A custom alias must be unique, and the owner must be able to see clicks without making every redirect slow.

**Example requirements:** 10,000 redirect requests per second at peak, 99% redirects below 100 ms, links retained for one year, and click analytics may arrive a few minutes late.

## A simple request flow

```text
Create link: client -> API -> validate destination -> create durable mapping
                                   -> cache mapping

Open link:   browser -> CDN/redirect API -> cache -> mapping database
                                                -> 302 redirect
                                   -> async click event -> analytics pipeline
```

The redirect path should return the destination quickly. It should not wait for analytics, fraud dashboards, emails or aggregation jobs.

## Choosing a short code

Base62 (`a-z`, `A-Z`, `0-9`) makes compact human-friendly codes. A database sequence encoded as Base62 has no collisions, but exposes growth/order. A random code hides order, but needs a unique constraint and a retry if it collides. Either option is fine when the durable database—not cache memory—decides ownership.

## Failure cases that change the design

| Situation | Safe behavior |
| --- | --- |
| Redis is empty or down | Read the durable mapping; use a bounded fallback so the database is not flooded. |
| A popular link becomes viral | Cache at edge/Redis, add TTL jitter and protect the origin with rate limits. |
| Owner disables a malicious link | Mark it disabled durably and actively invalidate cache/edge entries. |
| Analytics queue is slow | Keep redirects working; retain or shed noncritical click events by an explicit policy. |

## What proves it works?

Track redirect p95/p99, cache-hit rate, database fallback rate, mapping-creation collisions, disabled-link propagation delay, suspicious-destination blocks and analytics lag. The system is successful when a viral link stays fast without allowing a harmful link to remain reachable after disablement.
