---
title: "CloudFront: Faster Websites and Safer File Delivery"
summary: "Put CloudFront in front of a static site or S3 files so visitors use nearby cached copies while your origin stays private."
level: Beginner
tags: [aws, cloudfront, cdn, s3, waf, static-site, caching]
---

## The simple idea

CloudFront is a CDN. It keeps cached copies of files near visitors, so a visitor in another country does not always fetch images, JavaScript, or CSS from your original S3 bucket.

```mermaid
flowchart LR
    U[Visitor] --> CF[CloudFront nearby edge]
    CF -->|cache miss only| S3[Private S3 bucket]
```

## Three words

| Word | Meaning |
| --- | --- |
| **Distribution** | Your CloudFront setup |
| **Origin** | The real source, such as S3 or an ALB |
| **Cache behavior** | Rules for paths, cache settings, and allowed methods |

## Safe static site setup

1. Store site files in S3.
2. Create a CloudFront distribution with that bucket as origin.
3. Use Origin Access Control so CloudFront can read the bucket but the public internet cannot.
4. Add an ACM certificate and Route 53 DNS record for your domain.

When you deploy changed filenames such as `app.abc123.js`, visitors naturally receive the new file. Avoid frequently invalidating every path; invalidations cost time and can cost money.

## Protection

AWS WAF can block common unwanted requests or rate-limit abusive clients. It is a helpful layer, not a substitute for secure application code and authentication.

## Remember this

- CloudFront caches content close to users.
- Keep the S3 origin private; let CloudFront access it.
- Use versioned asset names for safe caching.
- WAF filters web traffic before it reaches your app.
