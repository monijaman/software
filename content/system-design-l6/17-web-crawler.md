---
title: "Design a Polite Web Crawler"
summary: "Visit huge numbers of web pages without going in circles or flooding any one website: clean up URLs, skip repeats, and keep a separate line for each site."
level: Advanced
tags: [system-design, web-crawler, queues, scheduling, bloom-filter]
---

## The story in one minute

Your search product wants to visit (crawl) **100 million pages**. You build a simple crawler: a list of URLs and 1,000 workers grabbing from it. Here is what goes wrong:

1. One small shop's website links to itself with endless variations: `?sort=price`, `?sort=price&page=2`, `?color=red&sort=price`... That's **a million near-identical URLs**.
2. All 1,000 workers start hitting that one shop at the same time.
3. The shop's server answers **429 Too Many Requests** (meaning "slow down!"), or just falls over.
4. Your workers retry those failures forever, and pages from other sites barely get crawled.

You've been rude, wasteful and stuck. This lesson is about crawling **politely** and **without going in circles**.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Frontier** | The to-do list of URLs waiting to be visited. | A delivery driver's list of stops. |
| **Normalize a URL** | Clean it up so the same page always has the same spelling. | Writing "St." and "Street" the same way in an address book. |
| **Politeness** | Never hitting one website too hard. Following its rules. | Not ringing someone's doorbell 50 times a minute. |
| **robots.txt** | A file a website publishes saying which pages crawlers may visit, and sometimes how slowly. | A "No entry" or "Staff only" sign on a door. |
| **Lease** | A worker "borrows" a task for a limited time. If it doesn't finish, the task goes back on the list. | Borrowing a library book: if you don't return it, it's marked available again. |

## The fix in three rules

### Rule 1: One line per website, not one big line

❌ **Wrong:** one giant first-in-first-out queue (FIFO). If the next 10,000 URLs are all from `smallshop.com`, the workers either hammer it or sit idle waiting.

✅ **Right:** keep a **separate queue per host** (per website). Each host has a "next allowed time". A worker takes a URL from a host's queue **only when that host's turn has come**.

Example: `smallshop.com` allows 1 request every 2 seconds. Even with 1,000 workers, it gets at most 1 request every 2 seconds. The other 999 workers go crawl other sites.

### Rule 2: Clean up URLs and skip what you've seen

Before adding a URL to the frontier:

1. **Normalize** it: remove the `#section` part (it's the same page), lowercase the host name, tidy the path.
2. Check: **have we already seen this URL?** If yes, skip it.
3. After fetching, compute a **content hash** (a fingerprint of the page text). If two different URLs give the same fingerprint, they're duplicates.

Normalize **carefully**. Removing `?page=2` would merge two genuinely different pages.

### Rule 3: Put limits on everything

- **Time limit** per fetch (e.g. 10 seconds).
- **Size limit** per page (e.g. 10 MB). Some "pages" are endless streams.
- **Crawl limit** per site (e.g. at most 50,000 pages from one host), so endless URL traps can't eat your budget.
- **Retry limit** per URL.

## Walk through a failure

A worker fetches a page and saves it. Then it **crashes before saying "done"** (before it *acks*, short for acknowledges).

1. Its lease on the task expires.
2. The task goes back on the list, and another worker does it again.
3. Because each URL has a **durable identity** (a saved, stable ID), saving the same page twice just overwrites the same record. Doing it twice is harmless.

Now `smallshop.com` replies **429**. The crawler **backs off that one host** (waits longer before its next turn). It does **not** stop the whole crawler. Every other site keeps going.

## How to prove it works

Build a test website with traps, then check:

1. **URL cycles:** pages linking in loops. The crawler visits each page once, then stops.
2. **One abusive site** with a million URLs. Per-host request rate never goes above its limit, and other hosts keep their pace.
3. **Retries:** a page that always fails is retried a few times, then parked, not retried forever.

On your dashboard, watch: requests per second **per host**, how many fetched pages were actually useful, duplicate rate, and **age of the oldest URL** in the frontier.

Also decide how often to re-visit pages based on **importance**: a news homepage every few minutes, an old blog post every few months.

### Check your understanding

Why does one global first-in-first-out queue make politeness difficult?

<details>
<summary>Show answer</summary>

Because URLs from the same site arrive **bunched together** (one page links to hundreds of pages on the same site). A single FIFO queue gives workers the next URL in line, whatever site it's from. So either many workers hit the same site at once (rude), or a worker must wait for that site's delay while everything behind it is stuck too. Per-host queues let you skip a site that isn't ready yet and work on another.

</details>

---

## Going deeper

![Crawler: a URL frontier schedules polite fetches while deduplication and storage process discovered links](/img/system-design-l6/web-crawler.svg)

## One polite crawl cycle, step by step

1. Pick a host whose **next-allowed time** has arrived. Take one URL from its queue.
2. Check that host's **robots.txt** rules (cache them, don't re-download every time).
3. Fetch with a strict **timeout** and **byte limit**.
4. Save the response details and a **checksum** (fingerprint) of the content.
5. Find the links on the page and **normalize** them.
6. Add links you haven't seen before to the frontier.
7. Set the host's next-allowed time (for example, now + 2 seconds).

