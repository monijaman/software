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
