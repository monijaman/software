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

## Reusable case-study worksheet

For any system, fill in this short worksheet before choosing technology:

1. **User promise:** what does success look like, and what delay/staleness is visible?
2. **Authoritative owner:** which table/service makes the final decision?
3. **Peak:** when does load concentrate, and which read/write becomes hot first?
4. **Failure story:** what happens if a process crashes after an external call or an event is delivered twice?
5. **Recovery:** who reconciles `UNKNOWN`/stuck work, using which durable evidence?
6. **Proof:** which user-facing SLO and leading saturation metric show safety?

## Mini examples

| Prompt | Invariant | First degradation |
| --- | --- | --- |
| Chat | Acked messages are durable and per-conversation ordered | Presence can be stale. |
| File upload | Unscanned object is never publicly served | Thumbnail generation is delayed. |
| Crawler | Respect host policy and do not loop forever | Low-priority URLs wait. |
| Feed | Original post is not lost | Timeline may be seconds behind. |
| Multi-region order | No duplicate charge/order | Browsing uses stale cache. |

Practice telling one normal flow, one failure flow and one metric for each prompt. That is how a design becomes an operable system instead of a diagram.
