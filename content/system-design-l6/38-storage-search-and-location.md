---
title: "Storage, Search and Location Queries"
summary: "Use the right tool for each job (object storage for files, a search index for text, a geo index for 'near me') while one main database stays the final word on what's real."
level: Advanced
tags: [system-design, object-storage, search, geospatial, presigned-url]
---

## The story in one minute

You run a property app. It has three jobs:

- store **listing photos** (lots of big files),
- **search** descriptions ("sunny flat with balcony"),
- show homes **within 2 km** of where the user is.

Here is what goes wrong, step by step:

1. The team puts photos, search and location all into the main database. Uploads of 10 MB photos clog the API servers, and text search is slow.
2. So they add a **search index** (a separate system built for text search) and a **geo index** (built for "near me").
3. A landlord **deletes** a listing. The main database marks it deleted.
4. The message telling the search index about the deletion gets **lost**.
5. The deleted home keeps showing up in search for days. Users call about a flat that's gone.

Each tool is great at its job. The trouble starts when a copy disagrees with the truth. This lesson is about using the right tools **and** keeping one source of truth.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Object storage** | Cheap, huge storage for files ("objects"), like S3. | A giant warehouse of labeled boxes. |
| **Presigned URL** | A temporary link that lets someone upload or download one specific file directly. | A one-time visitor pass for one room, valid for 10 minutes. |
| **Search index** | A separate copy of data organized for fast text search. | A book's index: words point to pages. |
| **Geospatial index** | Data organized by location, for "what's near here?" | A city map divided into numbered squares. |
| **Source of truth** | The one place whose answer wins when copies disagree. | The official registry, not someone's photocopy of it. |

## The fix in three rules

### Rule 1: Files go to object storage, facts go to the database

- **Photo bytes** go to object storage.
- **Facts about the photo** go to the main (**transactional**) database: who owns it, which listing it belongs to, whether it's published.

The database is small and strict; object storage is huge and cheap. Each does what it's good at.

### Rule 2: Search and geo indexes are copies, built from changes

- When a listing changes, the database records it with a **version number** (listing 88, version 5) and publishes a change event.
- The search and geo indexes **update themselves from those events**, a little later (this is called **asynchronous**).
- For anything sensitive, like a **deleted** listing or **private** data, double-check the database before showing it.

❌ **Wrong:** "the search index says it exists, so show it."

✅ **Right:** "the search index found 20 candidates; check the database to hide any that are deleted or private."

### Rule 3: Scope access, search neighbors, and be able to rebuild

- Upload and download links are **short-lived** and only for **one file**.
- For "within 2 km", search the user's grid cell **and the neighboring cells**, then compute the **exact distance**.
- Keep a way to **rebuild** any index from scratch from the database.

## Walk through a failure

The search index missed the "listing 88 deleted" event.

1. **Short-term safety:** before showing results, filter them against the database's current visibility. Listing 88 is hidden, even though search still has it.
2. **Fix the pipe:** make deletions travel through a reliable path (an outbox and retries) with a time limit, e.g. "deletions reach search within 1 minute."
3. **Careful replay:** when you replay old events to repair the index, an old "version 4: listing active" event must **not** bring back listing 88, which is now version 5 (deleted). The index only applies a change if its version is **higher** than what it already has.

## How to prove it works

Test these together, not one at a time:

1. **Index lag:** slow the index updates on purpose. Deleted listings must still not appear.
2. **Deletion:** delete a listing, measure how long until it's gone from search.
3. **Interrupted upload:** cut an upload halfway. No broken photo should show, and the leftover bytes should be cleaned up.
4. **Measure:** search freshness, location correctness, **orphan bytes** (files in storage that nothing points to), and deletion delay, not just query speed.

### Check your understanding

Which store decides whether a listing is visible: the search index or the metadata database?

<details>
<summary>Show answer</summary>

The **metadata database**. It's the source of truth for the listing's lifecycle (draft, published, deleted).

