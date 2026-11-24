---
title: "Design a URL Shortener"
summary: "Turn long links into short ones that never get lost, redirect in milliseconds, can be switched off fast if harmful, and count clicks without slowing anyone down."
level: Advanced
tags: [system-design, url-shortener, redirects, analytics]
---

## The story in one minute

A marketing team makes a short link, `go.example/xY7`, for a campaign. It goes **viral**: **10,000 clicks per second**.

Here is what goes wrong, step by step:

1. Every click waits while the server **writes a click record** to the analytics database before redirecting. Redirects get slow.
2. The **cache** (fast memory that holds popular links) restarts. All 10,000 requests per second fall through to the **database**, which can't keep up.
3. The security team discovers the link now points to a **phishing site** and disables it.
4. But the redirect was sent as **"permanent"** and saved by browsers and edge servers. People keep landing on the bad site for **days**.

Fast, safe and countable all at once is harder than it looks. This lesson shows how.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Redirect** | The server's reply "this is over there, go to this address." | A sign on a shop door: "We've moved to 12 Main St." |
| **301 vs 302** | 301 = "moved for good" (browsers may remember it). 302 = "moved for now" (ask me again next time). | A permanent change of address vs a "back in 10 minutes" note. |
| **Cache** | A fast copy kept close by so you don't look it up every time. | Keeping your house key in your pocket, not in a safe. |
| **Base62** | Writing numbers using `a-z`, `A-Z`, `0-9` (62 symbols) to make short codes. | Like using letters on a license plate to fit more combinations. |
| **Async (asynchronous)** | "Do it later, in the background; don't make the user wait." | Dropping a letter in the mailbox instead of waiting for the reply. |

## The fix in three rules

### Rule 1: Save every link safely first

Two simple API calls:

- `POST /links`: create a short link.
- `GET /{code}`: open a short link (the redirect).

On create: **check the destination** (is it a valid, safe web address?), then save the **code, owner, status (active/disabled), expiry date and destination** in a durable database. The code column has a **unique** rule, so two links can never share a code.

### Rule 2: Redirect from the cache, and keep the click counting out of the way

On open: look in the **cache** first, then the **database**, then send the redirect.

❌ **Wrong:** save the click to analytics, *then* redirect.

✅ **Right:** redirect right away, and send a "someone clicked" event to a background pipeline. Click counts may show up a few minutes late. That's fine.

### Rule 3: Make sure you can switch a link off quickly

If browsers and edge servers remember a redirect "forever" (a long-cached 301), you **can't take it back**.

✅ Use **short cache times**, and when a link is disabled, **actively delete** it from every cache.

## Walk through a failure

During the viral campaign, the cache goes down.

- ❌ All **10,000 requests per second** hit the database at once. It falls over, and now **every** link is broken, not just the popular one.
- ✅ **Limit** how many requests may go to the database at once (say, 200). And **combine identical lookups**: if 5,000 requests want `xY7` at the same moment, make **one** database read and share the answer with all of them (this is called *request coalescing*).

And separately: a link that's been **disabled** must never keep being served from an old edge-cache copy.

## How to prove it works

In a test environment:

1. **Load-test one hot code** at 10,000 requests per second.
2. **Turn off the cache** in the middle of the test.
3. **Disable that code** while traffic is still flowing.

Then measure:

1. Redirect speed (p99: the time that **99%** of redirects beat).
2. How many requests fell through to the database.
3. How long it took until **nobody** was redirected to the disabled link.
4. Whether you lost click events, and whether that loss was **allowed** by your rules when overloaded.

### Check your understanding

When would you choose a **temporary redirect** (302) instead of a **permanent, cached** one (301)?

<details>
<summary>Show answer</summary>

Choose a **temporary redirect** when any of these matter:

- You may need to **disable** the link quickly (for example, if it turns out to be harmful).
- The link has an **expiry date**, or the owner may **change the destination**.
- You want to **count every click**. If the browser remembers a 301, it skips your server next time, so you never see that click.

