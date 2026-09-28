---
title: "Design a Polite Web Crawler"
summary: "Crawl at scale without revisiting endlessly or overwhelming hosts: normalize, deduplicate and schedule per host."
level: Advanced
tags: [system-design, web-crawler, queues, scheduling, bloom-filter]
---

![Crawler: a URL frontier schedules polite fetches while deduplication and storage process discovered links](/img/system-design-l6/web-crawler.svg)

The URL frontier prioritizes freshness/importance and enforces per-host concurrency, rate limits, robots.txt and crawl-delay. Workers fetch, checksum, parse, normalize links and enqueue unseen candidates.

A Bloom filter cheaply says definitely unseen or possibly seen; false positives mean it cannot be the final source of truth. Measure frontier age, duplicate rate, host compliance and fetch success.