The search index is a **copy** built for fast searching. It can be a few seconds behind, or wrong if an event was lost. So search can **suggest** results, but the database **decides** what's visible, especially for deleted or private listings.

</details>

---

## Going deeper

## Three questions, three tools

| Need | Typical tool | Example |
| --- | --- | --- |
| Store a 2 GB video | Object storage | S3-like bucket, uploaded with a presigned URL. |
| Find "spicy noodles" | Search index | Splits text into words, ranks matches, applies filters. |
| Find riders within 2 km | Geospatial index | Geohash, grid or R-tree style nearby lookup. |

## File upload example

Instead of sending the file **through** your API, let the client upload straight to storage:

```text
Client -> API: ask to upload profile-photo.jpg
API    -> Client: short-lived, scoped presigned upload URL
Client -> Object storage: upload directly
Storage -> scanner/worker: validate, scan, resize
API/database: mark file usable only after validation
```

Why this way? If 1,000 users upload 10 MB at once, that's 10 GB flowing. Your API servers don't have to carry it; object storage is built for it.

Safety rules:

- **Limit size and type** (e.g. images only, max 20 MB) in the presigned URL itself.
- Keep objects **private by default**. Serve them through short-lived download links.
- **Scan** untrusted files for malware, and check they really are images.
- **Authorize both** upload ("may this user add a photo to listing 88?") and download.
- Mark the file usable only **after** it passes checks.

## Search is a copy, not the truth

A **projection** is a copy of data reshaped for one purpose. The search index is a projection.

Example: a restaurant changes its menu.

1. Save the new menu to the **main database**, and write an **outbox** event in the same save.
2. The event is published.
3. The indexer updates the **search index**.

Search may be stale for a moment. That's fine for browsing. But **checkout** always checks price and availability against the main database. Nobody should pay last week's price because search was behind.

## How a search works, start to finish

1. The product database owns the restaurant and menu record.
2. Its outbox publishes a **versioned** change.
3. An indexer updates the search document.
4. A user types "spicy noodles". Search **tokenizes** the text (splits it into words, lowercases, maybe trims "noodles" to "noodle").
5. It applies **filters** (open now, delivers to my area).
6. It **ranks** matches (how well they match, rating, distance).
7. It returns a page of results and a **cursor** (a bookmark for "next page").
8. When the user opens a result or orders, the app **re-reads** price, availability and permissions from the database.

## Keep search healthy

Because search is a copy, decide:

- a **freshness target** (e.g. "changes visible in search within 30 seconds"),
- a **repair path**: retry failed index events, regularly compare counts ("database has 120,000 live listings, index has 119,850, something's missing"), and
- a **full rebuild** from the database, for when an index setup bug (a wrong **mapping**, i.e. field definition) means everything must be re-indexed.

## Location details that prevent surprises

For each driver, store their **latest location**, **when** it was recorded, and **which cell** it's in.

To find nearby drivers:

1. Query the rider's cell **plus the neighboring cells** (a driver just across a cell border can be closest).
2. Calculate the **real distance** to each candidate.
3. **Drop stale** ones (e.g. location older than 30 seconds).

Then remember: the index only finds **candidates**. It doesn't **reserve** anyone. The closest driver might have been assigned 2 seconds ago. The final assignment needs a **durable, atomic claim** (one database update that only succeeds if the driver is still free), so two riders can't both get the same driver.

**Privacy:** exact location is personal data. Keep it only as long as needed, limit who can see it, and use it only for its stated purpose.

## Quick recap

- 📦 **Files** in object storage, uploaded directly with short-lived, scoped links.
- 🗄️ **The database is the source of truth**; search and geo indexes are copies.
- 🔎 **Check the database** before showing deleted, private or price-sensitive results.
- 🗺️ **Near me:** cell plus neighbors, exact distance, drop stale, then claim atomically.
- 🔁 **Use versions** so replays can't bring back old data, and keep a rebuild path.
