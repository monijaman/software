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
