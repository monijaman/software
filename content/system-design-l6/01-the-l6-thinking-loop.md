---
title: "The L6 System-Design Thinking Loop"
summary: "A repeatable Staff-level answer: define correctness, size the load, design failure paths, and measure recovery."
level: Advanced
tags: [system-design, staff, l6, reliability, interviews]
---

## The big idea

An L6 answer is not a list of technologies. It explains **what must never break**, what peak load changes, and how the system behaves when a dependency fails.

An airport is not judged only on sunny days. It must keep people safe during a storm, route around a closed runway, and tell passengers what happens next.

![The L6 design loop: invariant first, then scale, failure, recovery and blast radius](/img/system-design-l6/design-loop.svg)

## Five questions before drawing boxes

| Question | Why it matters | Example |
| --- | --- | --- |
| **Invariant** | Defines correctness. | A card is never charged twice. |
| **Peak** | Average traffic hides capacity limits. | 2M checkouts in five minutes. |
| **Failure window** | Finds duplicate/lost-work gaps. | Provider charge succeeds, app crashes before saving. |
| **Recovery** | Retries need evidence, not guesses. | Look up the provider with the same key. |
| **Blast radius** | Shared resources spread incidents. | An export exhausts checkout's DB pool. |

## A useful answer shape

1. State assumptions and the invariant.
2. Draw the smallest normal-load design.
3. Name the first peak bottleneck.
4. Walk one crash, timeout, or retry.
5. Explain metrics, mitigation, and the durable fix.

> 💡 A good trade-off is specific: “I accept a few seconds of stale playback position to keep playback available” is stronger than “eventual consistency is fine.”
