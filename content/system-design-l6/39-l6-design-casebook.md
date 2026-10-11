---
title: "L6 Design Casebook: Nine Systems and Their Hard Part"
summary: "A readable map from common interview prompts to the correctness rule that makes each production design difficult."
level: Advanced
tags: [system-design, interview, url-shortener, checkout, feed, streaming, crawler]
---

> **How to read this lesson:** STAR means **Situation → Task → Action → Result**. The scenario and targets below are worked design assumptions, not claims of measured production results.

## S — Situation: the problem in context

You are preparing for an interview and can name Redis, Kafka and sharding, but struggle to explain how a user request succeeds or recovers.

## T — Task: requirements and success criteria

Build a casebook of complete scenarios with STAR. Each answer needs a user, constraints, an authoritative owner and one failure window.

## A — Action: design the normal path

1. Choose one linked case below and state its Situation and Task before drawing anything.

2. Walk its Action as ordered durable state transitions, then inject a crash or hot-key overload.

3. State its Result as measurable acceptance criteria and discuss what changes at ten times the load. Use actual measurements only when you have actual evidence.

### Walk through a failure and recovery

An answer says “use a queue” but never identifies who owns the last inventory unit. Ask what happens with two concurrent consumers; the missing atomic ownership rule becomes visible immediately.

## R — Result: how to validate the design

For each practice answer, require a normal flow, a failure/recovery flow, a specific tradeoff and a testable outcome. These are study scenarios; none of the proposed targets should be presented as historical production results.

### Check your understanding

Give a three-minute STAR answer for checkout without naming a technology until the requirements are clear.

---

## Concepts and implementation details

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

## Choose a complete STAR walkthrough

Each linked lesson starts with the scenario, requirements, design steps, failure recovery and validation criteria. Read one end to end before comparing patterns.

| Case | Situation | Task | Key action | Result to validate |
| --- | --- | --- | --- | --- |
| [Short links](./url-shortener) | A campaign goes viral | Fast redirects and prompt abuse disablement | Cache durable mappings with bounded fallback | Hot-link latency and disablement delay |
| [Checkout](./ecommerce-checkout) | Payment succeeds before the API crashes | One charge and a recoverable order | Durable intent, reservation and reconciliation | No duplicate charge or oversell |
| [Feed](./social-media-feed) | A celebrity posts to ten million followers | Fresh feeds without unbounded fan-out | Hybrid fan-out with read-time visibility checks | Feed latency, freshness and privacy |
| [Files](./file-storage) | A large upload drops mid-transfer | Resume safely and enforce sharing | Multipart upload with verified publication | Completion success and revocation delay |
| [Streaming](./premiere-streaming) | Millions press Play together | Fast playback with bounded origin traffic | Prepared variants, CDN and shield tiers | Startup time, buffering and origin egress |
| [Crawler](./web-crawler) | One host dominates the URL frontier | Crawl without loops or host overload | Host scheduling and durable task identities | Politeness, useful yield and queue age |
| [Flash sale](./flash-sale-inventory) | Millions compete for limited stock | Never sell the last unit twice | Atomic reservation and payment-aware expiry | Stock conservation under races and crashes |
| [Editing](./collaborative-document-editing) | Concurrent/offline edits cross a failover | Converge and preserve acknowledged edits | Stable operation IDs, merge rules and fencing | Convergence and durable recovery |
| [Telemetry](./logging-and-monitoring-platform) | Incident logs overwhelm indexing | Preserve critical signals without blocking apps | Bounded agents, durable ingestion and tiered storage | Critical-event retention and search freshness |

## Example STAR answer: flash sale

**Situation:** One thousand phones go on sale while ten million buyers are interested. Two buyers may see the same cached “one left” value.

**Task:** Confirmed sales plus active reservations must never exceed stock. The system must show a clear waiting, rejected, pending or confirmed outcome.

**Action:** Admit a bounded number of buyers, atomically reserve against durable inventory, and persist a stable payment intent. If payment times out after possible acceptance, reconcile before releasing stock. Send receipts through an outbox after confirmation.

**Result:** Race requests for the final unit, retry the same intent and crash after provider acceptance. Require one stock owner and no second charge; monitor queue age, unresolved payment age and customer completion latency. These are acceptance criteria to test, not an invented success story.

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
