---
title: "System Design Interview Framework"
summary: "A seven-step path from an ambiguous prompt to a clear, trade-off-aware architecture discussion."
level: Advanced
tags: [system-design, interviews, requirements, capacity, trade-offs]
---

## The problem in context

An interviewer asks “Design a messaging app.” There is no stated audience, load, group size, delivery promise or retention policy.

## What must be true

Turn the ambiguous prompt into a defensible design within 45 minutes. Explain decisions as a clear sequence rather than reciting a technology list.

## Practical response

1. Situation: ask who uses it and which workload matters. Task: agree on durable messages, ordering scope, latency and exclusions.

2. Action: estimate peak traffic, define APIs and data keys, and draw one send/read path. Spend the deep dive on the highest-risk failure.

3. Result: describe the tests and metrics that would validate the design. Reserve time for the limits and the next scaling step.

### Walk through a failure and recovery

A gateway crashes after persistence but before acknowledgment. Explain how the client retries the same message ID and fetches missing messages by cursor. This demonstrates the design more clearly than adding another box.

## How to prove it worked

A good answer has explicit assumptions, an authoritative store, one normal flow, one failure flow and measurable targets. In a hypothetical interview, results are proposed validation criteria, not invented production achievements.

### Check your understanding

Practice a two-minute explanation for chat, then identify one assumption that would change the architecture.

---

## Concepts and implementation details

![Interview flow: clarify requirements, estimate scale, draw the core path, then deep dive into risks and recovery](/img/system-design-l6/interview-framework.svg)

1. **Clarify** users, core flows, scope, latency, availability and consistency.
2. **Estimate** peak RPS, storage, bandwidth and growth.
3. **Draw** the smallest core path.
4. **Model data** and name each source of truth.
5. **Define APIs** with authorization and idempotency.
6. **Deep dive** into the hard invariant/bottleneck.
7. **Close** with failure modes, observability, cost and evolution.

State assumptions aloud. Keep the first design simple, name what is intentionally deferred, and explain which metric says a trade-off has stopped being acceptable.

## A 45-minute example plan

| Minutes | Do | Example question |
| ---: | --- | --- |
| 0–5 | Clarify product and success | Is a delayed notification acceptable? |
| 5–10 | Estimate peak and storage | What happens at a product launch? |
| 10–20 | Draw one normal request path | Where is the source of truth? |
| 20–32 | Deep-dive the hardest rule | How is duplicate payment prevented? |
| 32–40 | Break it deliberately | What if the provider times out? |
| 40–45 | Operate and evolve | Which metric alerts us first? |

## Avoid these weak habits

Do not open with a list of trendy services. Do not claim “exactly once” without naming the database constraint and retry behavior. Do not say “use cache” without expiry/invalidation and stale-read consequences. Finish with a decision: what you intentionally keep simple now, and what signal tells you it is time to change it.
