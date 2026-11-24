---
title: "Design a Social Media Feed"
summary: "Build a fast home feed: save each post once, copy it into followers' feeds for normal accounts, fetch it live for celebrities, accept small delays and never leak private posts."
level: Advanced
tags: [system-design, social-feed, fanout, caching, consistency]
---

## The story in one minute

A social app has normal users with about **200 followers** and one celebrity with **10 million**. Your design: when someone posts, copy the post into every follower's feed right away.

At 8 p.m., the busiest hour, the celebrity posts. Here's what goes wrong:

1. One post means **10 million** feed writes.
2. Those writes jam the workers. Normal users' posts now take **10 minutes** to show up for their friends.
3. The celebrity deletes the post a minute later, but copies are already sitting in millions of feeds.
4. Someone makes their account private, but their old posts still show in followers' cached feeds.

This lesson is about a feed that's **fast, fresh enough, and never shows what it shouldn't**.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Fan-out** | Spreading one post to all the followers' feeds. | A teacher handing a copy of a notice to every student. |
| **Fan-out on write** | Copy the post into every follower's feed **when it's posted**. | Putting a copy in every mailbox right away. |
| **Fan-out on read** | Don't copy. Fetch the post **when a follower opens their feed**. | Pinning one notice on the board; people read it when they pass. |
| **Inbox (timeline)** | A pre-built list of post IDs for one user's home feed. | Your personal pile of mail. |
| **Cursor** | A bookmark that says "continue after this exact post". | A bookmark in a book, not "page 5". |

## The fix in three rules

### Rule 1: Save the post first, spread it later

1. Save the post **durably** (safely in the database). This is the truth.
2. Then schedule the fan-out as **background work**.
3. For normal users, a limited pool of workers adds a small **pointer** (just the post ID) to each follower's inbox.

The feed entry is only a pointer. If inboxes are lost, you can rebuild them from the posts.

### Rule 2: Treat celebrities differently (the hybrid)

❌ **Wrong:** write 10 million inbox entries for one celebrity post.

✅ **Right:**

- **Normal authors:** fan-out on write. Copying to 200 inboxes is cheap.
- **Celebrities** (above some follower count, e.g. 100,000): **don't copy**. When a follower opens the feed, fetch the celebrity's recent posts and **merge** them in.

Most large social networks use this hybrid.

### Rule 3: Check visibility every time you show a feed

Copies in inboxes can be **out of date**. So when serving a feed, **filter** each post:

- Deleted? Hide it.
- Author went private, or blocked this viewer? Hide it.
- Viewer unfollowed? Hide it.

A late post is a small annoyance. A **private post shown to the wrong person is a real bug.**

## Walk through a failure

The fan-out workers fall **10 minutes behind** after the celebrity posts.

- Because celebrity posts are **merged at read time**, followers see the new post right away. It never waited in the jammed queue.
- Normal users' posts may arrive a bit late. That's acceptable.
- Older inbox entries might point to posts that have since been deleted or made private. The **visibility check** on read catches them.

## How to prove it works

Run a load test where a celebrity posts **while** millions of people are reading feeds. Then check:

1. **Feed speed:** p99 (the time 99% of feed loads finish under) stays within target.
2. **Post-to-feed lag:** how long until a normal post shows up for followers.
3. **Fan-out backlog:** how many inbox writes are waiting.
4. **Privacy violations:** must be **zero**. Freshness is a target; privacy is a hard rule.

### Check your understanding

At what point does fan-out on read become cheaper than fan-out on write?

<details>
<summary>Show answer</summary>

Compare the two costs **per post**:

- **On write:** one inbox write per follower. Cost ≈ number of followers (F).
- **On read:** one extra fetch-and-merge each time a follower loads their feed while the post is recent. Cost ≈ number of feed loads (R) that include this author.

Fan-out on read wins when **F is bigger than R** (adjusted for how expensive each write vs read is). That happens when an author has huge numbers of followers who mostly **don't open the app** in that window. Example: 10 million followers, but only 1 million open their feed in the next hour. That's 10 million writes vs 1 million extra reads, so reading wins. For a 200-follower user, the writes are tiny, and pre-built inboxes make reads fastest. In practice you pick a follower threshold (like 100,000) and tune it by measuring.

</details>

---

## Going deeper

![Social feed: write a post once, then fan out to inboxes or merge on read behind a cached timeline API](/img/system-design-l6/social-feed.svg)

## Posts are the truth; feeds are a copy

- **Posts** are durable records. Losing one is unacceptable.
- The **home timeline** is a **derived read model**: a view built from posts, optimized for fast reading. It can be rebuilt.

It's fine for a new post to appear **a few seconds late** (this is called **eventual consistency**: everyone sees it soon, not instantly). It's not fine to lose the original post.

## The write path, step by step

1. User posts. Save the post **and** an **outbox event** ("post 555 was created") in one database transaction. (The outbox makes sure you never save a post but forget to fan it out.)
2. A worker reads the event.
3. If the author is normal: add `post 555` to each follower's inbox.
4. If the author is a celebrity: do nothing more. The post waits to be merged at read time.

## The read path, step by step

1. Fetch the user's inbox: a list of post IDs.
2. Fetch recent posts from any celebrities they follow, and **merge** them in.
3. **Remove duplicates** (the same ID could appear twice).
4. **Hydrate**: look up the full post details (text, images, author) from the cache or database.
5. **Filter**: drop blocked, private and deleted posts.
6. **Rank**: sort by your ranking rules (ranking is a separate step from storage).

## Worked numbers: the celebrity problem

| | Normal user | Celebrity |
| --- | ---: | ---: |
| Followers | 200 | 50,000,000 |
| Inbox writes per post (on write) | 200 | 50,000,000 |
| At 100,000 writes/second | 0.002 s | **500 s** (over 8 minutes) |

One celebrity post would hog the fan-out system for 8 minutes. Storing it once and merging on read accepts a **little extra read cost** to avoid a **write storm**.

## Why page numbers break feeds

❌ **"Give me page 2"** (posts 21 to 40): if 5 new posts arrive while you scroll, everything shifts down by 5. Page 2 now starts with 5 posts you already saw. Duplicates!

✅ **Cursor:** "give me 20 posts **after** (rank/time = 10:42:07, id = 555)". New posts at the top don't move your bookmark. Including the ID breaks ties when two posts have the same time.

## Other details

- **Likes and comments** live in separate, scalable **counters** or event streams. Don't rewrite the post every time someone likes it.
- **Follow, unfollow and privacy changes** take effect through filtering, even if old inbox entries stay around briefly.
- **Track separately:** feed freshness (how old is the newest post shown) vs API speed (how fast the request returns). A fast API serving a stale feed is still a problem.

What to watch: fan-out lag, feed freshness, cache hit rate, and **celebrity amplification** (how much work one big account's post creates).

## Quick recap

- 💾 **Post first:** the post is the truth; feed entries are rebuildable pointers.
- 📬 **Hybrid fan-out:** copy for normal users, merge on read for celebrities.
- 🔒 **Filter on every read:** deleted, private or blocked posts never show.
- 🔖 **Cursors, not page numbers:** no duplicates while scrolling.
- ⏱️ **Late is OK, leaked is not.**
