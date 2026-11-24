---
title: "Networking, DNS and Traffic Routing"
summary: "Follow one request from the user's browser to your server: how DNS finds you, how load balancers and proxies pick a healthy server, and why switching away from a broken region is never instant."
level: Advanced
tags: [system-design, networking, dns, anycast, load-balancing]
---

## The story in one minute

Customers in **Dhaka** and **London** use the same API. You run it in two regions: Asia and Europe. One night the **Europe region fails**. You update DNS to point everyone to Asia. Then:

1. Many London users **still fail** for 20 minutes.
2. Why? Their browsers and internet providers **remembered** the old DNS answer and keep going to the dead region.
3. Others have **open connections** to the old servers that just hang.
4. Meanwhile, the load balancer in Asia shows "all green", but one server there is up and **can't reach its database**, so its requests fail.

Changing DNS felt like flipping a switch. It wasn't. This lesson walks through the path a request takes, so you know where each failure can hide.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **DNS** | The internet's phone book: turns `api.shop.com` into an IP address. | Looking up a friend's number by name. |
| **TTL** | How long a DNS answer may be remembered (cached) before asking again. | "This phone number is valid for 5 minutes, then check again." |
| **Load balancer** | Spreads incoming requests across many servers and skips broken ones. | A host at a restaurant seating people at free tables. |
| **Reverse proxy** | A server in front of your app that receives requests and forwards them, adding checks along the way. | A receptionist who directs visitors to the right office. |
| **Anycast** | Many locations share **one** IP address; the internet sends you to a nearby one. | One emergency number that connects to your local station. |

## The fix in three rules

### Rule 1: See the request as separate steps

A request isn't one thing. It's a chain, and each link can fail on its own:

1. **DNS lookup:** name to IP address.
2. **Connection:** open a TCP connection to that IP.
3. **TLS:** set up encryption (the "s" in https). Usually ends at the edge or load balancer. That's called **TLS termination**.
4. **Reverse proxy:** reads the request and decides where it goes.
5. **Backend selection:** the load balancer picks one healthy server.

When something breaks, ask: **which step?**

### Rule 2: Health checks must mean "ready to serve"

❌ **Wrong:** "Is the process running and listening on port 8080?" Yes, so it's healthy.

✅ **Right:** a **readiness** check: "Can this server actually handle requests right now?" That includes: started up fully, can reach the database it needs, not overloaded.

When you deploy, **drain** old servers: stop sending them new requests, but let current requests finish before shutting them down.

### Rule 3: Plan for slow switch-over

Whether you use DNS or anycast to steer traffic, it takes time for the change to spread (this is called **convergence**). So:

