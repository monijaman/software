---
title: "Design a Logging and Monitoring Platform"
summary: "Collect huge amounts of logs and metrics without losing the important ones, keep recent data fast to search and old data cheap to store, and send alerts people actually trust."
level: Advanced
tags: [system-design, logging, monitoring, metrics, tracing, observability]
---

## The story in one minute

You run **5,000 services**. Together they write **200,000 log lines per second**. Then an outage starts:

1. Engineers turn on **debug logging** to see what's wrong. Log volume jumps **10×** to 2,000,000 lines per second.
2. The search system that makes logs findable **falls behind**. New logs take 30 minutes to show up.
3. The logging library inside each app **waits** for the log system to accept its lines. Apps slow down.
4. Your logging system is now **making the outage worse**, right when you need it most.

This lesson is about a logging and monitoring platform that **helps during a crisis instead of adding to it**.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Telemetry** | All the data apps send about themselves: logs, metrics, traces. | A car's dashboard lights and trip computer. |
| **Logs / metrics / traces** | Logs: detailed event lines. Metrics: numbers over time (requests per second). Traces: the path of one request through many services. | A diary, a step counter, and a GPS route of one trip. |
| **Agent** | A small program on each machine that collects telemetry and sends it on. | A mail carrier collecting letters from each house. |
| **Sampling** | Keeping only some of the data (e.g. 1 in 100) on purpose. | A pollster asking 1,000 people instead of everyone. |
| **High cardinality** | A label with a huge number of different values (like user ID). | Sorting mail by street (few) vs by person's name (millions). |

## The fix in three rules

### Rule 1: Never let logging block the app

The **agent** on each machine:

- collects lines into **batches** (send 1,000 at once, not one by one),
- keeps a **bounded buffer** (a waiting area with a size limit, like 200 MB),
- sends **critical events first**,
- never makes the app's own threads wait.

❌ **Wrong:** the app pauses until the log system says "got it".

✅ **Right:** if the buffer fills up, **drop the least important logs first** (debug), on purpose, and count what was dropped. Don't eat unlimited memory.

### Rule 2: Write once to a durable stream, then build views from it

1. Agents send to an **ingestion gateway** (the front door that checks who's sending and whether they're over quota).
2. The gateway appends everything to a **durable stream** (like Kafka: a log on disk that keeps data for days and can be re-read).
3. From that stream, separate workers build:
   - a **hot index** for fast search of recent data (e.g. last 7 days),
   - **cheap archival storage** for older data (slower to search).

If one view breaks, the stream still has the data.

### Rule 3: Put limits on cost and access

- **Control high-cardinality labels** (no user IDs in metric labels).
- Set **retention**: how long each kind of data is kept.
- Restrict **access**: who can read which logs.
- Make searches use a **bounded time range** ("last 1 hour", not "all time").
- Keep **ingestion capacity separate from search capacity**, so one heavy search can't stop new logs coming in.

## Walk through a failure

The **indexer** (the part that makes logs searchable) crashes. The stream is fine.

- Logs keep flowing into the stream. Nothing is lost **as long as** the indexer comes back within the stream's retention window (e.g. 3 days).
- When it returns, it **replays** (re-reads) from where it stopped and catches up.

Now the log storm. Agent buffers fill up:

- Debug logs are dropped **first**, on purpose.
- Security audit events keep their place.
- The app's memory and speed are protected.

Losing data on purpose, by priority, is better than losing it randomly or crashing the app.

## How to prove it works

1. **Kill the indexer** for an hour. Check: no data lost, it catches up, search freshness recovers.
2. **Simulate a log storm** (10× volume). Check: app latency stays normal.
3. Measure: **ingestion lag** (how far behind), **dropped events by type**, search freshness, and app latency.

A dashboard that stays green does **not** prove critical events were kept. Count them.

### Check your understanding

Which logs can be sampled, and which need a durable audit trail?

<details>
<summary>Show answer</summary>

**Can be sampled (or dropped first under pressure):** debug logs, routine "request succeeded" logs, and traces for normal successful requests. A few out of every hundred is enough to spot patterns.

**Must be kept durably and completely:** security audit events (logins, permission changes, admin actions, data exports), payment and other financial records, and anything required by law or compliance. Errors are also worth keeping in full where possible. Audit trails also need protection from editing and clear retention rules.

</details>

---

## Going deeper

![Telemetry platform: agents batch into an ingestion layer, durable streams feed hot search, metrics and cold archival](/img/system-design-l6/telemetry-platform.svg)

## The data's journey, step by step

1. **Write structured events.** Not just free text, but fields: timestamp, service, environment (prod/staging), severity, request or trace ID, and labels that are safe to share between customers.
2. **Agent batches and compresses** them and sends them to the **authenticated** gateway (it checks who is sending).
3. **Gateway checks** quota and format, then writes to durable storage. It says "OK" back to the agent **only after** the data is safely stored to the agreed level.
4. **Processors build indexes** for recent data so searches are fast.
5. **Older data moves** to cheaper storage. Searching it is slower but costs much less.

Split data by **tenant** (customer) and **time**, enforce quotas per tenant, and sample telemetry that has high cardinality.

## Logs, metrics and traces cost differently

| Type | What it is | Size | Typical handling |
| --- | --- | --- | --- |
| Metrics | Numbers, already summed up (e.g. "errors per minute = 12") | Small | Keep for a long time |
| Logs | Full detail of each event | Can explode in volume | Keep hot briefly, archive the rest |
| Traces | One request's path across services | Large per request | Keep a **sample** |

## Why high cardinality is expensive: worked numbers

A metric `http_requests` with labels `service` (50 values) and `status` (5 values) makes 50 × 5 = **250** separate series (lines on a chart). Fine.

Add a `user_id` label with **1,000,000** users: 250 × 1,000,000 = **250 million** series. Storage and query time explode.

So: **never put unbounded values** (user IDs, request IDs) in metric labels. Put them in logs or traces, where you search for them one at a time.

## Hot vs cold storage

| | Hot | Cold |
| --- | --- | --- |
| Age of data | Last few days | Weeks to years |
| Search speed | Seconds | Minutes or more |
| Cost | High | Low |
| Use | Debugging today's outage | Audits, long-term trends |

## Alerts people trust

- Alert on **symptoms users feel**, measured against your **SLO** (service level objective, a target like "99.9% of checkouts succeed"). "Checkout errors are above 1%" is useful. "CPU at 80%" often isn't.
- Every alert links to a **runbook** (a short "what to do" guide).
- Too many noisy alerts teach people to ignore them.

## Questions to answer before an incident

1. Can an engineer find **all events for one request** (using a request or trace ID)?
2. Can each **tenant** see only its own data?
3. If ingestion is overloaded, what goes first: **debug logs** or **security audit records**? (Answer: debug logs.)
4. What are the **retention and deletion rules**? Decide before you collect, not after.

What to watch on the platform itself: ingestion lag, dropped samples, query speed, cardinality, and storage cost. Keep an audit trail of who accessed what.

## Quick recap

- 🚫 **Never block the app:** batch, buffer with a limit, drop by priority.
- 🌊 **Durable stream first:** indexes and archives are rebuildable views.
- 🔥 **Hot and cold:** fast search for recent data, cheap storage for old.
- 🏷️ **Watch cardinality:** no user or request IDs in metric labels.
- 🔔 **Alert on user pain:** SLO-based, with a runbook.
