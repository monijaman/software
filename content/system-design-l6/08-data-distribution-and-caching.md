---
title: "Caching, Consistent Hashing and Sharding"
summary: "Keep fast copies of popular data close to users, spread data across many machines in a stable way, and understand what can go stale when you do."
level: Advanced
tags: [system-design, caching, sharding, consistent-hashing, databases]
---

## The story in one minute

A shop's product catalog gets **100,000 reads per second**. A celebrity posts about one product, and suddenly **half** of all reads (**50,000 per second**) are for that **one** product. In the middle of the rush, its price changes.

Here is what goes wrong:

1. Every read goes to the database, which can't keep up.
2. The team adds a cache (a fast copy of data in memory). Things get better.
3. Then the cache machine holding the hot product **dies**. All 50,000 reads per second rush to the database at once. The database falls over.
4. Meanwhile, some users still see the **old price** from the cache and get a nasty surprise at checkout.

This lesson covers three tools (caching, consistent hashing and sharding) and how to use them without these surprises.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Cache** | A fast copy of data kept close by, so you don't ask the slow source every time. | Keeping milk in your fridge instead of going to the shop each time. |
| **TTL** (time to live) | How long a cached copy is trusted before it must be refreshed. | A "best before" date on the milk. |
| **Hot key** | One item that gets a huge share of all requests. | The one checkout lane everyone queues at. |
| **Consistent hashing** | A way to assign items to machines so that adding or removing a machine moves only a few items. | Rearranging a few seats when one guest leaves, not reseating the whole wedding. |
| **Shard** | One slice of a big database, stored on its own machine. | Splitting a phone book into A to F, G to M, N to Z volumes. |

## The fix in three rules

### Rule 1: Cache with a freshness limit, and share misses

Cache product reads with a **clear freshness limit** (for example, "at most 30 seconds old").

When the cached copy expires, thousands of requests may all miss at the same moment. Use **request coalescing**: **one** request reloads from the database, and the others wait a moment and share its result.

- ❌ 1,000 misses → 1,000 database reads.
- ✅ 1,000 misses → **1** database read.

### Rule 2: Spread keys across cache machines with consistent hashing

Consistent hashing decides which cache machine holds which key, and keeps that mostly stable when machines come and go. **Virtual nodes** (each real machine appears at many spots on the "ring") spread keys more evenly.

But: one key **always** lives on **one** machine. Consistent hashing **cannot split a single hot key**. You need extra tricks for that (see the answer below).

### Rule 3: The database owns the truth; check the price at checkout

Split the durable database into **shards** based on how data is read and how it grows.

When a price changes:

1. Save it in the database **first**.
2. **Then** remove or update the cached copy.
3. Give cache entries a **version number**, so an older value can't overwrite a newer one.
4. At checkout, **always re-check the price** from the database. The cache is never the source of truth.

## Walk through a failure

The cache machine holding the hot product dies.

- ❌ All 50,000 reads per second fall through to the database at once. This is called a **cache stampede**.
- ✅ Three things stop it:
  - **Request coalescing:** one reload instead of thousands.
  - **A capped database fallback:** only a limited number of reloads can hit the database at once; the rest wait briefly or get a slightly older copy.
  - **TTL jitter:** add a small random amount to each TTL (for example 60 s plus 0 to 10 s), so lots of keys don't all expire in the **same** second.

