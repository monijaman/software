---
title: "Data Structures for Scale"
summary: "Clever structures that answer huge questions fast (what's near me, have I seen this before, how many unique visitors) by accepting a small, known error."
level: Advanced
tags: [system-design, geohash, quadtree, bloom-filter, hyperloglog, merkle-tree]
---

## The story in one minute

You run three big systems:

- a ride app that finds **nearby drivers** among 1 million,
- an analytics page that counts **unique visitors** out of billions of visits,
- a web crawler that must not fetch the same URL twice among **billions** of URLs.

Here is what goes wrong, step by step, if you do it the simple way:

1. "Nearby drivers": compute the distance to **all 1 million** drivers for every rider request. Far too slow.
2. "Unique visitors": keep **every visitor ID** in a set. Billions of IDs eat many gigabytes of memory.
3. "Seen this URL?": ask the database for **every** URL. Billions of lookups.
4. So you switch to a grid for drivers. Now a rider standing right on a grid line can't see a driver **10 meters away** in the next square.

Exact answers on huge data are expensive. This lesson shows structures that are fast and small, and how to use them without being fooled by their small errors.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Geohash / grid cell** | Chop the map into squares, each with a short code. | Postcodes: nearby houses share the start of the code. |
| **Bloom filter** | A tiny structure that says "**definitely not** seen" or "**maybe** seen." | A bouncer's fuzzy memory: "Never seen you" is reliable; "I think you've been here" might be wrong. |
| **False positive** | The structure says "yes" when the true answer is "no." | A smoke alarm going off from toast. |
| **HyperLogLog** | Estimates "how many **different** items" using a few kilobytes. | Guessing crowd size from a photo instead of counting each head. |
| **Merkle tree** | A tree of fingerprints that quickly shows which parts of two copies differ. | Comparing chapter checksums instead of rereading two whole books. |

## The fix in three rules

### Rule 1: For "near me", narrow down first, then measure exactly

1. Find the rider's grid cell.
2. Collect drivers in **that cell and the 8 neighboring cells**.
3. Compute the **real distance** to just those few candidates, keep the ones within range.

❌ **Wrong:** search only the rider's own cell.

✅ **Right:** always include neighbors, then filter by exact distance.

### Rule 2: Trust a Bloom filter's "no", double-check its "yes"

A Bloom filter **never** says "no" for something it has seen. But it can say "maybe yes" for something it has **never** seen.

- "**Definitely not seen**": skip the database lookup, it's new.
- "**Maybe seen**": check the real database before acting.

### Rule 3: Use an approximation only where its error is OK

- **HyperLogLog** for "about how many unique listeners today": a ~1% error is fine for a dashboard, **not** for billing.
- **Merkle tree** to find which data blocks differ between two copies, so you only send those blocks. Both sides must turn data into bytes in the exact same way (**canonical serialization**), or identical data will get different fingerprints.

## Walk through a failure

**The border rider.** Rider at the east edge of cell `u4pru`. Driver 10 m away, just over the line in cell `u4prv`.

- ❌ Search one cell: no drivers nearby. Rider waits.
- ✅ Search the cell plus its neighbors: driver found, distance 10 m, offered first.

**The false positive.** The crawler's Bloom filter says "maybe seen" for a brand new URL.

- ❌ Treat "maybe" as "yes" and skip it. That page is **never** crawled.
- ✅ "Maybe" means ask the real visited-URLs table. It says "not seen", so crawl it.

## How to prove it works

1. **Compare to an exact answer** on test data, especially tricky cases (riders on cell borders, at the poles, near the date line).
2. Measure **memory used** and **query speed**.
3. Measure **error**: Bloom filter false-positive rate, HyperLogLog count error.
4. "Smaller and faster" only counts if the error stays within what you agreed is acceptable.

### Check your understanding

Can HyperLogLog tell you **which** visitor IDs are missing from today's count compared to yesterday's?

<details>
<summary>Show answer</summary>

**No.** HyperLogLog doesn't store the IDs at all. It keeps only a few small statistics about the hashed IDs (roughly: "the longest run of leading zeros seen"), which is enough to **estimate how many** different IDs there were. You can't get the IDs back out.

If you need to know **which** IDs, you need the real IDs (a real set, a database table, or a log). HyperLogLog answers "how many?", never "which ones?".

</details>

---

## Going deeper

![Scale-oriented structures: spatial indexes locate nearby items; probabilistic sketches answer large-set questions cheaply](/img/system-design-l6/scale-data-structures.svg)

