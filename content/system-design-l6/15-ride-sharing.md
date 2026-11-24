---
title: "Design a Ride-Sharing Service"
summary: "Find nearby drivers with a map index, then lock one driver to one ride safely. Treat driver locations as fast, rough hints, and ride assignments as firm promises."
level: Advanced
tags: [system-design, ride-sharing, geospatial, matching, realtime]
---

## The story in one minute

Two riders, **Ana** and **Ben**, stand on the same street. They both tap "Request ride" at **9:00:00**.

Here is what goes wrong, step by step:

1. Both requests ask the map: "which drivers are near me?"
2. Both get the same answer: **Driver Dee** is available, 200 m away.
3. But Dee's location is already **10 seconds old**. She has actually driven 150 m further away.
4. Both requests send Dee an offer. She taps "accept" on one, and the system marks her as assigned to **both** rides.
5. One rider waits for a car that will never come.

Finding drivers and **promising** a driver are two different jobs. This lesson keeps them apart.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Geo index** | A map-based lookup: "which drivers are in this area?" | A shopping mall directory map: "shoe stores on level 2." |
| **Cell** | One square (or hexagon) of a grid laid over the map. | One square on a city map's grid, like "B4". |
| **Atomic assignment** | A change that checks and updates in **one** step, so nobody can sneak in between. | Grabbing the last concert ticket at the counter: it's yours, or the clerk says "sold out." |
| **Lease** | A hold that expires on its own after a short time. | A restaurant holding your table for 15 minutes. |
| **Version** | A number that goes up on every change, so old messages can be spotted. | "Revision 3" on a document: a comment on revision 2 is out of date. |

## The fix in three rules

### Rule 1: Use the map to find candidates, not to decide

Driver apps send their location every few seconds. Store it in a **geo index** with:

- a **timestamp** (when this location was reported), and
- an **availability hint** ("probably free").

To search, look in the rider's **cell and the cells around it** (a driver just across the grid line might be the closest one). Then compute the **real distance** to each candidate.

The map only says "these drivers are **probably** nearby and free." It never says "this driver is yours."

### Rule 2: Assign with one atomic, conditional change

To give Dee to Ana's ride, make **one** change on Dee's **authoritative record** (the one true record of her status):

> "Set Dee to `OFFERED` for ride R1, **only if** she is still `AVAILABLE` and her version is still 7."

If two requests try at the same moment, **only one succeeds**. The other one is told "she's taken."

The offer has a **lease** (say, 15 seconds to accept) and carries the ride ID and a **version number**.

### Rule 3: Lost the race? Try the next driver

Ben's request lost the race for Dee. Fine: it moves on to the **next candidate** on its list.

Also keep two kinds of data on **separate paths**:

- **Location updates:** many per second, small, OK to lose a few.
- **Ride status changes:** few, important, saved durably.

After an assignment succeeds, **notify both** rider and driver.

## Walk through a failure

Dee's phone is in a dead zone. Her offer for ride R1 **expires** after 15 seconds. The system gives her a new offer for ride R2 (version goes from 8 to 9). Then her old "accept R1" tap finally arrives.

- ❌ If the system just says "Dee accepted, mark R1 as assigned", she's now on **two** rides.
- ✅ The system checks: "this accept is for **version 8**, but Dee is now at **version 9** (ride R2)." The late accept is **rejected**. R1 goes back to matching and finds another driver.

A delayed message must never bring an old, expired assignment back to life.

## How to prove it works

In a test environment, simulate:

1. **Many riders** requesting at the same instant near the same driver.
2. **Stale locations** (drivers whose last update is old).
3. **Delayed accepts** that arrive after the lease expired.

Then check:

1. Every driver has **at most one active ride**, always.
2. **Match time** (request to assigned) stays within target.
3. How often a chosen candidate turned out to be **stale**.
4. When a lease expires, the ride **recovers** and finds another driver quickly.

### Check your understanding

Why can't a geo search on its own guarantee that a driver goes to only one rider?

<details>
<summary>Show answer</summary>

A geo search only **reads**. It doesn't reserve anything.

Two riders can run the same search at the same moment and get the same driver back. Nothing in the search stops both from acting on it. On top of that, the index is **approximate and a little out of date** (locations are seconds old, the "available" flag may lag).