A **permanent redirect** only makes sense when the destination will truly never change and you don't need to count or control repeat visits. For most link shorteners, a 302 (with a short cache time) is the safer default.

</details>

---

## Going deeper

**The one promise:** a short code must lead to its correct, unexpired, safe destination, or **fail safely** (show an error page). Never send someone to the wrong place.

![URL shortener: durable mappings, cache-backed redirects and asynchronous analytics](/img/system-design-l6/url-shortener.svg)

## Start with the product promise

Before picking Redis or a database, decide what a link **means** to users:

- `go.example/xY7` goes to the **same safe destination** until it expires or is disabled.
- A **custom name** (like `go.example/summer-sale`) must be unique.
- The owner can see click counts, **without** making each redirect slow.

**Example targets:**

| Target | Number |
| --- | --- |
| Peak redirects | 10,000 per second |
| Redirect speed | 99% under 100 ms |
| How long links last | 1 year |
| Click counts may be late by | a few minutes |

## The request flow

Here's the whole thing in two lines. The **create** path saves first. The **open** path reads fast and sends clicks off to the side.

```text
Create link: client -> API -> validate destination -> create durable mapping
                                   -> cache mapping

Open link:   browser -> CDN/redirect API -> cache -> mapping database
                                                -> 302 redirect
                                   -> async click event -> analytics pipeline
```

(A **CDN** is a network of servers around the world that keeps copies close to users.)

The redirect should **not** wait for analytics, fraud dashboards, emails or reporting jobs.

## Choosing a short code

**Base62** uses 62 symbols, so codes get long slowly:

| Code length | Possible codes |
| ---: | ---: |
| 6 | 62⁶ ≈ **56.8 billion** |
| 7 | 62⁷ ≈ **3.5 trillion** |

Two ways to make the code:

| Method | How | Good | Watch out |
| --- | --- | --- | --- |
| **Counter + Base62** | Database gives the next number (1, 2, 3, ...), you write it in Base62. | Never collides. | Codes are guessable. Someone can try `xY7`, `xY8`, ... to see other people's links and how fast you're growing. |
| **Random code** | Pick 7 random Base62 symbols. | Hides order, hard to guess. | Two links could get the same code by chance, so you need the **unique** rule and a **retry** if it clashes. |

Either is fine, as long as the **durable database** (not cache memory) decides who owns each code.

## Failures that change the design

| Situation | Safe behavior |
| --- | --- |
| Redis (the cache) is empty or down | Read from the database, but **limit** how many requests may do that at once so it isn't flooded. |
| One link goes viral | Cache it at the edge and in Redis. Add **TTL jitter** (give cache entries slightly random expiry times, like 55 to 65 seconds) so they don't all expire at once. Rate-limit to protect the origin servers. |
| Owner disables a harmful link | Mark it **disabled in the database** first, then **actively remove** it from Redis and edge caches. |
| The analytics queue is slow | Keep redirects working. Keep or drop click events according to a **written rule** (for example, "under overload, sample 10% of clicks"). |

## Protecting users

- **Rate limits:** cap how many links one account can create per minute, so spammers can't mass-produce them.
- **Phishing scans:** check destinations against known bad-site lists, on create and again later.
- **Destination checks:** only allow `http`/`https` addresses, and block obviously unsafe ones.
- **Fast disable:** a disabled link must stop working everywhere within minutes, not days.

## What to watch

- Redirect speed (**p95/p99**: the time 95% / 99% of redirects beat)
- **Cache-hit rate** (how often the cache had the answer)
- How often requests **fall through to the database**
- How often new random codes **collide**
- How long a **disable takes to reach everywhere**
- How many **suspicious destinations** got blocked
- How far behind **analytics** is

Success means: a viral link stays fast, **and** a harmful link stops working soon after it's disabled.

## Quick recap

- 💾 **Save first:** code, destination, owner, status and expiry, with a unique code.
- ⚡ **Redirect fast:** cache, then database. Clicks are counted in the background.
- 🛡️ **Stay in control:** use 302 with short caching, and actively clear caches on disable.
- 🌊 **Survive a cache outage:** cap database fallback and combine identical lookups.
