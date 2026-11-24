---
title: "Premiere-Night Video Streaming"
summary: "Let millions press Play at once by keeping the small 'can I watch?' checks separate from the huge video data, which is served from copies close to viewers."
level: Advanced
tags: [system-design, video, cdn, streaming, caching]
---

## The story in one minute

A big new show premieres at **8:00 PM**. **Two million** people press Play in the same minute. Each stream averages **5 megabits per second** (Mb/s).

Here is what goes wrong in a naive design:

1. All the video is sent from our own main servers (the **origin**).
2. 2,000,000 viewers × 5 Mb/s = **10,000,000 Mb/s = 10 terabits per second** (Tb/s). No single data center can push that.
3. The servers that check "is this user allowed to watch?" are the same ones sending video, so logins slow down too.
4. Viewers see a spinning wheel. Many give up and complain on social media.

The fix is to put **copies of the video close to viewers before 8:00 PM**, and keep the small "may I watch?" check apart from the heavy video data.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Origin** | Our main storage, where the master copy of each video lives. | The central warehouse. |
| **CDN** (Content Delivery Network) | Many servers around the world (called **edges**) that keep copies of popular files near users. | Local corner shops stocked from the warehouse. |
| **Cache hit ratio** | Out of all requests, the share the edge could answer from its own copy. | 99 of 100 customers find what they need at the corner shop. |
| **Segment** | A short chunk of video, a few seconds long. The player downloads them one after another. | Pages of a book handed over one at a time. |
| **Control plane / data plane** | Control = the small decisions (who, what, may I). Data = the heavy stuff (the actual video bytes). | The ticket desk vs. the cinema screen. |

## The fix in three rules

### Rule 1: Prepare the video before the doors open

Before launch, **transcode** the show: convert it into several quality levels (for example 480p, 720p, 1080p, 4K). Each version is called a **bitrate** (how much data per second it needs). Together they form a **bitrate ladder**.

Cut each version into short **segments** and publish a **manifest**: a small list file that tells the player "here are the segments, at these qualities". Segments never change once published, which makes them easy to cache.

### Rule 2: Send video from the CDN, and size the leftovers

Video comes from **edges** near the viewer. Behind the edges sit **regional shields** (a middle layer of caches that edges ask before bothering the origin).

Now do the maths for what still reaches the origin:

- Total demand: **10 Tb/s**
- At a **99%** byte hit ratio, **1%** misses: 10 Tb/s × 0.01 = **100 Gb/s** still reaches the origin.

100 Gb/s is still a lot. Plan and test that "miss path" explicitly. Don't assume the CDN takes everything.

### Rule 3: Keep the "may I watch?" check separate

❌ **Wrong:** check the database for permission on **every** video segment. That's millions of checks per second.

✅ **Right:** check **once** when Play is pressed. Return a **signed URL**: a link with a built-in, tamper-proof permission stamp that expires soon (say, in a few hours). The CDN can verify the stamp itself, without calling us.

Also **warm** (pre-load) popular segments at the edges, and **spread out** non-urgent writes like "save my playback position", so they don't all land at once.

## Walk through a failure

Traffic shifts to another region, and that region's edge caches are **cold** (empty). Suddenly thousands of viewers ask for the same first segment, and none of the edges have it.

- ❌ Every request goes to the origin. 10,000 identical fetches for one file. The origin falls over.
- ✅ **Request coalescing** (also called *request collapsing*): when many people ask for the same missing file, the cache fetches it **once** and gives the result to everyone waiting. Plus **origin limits** cap how many fetches can reach the origin at once.

**Adaptive bitrate** (the player dropping to lower quality when the network is slow) reduces buffering for viewers. But it does **not** protect the origin by itself. You still need coalescing and limits.

## How to prove it works

Run drills before the real night:

1. **Cold-cache launch drill:** empty the caches, then simulate the 8:00 PM rush.
2. **Region-shift drill:** move traffic to another region mid-stream.
3. Set targets and measure against them: **time to first frame** (how long until the picture appears), **rebuffering** (how often the video pauses to load), **origin egress** (data leaving the origin), and how busy the control-plane services are.

