---
title: "Architecture Patterns at Scale"
summary: "Pick between one big app, many small services, serverless functions, events or peer-to-peer based on who owns what, what should fail alone, and how much running cost your team can handle."
level: Advanced
tags: [system-design, architecture, microservices, serverless, event-driven, p2p]
---

## The story in one minute

A **12-person team** runs a growing online marketplace. It's one app. The business changes checkout rules **every week**. Here's the pain:

1. Two developers both want to release on Tuesday. Their changes **collide**, and one has to wait.
2. Someone says: "Let's split everything into 15 microservices!"
3. Six months later: 15 services, 15 deploy pipelines, network calls everywhere. Debugging one checkout bug means reading logs from **6 services**.
4. The catalog service goes down and **checkout breaks too**, because checkout calls catalog directly and waits.

They paid a lot for "microservices" and still don't have independence. This lesson is about choosing a shape that **actually helps**.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Monolith** | One app, deployed as one unit. | One restaurant kitchen doing everything. |
| **Modular monolith** | One app, but split inside into clear sections with rules about who touches what. | One kitchen with separate stations: grill, salad, desserts. |
| **Microservice** | A small separate app, owned by one team, talking to others over the network. | Separate food trucks, each with its own staff. |
| **Serverless** | Small functions the cloud runs only when needed. You don't manage servers. | Hiring a caterer for one party instead of keeping staff. |
| **Event-driven** | Parts announce "this happened", and others react later, in their own time. | A town notice board: post once, whoever cares reads it. |

## The fix in three rules

### Rule 1: Start with clear sections inside one app

Split the code into **modules**: catalog, checkout, fulfillment. Each module:

- has a clear **interface** (the only door other modules may use), and
- **owns its own data** (other modules don't read its tables directly).

This gives you most of the tidiness of microservices with none of the network problems.

### Rule 2: Pull a piece out only when you can name the reason

Making something a separate service costs real work: network calls that can fail, separate deploys, separate monitoring, someone on call for it. Do it only when you get something back:

- ✅ It needs to **scale** differently (e.g. image processing needs 20 machines, the rest needs 2).
- ✅ It needs its **own release pace** (checkout changes weekly, catalog monthly).
- ✅ A **separate team** owns it.
- ✅ It must **fail alone** without taking others down.
- ❌ "The repo has a lot of folders."
- ❌ "Big companies do it."

### Rule 3: Every new boundary needs a written agreement

For every split, write down:

- **Owner:** which team gets paged.
- **Contract:** the API or event format, and how it changes safely.
- **Source of truth:** which service's data wins if they disagree.
- **Deadline:** how long callers wait before giving up.
- **SLO** (service level objective: a target like "99.9% of requests succeed").
- **Failure plan:** how it fails without breaking unrelated features.

Use **events** for durable work that can happen later (send receipt, update search). Use **serverless** for bursty, short jobs (resize an image on upload).

## Walk through a failure

The **catalog** goes down. A customer has **just paid**.

- ❌ If checkout calls catalog synchronously (waiting for an answer) to finish the order, the order fails, and a confirmed payment might seem to "disappear".
- ✅ Checkout should save the paid order with the data it already has, then let other work catch up through events.

Watch out: **splitting deploys does not automatically isolate failures**. Services can still be tied together by:

- a **shared database** connection pool (one service uses all connections, everyone stalls),
- **chains of synchronous calls** (A waits for B waits for C: if C is slow, all are slow),
- **unlimited retries** (one sick service gets flooded by everyone else).

## How to prove it works

Measure **before and after** any split:

1. **Lead time:** how long from "code ready" to "live in production"?
2. **Recovery time:** how long to fix an outage?
3. **On-call load:** how many pages per week?
4. **Checkout availability:** did it go up?

Success is a **measurable improvement in running the business**, not the number of microservices.

### Check your understanding

Which component would you extract first from the marketplace above, and what measurement would justify it?

<details>
<summary>Show answer</summary>

There's no single right answer, but a strong one is **checkout**. It changes every week and causes the release collisions. Justify it with numbers like: "Checkout changes are in 60% of releases, and 1 in 4 releases is delayed by a conflict with another module." After extracting it, you'd expect checkout lead time to drop and other modules' releases to stop waiting on it. If instead the problem were load (say image resizing using 80% of CPU), you'd extract that piece first and justify it with resource use. The key: name a real pain, measure it, and check it improved.

</details>

---

## Going deeper

![Architecture patterns: central services, independently deployed services, event functions and decentralized peers](/img/system-design-l6/architecture-patterns.svg)

## The five big shapes

| Style | Good fit | Main cost |
| --- | --- | --- |
| Client-server | Most products starting out | The central service must handle all the load |
| Microservices | Teams that own separate areas and release on their own | Running many services; keeping contracts in sync |
| Serverless | Bursty, event-triggered work | **Cold starts** (slow first run after idle), time and memory limits, harder to trace |
| Event-driven | Side effects that can happen later | Events can arrive out of order, twice, or late; data is **eventually consistent** (correct soon, not instantly) |
| Peer-to-peer | Users sharing directly with each other | Finding peers, trusting them, getting through home routers (**NAT traversal**) |

Start with the **smallest shape** that meets the need. Peer-to-peer removes the central path for data, but it **doesn't** remove coordination, security or abuse problems. You still have to solve those.

## Why a monolith is often the best first choice

A monolith gives you, for free:

- **One deploy:** one button, one place to look.
- **One transaction:** "save order and reduce stock" either both happen or neither does. Across two services, this becomes hard.
- **Easy tracing:** one call stack shows the whole story.

A **modular monolith** keeps those benefits while drawing clean lines inside. Later, if a module truly needs to leave, the line is already there.

## Each pattern's first danger

| Pattern | Good fit | First danger |
| --- | --- | --- |
| Modular monolith | Early product, or steps that are tightly linked | Hidden coupling: modules sneakily read each other's tables |
| Microservice | A separate team and a separate scaling need | Network failures and data split across databases |
| Event-driven | Durable side effects, building read-only views | Handling duplicate or late events |
| Serverless job | Spiky, isolated work | Limits, cold starts, long multi-step workflows |

## Worked example: the cost of a network hop

Inside one app, a function call takes about **0.001 ms** and basically never fails. A network call to another service might take **2 to 5 ms** and fail, say, **1 in 10,000** times.

Now chain **5 services** in a row for one checkout:

- Extra time: 5 × ~3 ms = **~15 ms**, before any real work.
- Chance something fails: roughly 5 × 1/10,000 = **1 in 2,000** requests.

That's fine if you get real independence in return. It's pure cost if you don't.

## Quick recap

- 🧱 **Start simple:** a modular monolith with clear sections and owned data.
- ✂️ **Split for a reason:** scaling, release pace, team ownership or failure isolation.
- 📜 **Write the agreement:** owner, contract, source of truth, deadline, SLO, failure plan.
- 🔗 **Watch hidden links:** shared databases and call chains defeat the split.
- 📏 **Measure:** lead time, recovery time, on-call load, availability.
