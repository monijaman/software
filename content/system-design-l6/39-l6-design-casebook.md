---
title: "L6 Design Casebook: Eight Systems and Their Hard Part"
summary: "A readable map from common interview prompts to the correctness rule that makes each production design difficult."
level: Advanced
tags: [system-design, interview, url-shortener, checkout, feed, streaming, crawler]
---

## Do not begin with a diagram

For every prompt, first say: who uses it, the scale, the most important correctness rule, the failure you are designing for, and the measure that proves it works.

| System | Easy first answer | L6 hard part | Simple example |
| --- | --- | --- | --- |
| URL shortener | Key-value lookup | Abuse, custom aliases, hot links and expiration | Cache `xY7` but rate-limit a bot creating 10,000 links. |
| E-commerce checkout | Call payment then save order | No duplicate charge or oversold item | One idempotency key covers every browser retry. |
| Social feed | Store posts and followers | Fan-out for celebrities and ranking freshness | Fan out normal creators; pull a celebrity feed on read. |
| File storage | Upload file to server | Secure large uploads and sharing | Browser uploads directly using a short-lived scoped URL. |
| Video streaming | Save a video | Transcoding, adaptive bitrate and CDN delivery | Slow networks receive 480p segments instead of buffering 4K. |
| Web crawler | Fetch pages in a loop | Politeness, dedupe and retries | One host queue prevents 1,000 concurrent requests to one site. |
| Flash sale | Decrement stock | Never oversell under retries and spikes | Atomic reservation expires if payment is not completed. |
| Collaborative editor | Send text changes | Concurrent edits and offline merge | Two users insert at once; OT/CRDT rules converge safely. |
| Logging platform | Store logs | High-volume ingest, retention and searchable queries | Put writes in partitions; index only useful fields. |

## Example answer: flash sale

1. **Invariant:** sold quantity plus active reservations never exceeds stock.
2. **Write path:** atomically create a short reservation; enqueue payment work with an idempotency key.
3. **Failure:** a payment timeout is `UNKNOWN`, so reconcile it before releasing/reserving again.
4. **Overload:** queue nonessential emails and shed product recommendations first.
5. **Proof:** monitor reservation count, oversell attempts, queue age, payment reconciliation age and checkout p99.

That five-part answer is more valuable than saying only “Redis, Kafka and microservices.”