### Check your understanding

With 10 Tb/s total demand, how does a **95%** CDN hit ratio change the bandwidth the origin must handle, compared with 99%?

<details>
<summary>Show answer</summary>

At 95%, **5%** of bytes miss the CDN:

**10 Tb/s × 0.05 = 0.5 Tb/s = 500 Gb/s**

At 99% it was **100 Gb/s**. So dropping from 99% to 95% means the origin side must handle **5 times more** traffic. A hit ratio that "sounds high" can still hide a huge miss load. (Regional shields and request coalescing can absorb part of those misses before the origin, but you must size the miss path for it.)

</details>

---

## Going deeper

## The big idea

At 8:00 PM, millions press Play. Sending every byte through our application servers is like making every cinema customer collect the film reel from one central warehouse. Instead, **put copies in every cinema before the doors open**.

![Premiere streaming splits control-plane APIs from a CDN data plane with edge, regional and origin tiers](/img/system-design-l6/premiere-streaming.svg)

| Plane | Handles | Goal |
| --- | --- | --- |
| **Control** | Login, entitlement (may this user watch this?), manifest, playback progress | Small, **stateless** APIs (they don't keep per-user memory between calls), so you can add more copies easily. |
| **Data** | Video segments | The CDN serves the bytes from a nearby edge. |

The common streaming formats are **HLS** and **DASH**. Both use the same idea: short segments plus a manifest. The player **lowers quality** when bandwidth dips instead of freezing.

## Prepare for a spike you know is coming

- **Pre-warm** the first few segments of the show at the edges (everyone starts at the beginning).
- Use three cache layers: **edge → regional shield → origin**, with request coalescing at each.
- **Pre-scale** (add servers ahead of time for) the entitlement and manifest services.
- Use **short-lived signed URLs**, so segments don't need a permission call each.
- Decide in advance how to **degrade**: cap the top quality, turn off previews, or put new sessions in a short waiting line.

## Saving "where you stopped watching"

The player sends a **heartbeat** (a small "still watching, at minute 12:34" message) every so often.

- Write it to **Redis** (a fast in-memory store) so "resume" is quick.
- Copy it to durable storage **in the background**.
- Include a **timestamp or sequence number**. Otherwise an old phone that wakes up later could move your position **backward** ("you were at minute 2").

## What happens when someone presses Play

1. The app checks **entitlement**: is this user allowed to watch this title, in this country, at this time?
2. If yes, it returns a **short-lived signed manifest URL**.
3. The player downloads the small manifest, which lists segments at several qualities.
4. The player fetches segments from the **CDN**.
5. If its measured network speed drops, it switches to a lower bitrate.

Why this split matters: the permission check is **small and personal**. Video bytes are **huge and identical** for everyone. Never put a database check in front of every segment.

## Plan for bad moments

| Problem | Safe response |
| --- | --- |
| Many edge cache misses at once | Use the regional shield and request coalescing. |
| Origin overloaded | Cap the top bitrate. Protect manifest and permission checks first. |
| Entitlement service slow | Deny access ("fail closed") only where rules require it. Where policy allows, reuse a short-lived cached decision. |
| One title is extremely popular | Pre-place its first segments and give it its own origin capacity. |

## What to watch on your dashboard

- **Startup time** (time to first frame)
- **Rebuffer ratio** (share of watch time spent waiting for video to load)
- **CDN hit rate** and **origin egress**
- **Manifest errors**
- **Control-plane p99** (the response time that 99 out of 100 requests beat)

Keep control-plane logs **separate** from CDN delivery metrics. A fast API does **not** prove viewers aren't buffering.

## Quick recap

- 🎬 **Prepare early:** transcode into several qualities, cut into segments, pre-warm the start.
- 🌍 **CDN carries the bytes:** at 99% hits, 10 Tb/s still leaves 100 Gb/s for the origin. Size it.
- 🎟️ **Check permission once:** signed, short-lived URLs instead of a check per segment.
- 🧊 **Cold caches:** request coalescing and origin limits stop identical fetches piling up.
- 📊 **Measure what viewers feel:** startup time and rebuffering, not just API speed.
