---
title: "Design a Polite Web Crawler"
summary: "Crawl at scale without revisiting endlessly or overwhelming hosts: normalize, deduplicate and schedule per host."
level: Advanced
tags: [system-design, web-crawler, queues, scheduling, bloom-filter]
---

> **How to read this lesson:** STAR means **Situation → Task → Action → Result**. The scenario and targets below are worked design assumptions, not claims of measured production results.

## S — Situation: the problem in context

A search product wants to crawl 100 million pages. One site has a million near-identical URLs and responds with rate-limit errors.

## T — Task: requirements and success criteria

Discover useful pages without overwhelming hosts, looping forever or retrying failed URLs without bounds.

## A — Action: design the normal path

1. Normalize conservatively, record durable URL identity and schedule a frontier by host. Honor host policy and configured crawl limits.

2. Workers lease bounded tasks, fetch with time/size limits, and store results plus discovered links.

3. Use content hashes for duplicate-content detection. A Bloom filter can reduce lookups but false positives mean it cannot be the sole authority when complete coverage is required.

### Walk through a failure and recovery

A worker crashes after storing a page but before ack. Its lease expires and another worker repeats the task; durable identity makes reprocessing safe. A 429 response backs off that host rather than stopping every host queue.

## R — Result: how to validate the design

Test URL cycles, retries and one abusive frontier. Track per-host request rates, useful-page yield, duplicate rate and oldest queued URL; define recrawl freshness by page importance.

### Check your understanding

Why does one global FIFO queue make host politeness difficult?

---

## Concepts and implementation details

![Crawler: a URL frontier schedules polite fetches while deduplication and storage process discovered links](/img/system-design-l6/web-crawler.svg)

The URL frontier prioritizes freshness/importance and enforces per-host concurrency, rate limits, robots.txt and crawl-delay. Workers fetch, checksum, parse, normalize links and enqueue unseen candidates.

A Bloom filter cheaply says definitely unseen or possibly seen; false positives mean it cannot be the final source of truth. Measure frontier age, duplicate rate, host compliance and fetch success.

## One polite crawl cycle

Take one URL from a per-host queue only when that host's next-allowed time has arrived. Check robots rules, fetch with a strict timeout and byte limit, then store response metadata and a content checksum. Parse links, normalize them (remove fragments and canonicalize host/path), and add unseen candidates to the frontier. A separate indexer can process stored content later.

Per-host queues matter: global concurrency of 1,000 is still rude if all 1,000 hit one small website. Respecting `robots.txt` is a product and legal-policy decision, not an optional optimization.

## Make retries safe

Persist crawl state and attempt count. Retry temporary DNS/5xx failures with backoff; stop/review repeated 4xx or parser failures. Deduplicate by canonical URL and, when useful, content hash. Keep a durable visited store because a Bloom filter can mistakenly say a new URL was seen.
