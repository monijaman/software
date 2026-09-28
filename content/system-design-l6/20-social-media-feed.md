---
title: "Design a Social Media Feed"
summary: "Build a fast home feed with fan-out choices, durable post storage, eventual consistency and safeguards for celebrity hot keys."
level: Advanced
tags: [system-design, social-feed, fanout, caching, consistency]
---

![Social feed: write a post once, then fan out to inboxes or merge on read behind a cached timeline API](/img/system-design-l6/social-feed.svg)

Posts are durable objects; the home timeline is a derived read model. **Fan-out on write** gives fast reads for ordinary accounts. **Fan-out on read** avoids writing millions of inboxes for celebrities but makes reads more expensive. Most large systems use a hybrid.

Keep likes/comments as separate scalable counters or event streams. It is acceptable for a new post to appear a few seconds late; it is not acceptable to lose the original post. Monitor fan-out lag, feed freshness, cache hit rate and celebrity amplification.
