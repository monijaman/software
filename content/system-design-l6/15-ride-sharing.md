---
title: "Design a Ride-Sharing Service"
summary: "Match riders and drivers with a geo index, safely lease availability, and treat location as a fast-changing stream."
level: Advanced
tags: [system-design, ride-sharing, geospatial, matching, realtime]
---

![Ride-sharing: a geo index finds candidates, an atomic assignment leases a driver, and live updates flow separately](/img/system-design-l6/ride-sharing.svg)

A driver must not be committed to two rides. Stream location updates into a geo index with TTL. Match nearby candidates, then atomically lease one driver; release/retry on rejection or timeout.

Locations are eventually consistent; ride assignment needs stronger ownership. Watch stale-location age, match latency, conflicts and regional imbalance.

## Two data paths with different truth

Driver location is a high-volume hint: "this driver was near this point 12 seconds ago." It can be eventually consistent and expire quickly. Ride assignment is a business commitment: one driver cannot accept two rides. That needs a durable, atomic state transition.

```text
Driver app -> location stream -> geo index (TTL)
Rider request -> matching service -> nearby candidates
                              -> atomic offer/lease record
                              -> driver accepts or lease expires
```

## Example: two riders see the same driver

At 9:00:00, both Rider A and Rider B query nearby drivers. Both see Driver D because the geo index is only a search index. The assignment service must atomically change D from `AVAILABLE` to `OFFERED(ride_id, version, expiry)` for only one rider. The other request tries the next candidate.

The lease must have an expiry because a driver may lose signal after an offer. Use a version or fencing token so an old timeout worker cannot later release a newer assignment by mistake.

## Stadium surge policy

In a stadium, one rider should not create 1,000 simultaneous driver offers and one driver should not receive multiple live offers. Bound offers per ride, give each offer a short response window, and use a durable request state:

```text
REQUESTED -> MATCHING -> OFFERED -> ACCEPTED -> ARRIVED -> COMPLETED
                         \-> EXPIRED / CANCELLED
```

Location freshness is product policy: perhaps exclude drivers whose last update is older than 30 seconds, rather than promising exact live positions.

Measure candidate-search time, offer acceptance rate, stale-location percentage, double-offer conflicts, lease expiries and supply/demand imbalance by zone. A map that looks live is not proof that assignments are correct.
