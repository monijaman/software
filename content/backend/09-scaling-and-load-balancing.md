---
title: Scaling, Load Balancing & Rate Limiting
summary: How to serve 10 users, then 10 million. Vertical vs horizontal scaling, load balancers, stateless servers, replication, sharding, rate limiting and resilience basics.
level: Intermediate
tags: [backend, scaling, load-balancing, rate-limiting, system-design]
---

## The big idea

A small café with one barista is fine for 20 customers a day. At 2,000 customers you can either:

- Give the barista a **faster espresso machine** → **vertical scaling** (scale up).
- Hire **more baristas** and add a **host** who sends each customer to a free one → **horizontal scaling** (scale out) with a **load balancer**.

![Vertical scaling makes one server bigger; horizontal scaling adds more servers](/img/backend/scaling.svg)

| | Vertical (up) | Horizontal (out) |
| --- | --- | --- |
| How | Bigger CPU / RAM | More servers |
| Simplicity | ✅ No code changes | Needs stateless design |
| Limit | Hardware ceiling, expensive at the top | Practically unlimited |
| Failure | One server = single point of failure | Survives losing a server |

## The scaling journey

```mermaid
flowchart TB
    S1["1️⃣ One server<br/>app + DB together"] --> S2["2️⃣ Separate DB server"]
    S2 --> S3["3️⃣ Load balancer + many stateless app servers"]
    S3 --> S4["4️⃣ Cache (Redis) + CDN for static files"]
    S4 --> S5["5️⃣ DB read replicas"]
    S5 --> S6["6️⃣ Queues for background work"]
    S6 --> S7["7️⃣ Sharding / split into services"]
```

Don't jump to step 7 on day one (remember **KISS** and **YAGNI**). Each step solves a real, measured bottleneck.

## Load balancers

A load balancer spreads requests across healthy servers and stops sending traffic to broken ones.

```mermaid
flowchart LR
    U1[👤] & U2[👤] & U3[👤] --> LB{{"⚖️ Load balancer"}}
    LB --> A["Server A ✅"]
    LB --> B["Server B ✅"]
    LB -.-x C["Server C ❌<br/>failed health check"]
```

### Algorithms

| Algorithm | How it picks | Good when |
| --- | --- | --- |
| **Round robin** | A, B, C, A, B, C… | Servers are identical |
| **Weighted round robin** | Bigger servers get more | Mixed server sizes |
| **Least connections** | Server with the fewest active requests | Requests vary in duration |
| **IP hash / consistent hashing** | Same client → same server | Need stickiness or cache locality |

### Layer 4 vs Layer 7

- **L4 (transport):** routes by IP and port. Very fast, doesn't read HTTP.
- **L7 (application):** reads HTTP, so it can route `/api/*` to API servers and `/images/*` to storage, terminate TLS, add headers. Examples: NGINX, HAProxy, AWS ALB, Envoy.

## Stateless servers: the key to scaling out

If a server keeps user sessions **in its own memory**, the next request might land on a different server that doesn't know the user.

```mermaid
flowchart LR
    subgraph Bad["❌ State in the server"]
      U[User] --> LB1{{LB}} --> A1["Server A<br/>session in memory"]
      LB1 --> B1["Server B<br/>'who are you?'"]
    end
    subgraph Good["✅ State outside"]
      U2[User] --> LB2{{LB}} --> A2[Server A] & B2[Server B]
      A2 & B2 --> R[(Redis sessions)]
      A2 & B2 --> S3[(S3 file uploads)]
    end
```

**Rule:** any server should be able to handle any request. Keep sessions in Redis or in tokens, files in object storage (S3), and state in the database.

## Scaling the database

The database is usually the hardest part to scale.

### Read replicas

Most apps read far more than they write. Copy the data to replicas and send reads there.

```mermaid
flowchart LR
    App -->|writes| P[(Primary)]
    P -->|replication| R1[(Replica 1)]
    P -->|replication| R2[(Replica 2)]
    App -->|reads| R1 & R2
```

⚠️ **Replication lag:** a replica may be a few milliseconds behind. After a user updates their profile, read *their* profile from the primary ("read your own writes").

### Sharding (partitioning)

When one primary can't handle the writes or the data size, split the data across several databases by a **shard key**.

```mermaid
flowchart LR
    App --> Router{"shard = hash(user_id) % 3"}
    Router --> S0[("Shard 0<br/>users A…")]
    Router --> S1[("Shard 1<br/>users B…")]
    Router --> S2[("Shard 2<br/>users C…")]
```

| Challenge | Why |
| --- | --- |
| Choosing the shard key | A bad key creates "hot" shards (all celebrities on one) |
| Cross-shard queries and JOINs | Must query every shard and combine the results |
| Re-sharding | Adding shards moves data. **Consistent hashing** minimises that |
| Transactions across shards | Hard; avoid them by design |

## Rate limiting

Protect your API from abuse, bugs and traffic spikes by limiting requests per user, IP or API key. Over the limit → **429 Too Many Requests** with a `Retry-After` header.

### Token bucket (most popular)

> 🪣 A bucket holds up to 10 tokens and refills at 1 token per second. Each request takes a token. Empty bucket → request rejected. Allows short bursts but enforces an average rate.

```mermaid
flowchart LR
    Refill["💧 +1 token / second"] --> Bucket[("🪣 bucket<br/>max 10 tokens")]
    Req[Request] --> Check{token available?}
    Bucket --> Check
    Check -->|yes: take 1| OK[✅ 200 OK]
    Check -->|no| Rej[❌ 429 Too Many Requests]
```

| Algorithm | Idea | Trade-off |
| --- | --- | --- |
| **Fixed window** | Count per minute (resets at :00) | Simple; allows 2× bursts at window edges |
| **Sliding window** | Count over the last 60 s | Smoother, slightly more work |
| **Token bucket** | Tokens refill steadily | Allows bursts, smooth average ✅ |
| **Leaky bucket** | Queue drains at a fixed rate | Very smooth output, adds latency |

In a multi-server setup, keep counters in **Redis** so all servers share the same limits (see *Caching & Redis* for code).

## Resilience basics

At scale, something is *always* failing. Design for it:

| Pattern | Purpose |
| --- | --- |
| **Timeouts** | Never wait forever on a dependency |
| **Retries with exponential backoff + jitter** | Survive brief glitches without hammering the service |
| **Circuit breaker** | Stop calling a service that keeps failing; fail fast and give it time to recover |
| **Bulkhead** | Separate resource pools, so one slow dependency can't consume every thread |
| **Graceful degradation** | Show cached or partial results instead of an error page |
| **Health checks** | Let load balancers route around sick servers |

These are covered in depth in *Microservices → Resilience Patterns*.

## Back-of-the-envelope numbers

| Metric | Rough figure |
| --- | --- |
| 1 million requests/day | ≈ 12 requests/second average (peak maybe 5–10×) |
| One Node.js / Go server | Hundreds to thousands of simple requests/second |
| One Postgres primary | Thousands of simple writes/second, many more reads |
| One Redis node | ~100,000 operations/second |

## Key takeaways

- Scale vertically first (simple), horizontally when needed (resilient, unlimited).
- Load balancers spread traffic and route around failures; L7 can route by path.
- Stateless app servers are the foundation of horizontal scaling.
- Databases scale with caching, read replicas, then sharding.
- Rate limit with a token bucket in Redis; return 429 with `Retry-After`.
- Assume failure: timeouts, retries with backoff, circuit breakers.