## The toolbox

| Structure | Question it answers | The catch |
| --- | --- | --- |
| **Geohash / S2 / H3** | What's near this location? | Border cells need a neighbor search. |
| **Quadtree / R-tree** | Which points or shapes overlap this area? | Must rebalance; crowded areas make it lopsided. |
| **Bloom / Cuckoo filter** | Is this item definitely absent? | False positives. |
| **HyperLogLog** | How many different items? | Approximate count. |
| **Count-Min Sketch** | Which keys appear most often? | May **overestimate** counts, never underestimates. |
| **MinHash** | How similar are two sets? | Approximate similarity. |
| **Merkle tree** | Which blocks differ between two copies? | Tree must be updated as data changes. |

## Spatial indexes

**Geohash** turns a latitude/longitude into a string like `u4pruyd`. Longer string = smaller square. Places with the same prefix are in the same square. (Note the reverse isn't guaranteed: two points close together across a border can have very different codes. That's why you search neighbors.)

**S2** (from Google) and **H3** (from Uber) do the same idea with better-shaped cells: S2 uses squares projected from a cube, H3 uses hexagons. Hexagons are handy because all 6 neighbors are the same distance from the center.

**Quadtree:** split the map into 4 squares; any square with too many points splits into 4 again. Downtown gets tiny squares, the countryside stays big. **R-tree:** groups nearby shapes into boxes, then boxes into bigger boxes. Good for shapes like delivery zones, not just points.

## How a Bloom filter works

1. Start with a row of bits, all 0. Say 1,000 bits.
2. To **add** a URL, run it through 3 different hash functions. Each gives a position, e.g. 17, 402, 899. Set those bits to 1.
3. To **check** a URL, hash it the same way. If **any** of its 3 bits is 0, it was **definitely never added**. If all 3 are 1, it was **maybe** added (other URLs might have set those same bits).

More bits and well-chosen hash counts mean fewer false positives. A typical setting: about **10 bits per item gives roughly a 1% false-positive rate**. Compare that with storing whole URLs (often 50 to 100 bytes each).

A **Cuckoo filter** is similar but also lets you delete items, which a plain Bloom filter can't.

## Count-Min Sketch and MinHash in one paragraph each

**Count-Min Sketch:** a small grid of counters. Each item bumps one counter in each row (chosen by hashing). Different items can share a counter, so counts can come out **too high**, never too low. To read, take the **smallest** of the item's counters. Good for "top trending hashtags."

**MinHash:** turns each set into a short "signature." The fraction of matching signature entries estimates how much two sets overlap. Good for "are these two web pages near-duplicates?"

## Merkle trees for syncing copies

Split the data into blocks. Fingerprint (hash) each block. Then hash pairs of fingerprints together, and so on up to one **root** fingerprint.

To compare two copies: compare roots. Same? Done, identical. Different? Compare the two children, then only descend into the side that differs. With 1 million blocks, you find a single bad block in about **20** comparisons (log₂ of 1 million) instead of 1 million. Then **repair** just that block.

## Examples that show the trade-off

- **Crawler:** Bloom filter in front of the durable visited table. "Definitely absent" saves a lookup; "maybe present" asks the database.
- **Music app:** HyperLogLog for approximate daily unique listeners. Fine for dashboards, not for paying artists.
- **Replication:** Merkle tree finds which blocks differ without sending every block.
- **Ride app:** query the driver's cell plus neighbors. The index only finds **candidates**; a separate safe transaction **assigns** exactly one driver.

## Never use a "maybe" as proof

A Bloom filter "maybe yes" must never be the deciding check for **authorization** ("is this user allowed?") or **ownership** ("is this item in stock?"). Those need the real source of truth.

For each approximation you use, write down:

- which way it can be wrong (false positives, false negatives, over- or under-count),
- how big the error can be,
- how often it's rebuilt,
- what you do when it's wrong (the fallback).

If you can't explain what a wrong answer does to a user, don't use it.

## Quick recap

- 🗺️ **Nearby search:** grid cell plus neighbors, then exact distance.
- 🚪 **Bloom filter:** "no" is certain, "maybe" needs checking.
- 🔢 **HyperLogLog:** estimates *how many*, can't tell you *which*.
- 🌳 **Merkle tree:** finds the differing blocks in a few comparisons.
- ⚖️ **Approximations are fine** only where the error is known and harmless.
