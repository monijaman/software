---
title: "Data Structures for Scale"
summary: "Use geospatial indexes and probabilistic structures to make huge queries practical while understanding their error bounds."
level: Advanced
tags: [system-design, geohash, quadtree, bloom-filter, hyperloglog, merkle-tree]
---

![Scale-oriented structures: spatial indexes locate nearby items; probabilistic sketches answer large-set questions cheaply](/img/system-design-l6/scale-data-structures.svg)

| Structure | Useful question | Trade-off |
| --- | --- | --- |
| Geohash / S2 / H3 | What is near this location? | Border cells need neighbor search |
| Quadtree / R-tree | Which shapes/points overlap this area? | Rebalancing and skew |
| Bloom / Cuckoo filter | Is an item definitely absent? | False positives |
| HyperLogLog | How many distinct items? | Approximate count |
| Count-Min Sketch | Which keys are frequent? | Overestimation |
| MinHash | How similar are two sets? | Approximate similarity |
| Merkle tree | Which replicated blocks differ? | Tree maintenance |

Use an approximation only where its error is safe and measurable. Never use a Bloom-filter positive as proof of authorization or inventory ownership.

## Examples that show the trade-off

A crawler uses a Bloom filter before its durable visited table: “definitely absent” avoids a lookup, while “maybe present” asks the database. A music app uses HyperLogLog for approximate daily unique listeners; a small error is acceptable for dashboards but not billing. A replication system uses a Merkle tree to identify which blocks differ without sending every block.

For nearby drivers, query the driver cell plus neighboring cells because a rider near a border may be close to a driver in the next cell. The spatial index finds candidates; the assignment transaction still chooses one driver safely.

Write down each approximation's false-positive/false-negative direction, error bound, refresh cycle and fallback. If you cannot explain what a wrong answer does to a user, do not use it.
