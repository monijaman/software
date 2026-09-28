---
title: "Design a Ride-Sharing Service"
summary: "Match riders and drivers with a geo index, safely lease availability, and treat location as a fast-changing stream."
level: Advanced
tags: [system-design, ride-sharing, geospatial, matching, realtime]
---

![Ride-sharing: a geo index finds candidates, an atomic assignment leases a driver, and live updates flow separately](/img/system-design-l6/ride-sharing.svg)

A driver must not be committed to two rides. Stream location updates into a geo index with TTL. Match nearby candidates, then atomically lease one driver; release/retry on rejection or timeout.

Locations are eventually consistent; ride assignment needs stronger ownership. Watch stale-location age, match latency, conflicts and regional imbalance.
