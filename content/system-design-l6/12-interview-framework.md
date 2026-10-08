---
title: "System Design Interview Framework"
summary: "A seven-step path from an ambiguous prompt to a clear, trade-off-aware architecture discussion."
level: Advanced
tags: [system-design, interviews, requirements, capacity, trade-offs]
---

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
