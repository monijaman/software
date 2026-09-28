---
title: "Premiere-Night Video Streaming"
summary: "Let millions press Play together by separating small control-plane APIs from CDN-delivered video bytes."
level: Advanced
tags: [system-design, video, cdn, streaming, caching]
---

## The big idea

At 8:00 PM millions press Play. Sending every byte through application servers is like making every cinema customer collect a film reel from one warehouse. Put copies close to viewers before the doors open.

![Premiere streaming splits control-plane APIs from a CDN data plane with edge, regional and origin tiers](/img/system-design-l6/premiere-streaming.svg)

| Plane | Handles | Goal |
| --- | --- | --- |
| **Control** | Auth, entitlement, manifest, progress | Small, stateless, scalable APIs |
| **Data** | Video segments | CDN serves bytes from a nearby edge |

Transcode titles into bitrate ladders and short HLS/DASH segments. The player lowers quality when bandwidth dips instead of stalling.

## Prepare for a known spike

- Pre-warm popular first segments at edges.
- Use edge → regional → origin caches and request collapsing.
- Pre-scale entitlement and manifest services.
- Use short-lived signed URLs so every segment does not call auth.
- Define degradation: cap bitrate, disable previews, or queue sessions.

Heartbeat progress to Redis for fast resume and persist asynchronously to durable storage. Include a timestamp/sequence so an old device cannot move progress backward.

**Watch:** startup time, rebuffer ratio, CDN hit rate, origin egress, manifest errors, and control-plane p99.
