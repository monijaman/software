---
title: "Premiere-Night Video Streaming"
summary: "Let millions press Play together by separating small control-plane APIs from CDN-delivered video bytes."
level: Advanced
tags: [system-design, video, cdn, streaming, caching]
---

## The problem in context

Two million viewers press Play for a premiere in the same minute. Video averages 5 Mb/s, so payload demand is roughly 10 Tb/s.

## What must be true

Start playback quickly and avoid origin overload. Authorization must remain correct; playback progress may lag.

## Practical response

1. Transcode before launch into several bitrate variants and publish manifests plus immutable segments.

2. Serve video through CDN edges and regional shields. At a 99% byte hit ratio the origin still needs about 100 Gb/s; size the miss path explicitly.

3. Keep entitlement checks and signed playback access in a separate control plane. Warm popular assets and stagger nonessential progress writes.

### Walk through a failure and recovery

An edge cache is cold after a regional shift. Request coalescing and origin limits bound duplicate segment fetches; adaptive bitrate reduces buffering but does not replace origin protection.

## How to prove it worked

Use cold-cache launch drills and region-shift drills. Set explicit targets for time to first frame and rebuffering, then measure origin egress and control-plane saturation against them.

### Check your understanding

How does a 95% CDN hit ratio change the required origin bandwidth?

---

## Concepts and implementation details

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

## What happens when someone presses Play

The app first checks entitlement: is this user allowed to watch this title in this country and time window? It returns a short-lived signed manifest URL. The player downloads a small manifest that lists video segments at several qualities, then retrieves segments from the CDN. It chooses a lower bitrate when its measured network speed falls.

This separation is crucial: auth is small and personalized; video bytes are huge and mostly identical. Do not put a database check in front of every segment.

## Failure and degradation plan

| Problem | Safe response |
| --- | --- |
| Edge cache miss surge | Use shield/regional cache and request collapsing. |
| Origin is overloaded | Cap top bitrate; protect manifest/auth first. |
| Entitlement service slow | Fail closed only where required, with a short cached decision when policy allows. |
| One title is hot | Pre-position first segments and isolate its origin capacity. |

Keep control-plane logs separate from CDN delivery metrics. A fast API does not prove viewers are not buffering.