What if a product must be **disabled** right now (say, it's recalled)? Don't rely on "the cache will expire eventually". Decide a **maximum delay** (for example, "hidden everywhere within 10 seconds") and push the change out to meet it.

## How to prove it works

1. Measure the **hit ratio per hot key** (not just overall), the request rate reaching the database, how slow a miss is, and **how long stale values survive**.
2. Test **a cache machine dying** and **a price change** at the same time.
3. Check each shard separately. A great overall hit ratio can hide **one overloaded shard**.

### Check your understanding

Why doesn't adding ten more cache machines fix one hot key?

<details>
<summary>Show answer</summary>

Because hashing sends a given key to **exactly one** machine. Adding machines spreads the **other** keys more thinly, but the hot key still lands on one machine.

With the numbers from the story:

- **10 machines:** the other 50,000 reads/s are spread out, 5,000 per machine. The hot machine gets 50,000 + 5,000 = **55,000**.
- **20 machines:** others get 2,500 each. The hot machine still gets 50,000 + 2,500 = **52,500**.

Twice the machines, and the hot one barely changed.

**What actually helps:**

- Keep a small **local cache** inside each app server for the hot item.
- Store **several copies** of the hot key under different names (`product:42#1` to `product:42#8`) on different machines, and have readers pick one at random.
- Serve the product page from a **CDN** (servers near users that hold copies of pages).
- Use **request coalescing** so misses don't stampede.

</details>

---

## Going deeper

## Three tools, three different jobs

![A request can use cache for speed, consistent hashing for stable placement, and shards for database scale](/img/system-design-l6/data-distribution.svg)

| Tool | What it solves | What can go wrong |
| --- | --- | --- |
| **Cache** | Repeated reads are slow or costly. | Stale data, and stampedes when entries expire. |
| **Consistent hash ring** | Deciding which machine holds a key, even as machines change. | Hot keys. Virtual nodes even out the spread but don't split one key. |
| **Sharding** | One database can't hold or write everything. | Work across shards is hard, and re-sharding later is painful. |

## Ways to use a cache

| Pattern | How it works |
| --- | --- |
| **Cache-aside** | The app checks the cache. On a miss, the **app** reads the database and puts the result in the cache. (Most common.) |
| **Read-through** | The app only talks to the cache. On a miss, the **cache** loads from the database itself. |
| **Write-through** | Every write goes to the cache **and** the database together, so the cache stays up to date. |

Whichever you choose, **TTL, invalidation** (removing outdated entries) **and request coalescing** are part of the design, not extras.

## Cache-aside, step by step

1. Ask the cache for `product:42`.
2. **Hit?** Return it, if it's fresh enough.
3. **Miss?** Read the database (the real source).
4. Put the result in the cache with a limited TTL, then return it.
5. **On a product update:** save to the database **first**, then remove or update the cached copy, using a **reliable event** (one that is retried until delivered) so the cache isn't left stale if a step fails.

For a popular key, a thousand misses at the same moment can stampede the database. Defences:

- **Request coalescing:** one refresh, others wait briefly.
- **Stale-while-revalidate:** keep serving the slightly old copy while **one** request fetches a fresh one in the background.
- **Jittered TTLs:** random extra seconds so keys don't all expire together.
- **A safe fallback:** a capped number of database reads.

> ⚠️ Never cache a permission decision ("may this user see this?") for longer than your rules allow a permission to stay active after it's taken away.

## Why consistent hashing helps: a worked example

Simple way: `machine = hash(key) % number_of_machines` (the remainder after dividing).

Go from **10 machines to 11**, and almost every key's remainder changes. About **10 out of 11 keys (≈ 91%)** move to a different machine. The cache is suddenly almost empty, and the database gets hammered.

**Consistent hashing** places machines and keys on a circle (a "ring"). Each key belongs to the next machine clockwise. Add an 11th machine, and only the keys between it and its neighbour move: about **1 in 11 (≈ 9%)**.

| Going from 10 to 11 machines | Keys that move |
| --- | ---: |
| `hash % N` | about 91% |
| Consistent hashing | about 9% |

## Choose your shard key on purpose

A **shard key** is the field that decides which shard a row goes to. Pick one that **spreads load evenly** and **matches your most common queries**:

- **Tenant ID** (one business customer) for a multi-tenant product (one app serving many companies).
- **User ID** for personal data.

Even a good key can have a giant: a celebrity user, or one huge business customer, can make **one shard hot**. Plan an escape route ahead of time:

- split that big tenant across several shards,
- add **buckets** (sub-divide its key into several pieces),
- or send its reads to a special store built for it.

Queries and transactions **across shards** are possible, but they're slow and complicated. Think about them **before** you choose the shard key, not after.

## Quick recap

- 🧊 **Cache = fast copy, not truth:** set a freshness limit and re-check price at checkout.
- 🌊 **Stop stampedes:** request coalescing, TTL jitter, stale-while-revalidate, capped fallback.
- 💍 **Consistent hashing:** adding a machine moves about 1/N of keys, not nearly all of them.
- 🔥 **Hot keys need special care:** more machines don't split one key; copy it or cache it locally.
- 🗂️ **Shard by how you read:** pick the shard key carefully and plan for one giant tenant.
