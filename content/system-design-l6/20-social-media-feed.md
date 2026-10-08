---
title: "Design a Social Media Feed"
summary: "Build a fast home feed with fan-out choices, durable post storage, eventual consistency and safeguards for celebrity hot keys."
level: Advanced
tags: [system-design, social-feed, fanout, caching, consistency]
---

![Social feed: write a post once, then fan out to inboxes or merge on read behind a cached timeline API](/img/system-design-l6/social-feed.svg)

Posts are durable objects; the home timeline is a derived read model. **Fan-out on write** gives fast reads for ordinary accounts. **Fan-out on read** avoids writing millions of inboxes for celebrities but makes reads more expensive. Most large systems use a hybrid.

Keep likes/comments as separate scalable counters or event streams. It is acceptable for a new post to appear a few seconds late; it is not acceptable to lose the original post. Monitor fan-out lag, feed freshness, cache hit rate and celebrity amplification.

## Read and write path

Creating a post commits the post and an outbox event. For normal accounts, workers append a lightweight post reference to followers' inbox timelines. On feed read, fetch references, hydrate post details from cache/store, filter blocked/private/deleted content, and rank the candidates. Keep the original post as truth; a feed entry is only a pointer and can be rebuilt.

A celebrity with 50 million followers changes the economics: writing 50 million inbox rows for one post is wasteful. Store the post once and merge that creator's recent posts during reads. This hybrid approach accepts a little read cost to avoid a write storm.

## Correctness details

Use a cursor based on stable rank/time plus ID, not page number; new posts otherwise shift pages and create duplicates. Make follow/unfollow and privacy changes visible through filtering even if old timeline entries remain briefly. Track feed freshness separately from API latency.