A separate **indexer** (the part that makes pages searchable) can read the saved pages later. The crawler's job is just fetching.

## Why per-host limits matter: worked numbers

You run **1,000 workers** at once. That sounds fine spread across a million sites. But if all 1,000 hit **one small website** whose server can handle 20 requests per second, you've just knocked it offline.

| Setting | Global only | Global + per host |
| --- | --- | --- |
| Total requests at once | 1,000 | 1,000 |
| Max on `smallshop.com` | Up to 1,000 | 1 every 2 seconds |
| Result | Shop goes down | Shop barely notices |

Respecting `robots.txt` and crawl-delay is a **product and legal decision**, not an optional speed trick.

## The frontier picks what to crawl next

The frontier isn't just a list. It decides **order**, based on:

- **Importance:** popular pages first.
- **Freshness:** pages that change often get re-visited sooner.
- **Politeness:** per-host concurrency (how many at once), rate limits, robots.txt and crawl-delay.

## Bloom filters: fast, but not the final word

Checking "have I seen this URL?" against a database of billions of URLs is slow. A **Bloom filter** is a tiny, fast, memory-only structure that answers:

- "**Definitely not seen**" (always correct), or
- "**Possibly seen**" (sometimes wrong).

The "sometimes wrong" part is called a **false positive**. Say the filter has a 1% false-positive rate. Out of 100 million brand-new URLs, about **1 million** would be wrongly skipped as "seen".

So use it as a quick first check: "definitely not seen" means add it straight away. "Possibly seen" means check the **durable visited store** (the real database) to be sure. That way the filter saves most of the expensive lookups, but the database stays the source of truth, which matters when you must not miss pages.

## Make retries safe

| Error | What it usually means | What to do |
| --- | --- | --- |
| DNS failure, timeout, 5xx (server error) | Temporary trouble | Retry with **backoff** (wait longer each time). |
| 429 Too Many Requests | You're too fast | Slow down **that host**. |
| Repeated 4xx (404 Not Found, 403 Forbidden) | The page isn't there or isn't allowed | Stop retrying; mark it. |
| Parser keeps crashing | Weird page | Park it for review. |

Save crawl state and **attempt count** durably, so a restart doesn't reset everything. Deduplicate by the **canonical URL** (the cleaned-up, official spelling) and, when useful, by content hash.

## Quick recap

- 🏠 **One queue per site:** each host has its own pace and next-allowed time.
- 🧹 **Normalize and dedupe:** same page, same spelling; skip what you've seen.
- 📏 **Limit everything:** time, size, pages per site, retries.
- 🎟️ **Leases + stable IDs:** a crashed worker's task gets redone safely.
- 🌸 **Bloom filter is a shortcut:** "possibly seen" still needs a real check.