To make it exclusive, you need an **atomic, conditional write** on the driver's authoritative record: "change to `OFFERED` **only if** still `AVAILABLE` at version N." Only one of the two writes can succeed.

</details>

---

## Going deeper

![Ride-sharing: a geo index finds candidates, an atomic assignment leases a driver, and live updates flow separately](/img/system-design-l6/ride-sharing.svg)

**The one promise:** a driver must never be committed to two rides.

The short version: stream location updates into a geo index where each entry expires on its own (a **TTL**, time to live). Find nearby candidates, then **atomically lease** one driver. If the lease is rejected or times out, release it and try again.

Locations are **eventually consistent** (they'll be right *soon*, not instantly). Ride assignment needs **strong ownership** (right *every time*).

## Two kinds of truth

| | Driver location | Ride assignment |
| --- | --- | --- |
| What it is | A **hint**: "Dee was near this spot 12 seconds ago." | A **promise**: "Dee is driving Ana." |
| How often it changes | Every few seconds, for every driver | A few times per ride |
| OK if a bit wrong? | Yes, and old entries expire quickly | No. One driver, one ride. |
| Storage | Fast in-memory geo index with TTL | Durable database with atomic updates |

Here's the flow. The top line is the fast location path. The bottom lines are the careful matching path.

```text
Driver app -> location stream -> geo index (TTL)
Rider request -> matching service -> nearby candidates
                              -> atomic offer/lease record
                              -> driver accepts or lease expires
```

## Example: two riders, one driver

At 9:00:00, Ana and Ben both search and both see Driver Dee. That's expected: the geo index is **just a search index**.

The assignment service then tries to change Dee from `AVAILABLE` to `OFFERED(ride_id, version, expiry)`. This change is **atomic and conditional**, so only one rider wins:

| Time | Ana's request | Ben's request | Dee's record |
| --- | --- | --- | --- |
| 9:00:00.10 | "Dee, if AVAILABLE v7" ✅ | | `OFFERED(R1, v8, expires 9:00:15)` |
| 9:00:00.12 | | "Dee, if AVAILABLE v7" ❌ | unchanged |
| 9:00:00.13 | | Tries next driver, Eli | |

**Why the lease needs an expiry:** Dee might lose signal right after the offer. Without an expiry, she'd be stuck as `OFFERED` forever, and nobody else could use her.

**Why the version matters:** imagine a cleanup worker that wakes up late and says "release Dee from her expired offer." If Dee already has a **newer** assignment, that late release would wrongly free her. Checking the version (a *fencing token*: a number that only goes up) makes the old worker's change fail.

## Stadium surge: lots of riders at once

A concert ends. 5,000 people request rides from the same block.

Rules to keep it sane:

- **Limit offers per ride:** one rider shouldn't trigger 1,000 offers at once.
- **One live offer per driver:** a driver shouldn't see several offers at the same moment.
- **Short response window:** for example, 15 seconds to accept.
- **Durable ride states,** so every ride is always in exactly one known stage:

```text
REQUESTED -> MATCHING -> OFFERED -> ACCEPTED -> ARRIVED -> COMPLETED
                         \-> EXPIRED / CANCELLED
```

Reading it: a request starts `MATCHING`, gets `OFFERED` to a driver, and then either moves forward to `ACCEPTED` or drops to `EXPIRED` (back to matching) or `CANCELLED`.

**How fresh is "fresh enough"?** That's a **product decision**. For example: "ignore drivers whose last location is older than 30 seconds." Don't promise exact live positions; promise a clear freshness rule.

## What to watch

- How long the **candidate search** takes
- What share of offers are **accepted**
- What share of candidates had a **stale location**
- How many **double-offer conflicts** were blocked
- How many **leases expired** without an answer
- **Supply vs demand** in each area (too many riders, too few drivers?)

A map full of moving cars **looks** live, but that doesn't prove assignments are correct. Measure the assignments themselves.

## Quick recap

- 🗺️ **Geo index:** finds nearby candidates; it's a hint, not a promise.
- 🔒 **Atomic assignment:** "only if still AVAILABLE at version N", so one driver gets one ride.
- ⏳ **Leases + versions:** offers expire, and late messages can't revive old assignments.
- 🛣️ **Two paths:** fast, lossy location updates; careful, durable ride states.
