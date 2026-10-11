---
title: "Data Structures for Scale"
summary: "Use geospatial indexes and probabilistic structures to make huge queries practical while understanding their error bounds."
level: Advanced
tags: [system-design, geohash, quadtree, bloom-filter, hyperloglog, merkle-tree]
---

> **How to read this lesson:** STAR means **Situation → Task → Action → Result**. The scenario and targets below are worked design assumptions, not claims of measured production results.

## S — Situation: the problem in context

A location service must find nearby drivers, count distinct visitors and avoid repeating fetches across billions of URLs.

## T — Task: requirements and success criteria

Choose data structures by query and acceptable error rather than treating every large set as an exact in-memory collection.

## A — Action: design the normal path

1. Use geohash or spatial trees to narrow location candidates, search neighboring cells, then compute exact distance.

2. Use Bloom filters as a negative-membership accelerator: a positive answer needs authoritative confirmation when false positives matter.

3. Use HyperLogLog for approximate cardinality within an agreed error tolerance. Use Merkle trees to find differing ranges, with canonical serialization and a repair procedure.

### Walk through a failure and recovery

A driver lies across a cell boundary and disappears from a same-cell search. Expand neighboring candidates before distance filtering. A Bloom-filter false positive must not silently discard a must-process record.

## R — Result: how to validate the design

Compare answers against an exact baseline on boundary cases and representative data. Measure memory, query latency, false-positive rate and count error; “smaller” is useful only if the error contract is satisfied.

### Check your understanding

Can HyperLogLog tell you which visitor IDs are missing?

---

## Concepts and implementation details

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