- Write down how long you expect switching to take, and test it.
- Keep **spare capacity** in other regions to absorb moved traffic.
- During a region split, **protect writes** to the main data (don't let two regions both accept conflicting changes to the same records).

## Walk through a failure

You change the DNS record from Europe to Asia. The TTL was **300 seconds** (5 minutes).

- **Some clients ask again after 5 minutes** and move to Asia. Good.
- **Some resolvers** (the DNS helpers at internet providers) ignore TTL and keep old answers longer.
- **Some apps cache DNS** for the whole time they run.
- **Open connections** don't re-check DNS at all; they stay on the old server until they break.

So **TTL is not a guaranteed recovery deadline**. Real failover also needs:

- clients that **retry** on connection errors (and re-look-up DNS),
- keeping old endpoints **working where possible** (e.g. if only the app failed but the load balancer is alive, it can forward to Asia).

## How to prove it works

Run a **regional outage test** from **several real client networks** (home broadband, mobile, office). Measure:

1. **Connection failure rate** during the switch.
2. **Convergence time:** how long until most traffic reaches the healthy region.
3. **Spare capacity:** did Asia handle double the load?
4. **User-visible recovery time:** how long until users could actually use the app again.

A green load balancer is not proof users are fine.

### Check your understanding

Why can a process that's listening on its port still be an unhealthy backend?

<details>
<summary>Show answer</summary>

Listening only means "the program is running and accepting connections". It can still be unable to do the real work, for example:

- it's still **starting up** (loading data, warming caches),
- it **can't reach a dependency** (its database or another service is down),
- it's **overloaded** or stuck (all worker threads busy or deadlocked),
- a specific **route is broken** (e.g. `/checkout` fails while `/health` says OK).

A good health check tests the ability to serve the requests it will get, not just that the port is open.

</details>

---

## Going deeper

![Traffic routing: DNS and anycast select a nearby entry point, then a reverse proxy and load balancer choose a healthy service](/img/system-design-l6/network-routing.svg)

## The OSI model as a troubleshooting map

The **OSI model** describes networking in layers. You don't need all seven; think of it as a map for "where is the problem?"

| Layer (simplified) | What it does | Example | Problem looks like |
| --- | --- | --- | --- |
| Application (7) | The actual conversation | HTTP, DNS | 500 error, wrong response |
| Transport (4) | Reliable or quick delivery between two programs | TCP, UDP | Connection refused, timeouts |
| Network (3) | Finding a route across the internet | IP | Can't reach the host at all |
| Link / physical (2, 1) | Moving bits over a cable or Wi-Fi | Ethernet | Cable unplugged, packet loss |

## How DNS can spread traffic

DNS can give **different answers** to different people:

- A user in Dhaka asks for `api.shop.com` and gets the Asia IP.
- A user in London gets the Europe IP.
- If Europe is unhealthy, DNS can stop handing out its IP.

This is **DNS load balancing**. Its weakness is caching: you can't take back an answer already given.

## Anycast

With **anycast**, the **same IP address** is announced from many locations. Internet routers send each user to a nearby one, usually. If one location goes offline, routers learn that and send traffic elsewhere, often faster than DNS changes spread. That's why many CDNs (content delivery networks: servers spread around the world that serve content close to users) and DNS providers use it.

## Layer 4 vs layer 7 load balancers

| | Layer 4 balancer | Layer 7 proxy |
| --- | --- | --- |
| Sees | IP addresses and ports (connections) | Full HTTP: host, path, headers |
| Can route by URL path? | No | Yes (`/api` here, `/images` there) |
| Ends TLS? | Usually not | Yes, often |
| Can add policies? | Few | Rate limits, request IDs, auth checks |
| Speed | Very fast, simple | A bit more work per request |

## Follow one request

1. The browser looks up `shop.com` in **DNS**.
2. It opens a **TLS connection** to an edge server or load balancer.
3. The **reverse proxy** reads the request:
   - `/api/...` goes to the API server pool,
   - `/images/...` goes to the CDN.
4. The proxy adds a **request ID** (for tracing), enforces a **rate limit**, and **retries only safe failures** (e.g. a GET that failed to connect, not a payment POST).
5. The proxy picks a **healthy** app server.

The app itself still has to set its own **deadlines** and check **authorization** (is this user allowed?). A proxy in front cannot make an unsafe service safe.

## Who does what when something fails

| Failure | Useful response |
| --- | --- |
| One server fails its health check | Stop sending it new traffic; let current requests finish (drain). |
| One zone fails (one data center in a region) | Spread load to other zones, which need spare room (**headroom**). |
| A whole region fails | Fail over according to your **RPO** (how much recent data you can afford to lose) and **RTO** (how long you can be down), and your data rules. |
| DNS record changed | Keep TTL realistic (e.g. 60 to 300 seconds) and expect old answers to linger anyway. |

## Worked numbers: the TTL trade-off

| TTL | Switch-over (for clients that obey it) | DNS lookups |
| --- | --- | --- |
| 3,600 s (1 hour) | Up to 1 hour | Few |
| 300 s (5 min) | Up to 5 minutes | More |
| 30 s | Up to 30 seconds | Many more; extra lookup delay for users |

Shorter TTL means faster switching but more DNS traffic. And it only helps clients that **obey** it.

## What to watch

- DNS TTL and how fast changes spread
- Health of each edge location
- Connection error rates
- Latency per region
- **Uneven load:** one server or region getting far more than its share

A DNS answer only says where to go. It doesn't promise that place is healthy **right now**.

## Quick recap

- 🔗 **A request is a chain:** DNS, connection, TLS, proxy, backend. Find the broken link.
- 🩺 **Health = ready to serve:** not just "the port is open".
- ⏳ **DNS switching is slow:** caches and open connections linger past the TTL.
- 🌍 **Anycast and spare capacity** make regional failover smoother.
- 🛡️ **The proxy helps, the app decides:** deadlines and permissions still live in the app.
