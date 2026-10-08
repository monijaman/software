---
title: "Design a Polite Web Crawler"
summary: "Crawl at scale without revisiting endlessly or overwhelming hosts: normalize, deduplicate and schedule per host."
level: Advanced
tags: [system-design, web-crawler, queues, scheduling, bloom-filter]
---

![Crawler: a URL frontier schedules polite fetches while deduplication and storage process discovered links](/img/system-design-l6/web-crawler.svg)

The URL frontier prioritizes freshness/importance and enforces per-host concurrency, rate limits, robots.txt and crawl-delay. Workers fetch, checksum, parse, normalize links and enqueue unseen candidates.

A Bloom filter cheaply says definitely unseen or possibly seen; false positives mean it cannot be the final source of truth. Measure frontier age, duplicate rate, host compliance and fetch success.

## One polite crawl cycle

Take one URL from a per-host queue only when that host's next-allowed time has arrived. Check robots rules, fetch with a strict timeout and byte limit, then store response metadata and a content checksum. Parse links, normalize them (remove fragments and canonicalize host/path), and add unseen candidates to the frontier. A separate indexer can process stored content later.

Per-host queues matter: global concurrency of 1,000 is still rude if all 1,000 hit one small website. Respecting `robots.txt` is a product and legal-policy decision, not an optional optimization.

## Make retries safe

Persist crawl state and attempt count. Retry temporary DNS/5xx failures with backoff; stop/review repeated 4xx or parser failures. Deduplicate by canonical URL and, when useful, content hash. Keep a durable visited store because a Bloom filter can mistakenly say a new URL was seen.
