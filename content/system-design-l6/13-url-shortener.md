---
title: "Design a URL Shortener"
summary: "Generate durable short links, redirect in milliseconds, prevent abuse and keep analytics off the redirect path."
level: Advanced
tags: [system-design, url-shortener, redirects, analytics]
---

A short code must resolve to its intended unexpired destination or safely fail.

![URL shortener: durable mappings, cache-backed redirects and asynchronous analytics](/img/system-design-l6/url-shortener.svg)

Generate a Base62 database ID or collision-checked random code. Store code, destination, owner, expiry and status with a unique key. Redirects read edge/cache then durable storage; click analytics is asynchronous.

Protect users with rate limits, phishing scans and destination validation. Disabled links must invalidate quickly.
