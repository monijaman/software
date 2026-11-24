---
title: "Observability and Incident Response"
summary: "Use metrics, traces and logs together to find out what is really broken in production, fix it, and prove it's fixed."
level: Advanced
tags: [system-design, observability, logs, metrics, tracing, incident-response]
---

## The story in one minute

You ship a new release at 2:00 PM. At 2:10, customers start writing in: **"I can't check out!"**

You look around:

1. The **homepage** loads fine.
2. The servers' **CPU graphs** look normal. No spike.
3. Someone says "let's just restart everything." That wipes out the clues and might make some orders run twice.
4. Nobody can say **who** is affected, **where** it breaks, or **whether** the release caused it.

The system is broken, but your tools don't show it. This lesson is about being able to **see** inside your system (*observability*) and handling outages calmly (*incident response*).

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Metric** | A number tracked over time. | Your car's speedometer. |
| **Trace** | The full path of one request, with time spent at each stop. | A parcel tracking page: "left warehouse, at depot, out for delivery". |
| **Log** | A written note about one event. | A ship's logbook entry. |
| **SLO** | A promise about how well a feature works (Service Level Objective). | "99.9% of checkouts succeed this month." |
| **Incident** | A live problem that hurts users and needs a coordinated response. | A kitchen fire: someone leads, someone calls, someone grabs the extinguisher. |

## The fix in three rules

### Rule 1: Start from what the customer feels

❌ **Wrong:** stare at CPU and memory graphs and hope something looks odd.

✅ **Right:** look at **checkout success rate and checkout speed**. Then split them by **release version, region and dependency** (the services checkout calls). This tells you how big the problem is: all users, one region, or only the new release?

### Rule 2: Connect the clues with shared IDs

Give each request a **request ID** and each user action an **intent ID** (for example the order ID). Put these IDs in traces and logs. Now you can jump from "this checkout failed" to its trace, and from the trace to its exact log lines.

⚠️ But **don't** put IDs like `order_id` into **metric labels**. Every unique label value creates a new time series to store. A million orders would mean a million series (this is called *high cardinality*) and your metrics system slows down or falls over. IDs belong in logs and traces; metrics get small fixed labels like `region` or `release`.

### Rule 3: Run the incident like a team, not a crowd

- Pick **one incident lead** who coordinates.
- Write down each **guess** (hypothesis) and each **decision** with the time.
- After a fix or rollback, check the **same customer signal** you started with. If checkout success is back up, you're recovering.

## Walk through a failure

Checkout calls payment. Payment **accepts** the charge, but the reply times out on the way back. Checkout shows "error".

- ❌ Without a stable intent ID in the logs, you can't tell "the network dropped the reply" apart from "the card was really declined". You might tell the customer to pay again.
- ✅ With `order_id=981` in every log line, you can see payment logged "charge accepted" for 981. It's a lost reply, not a failed charge.

⚠️ **Restarting every service** feels like action, but it erases evidence (in-memory state, stuck threads) and can make half-finished work run twice.

## How to prove it works

Run a **fault drill**: break something on purpose in a safe environment, then measure:

1. **Time to detect:** how long until an alert fired?
2. **Time to mitigate:** how long until users were less hurt?
3. **Time to recover:** how long until everything was normal?
4. Real checkouts succeed again, and any **stuck work** (queued jobs, pending payments) has been cleared.

Only then close the incident. Write follow-up tasks that target the cause you actually **proved**, not a guess.

### Check your understanding

Checkouts are failing. What evidence tells you whether the failures affect **one region** or **one release**?

<details>
<summary>Show answer</summary>

Split the **checkout error rate** (and latency) by the `region` label and by the `release` (version) label.

- If errors are high in one region across **all** versions, it's a **regional** problem (for example a broken database or network there).
- If errors are high for the **new release** in **every** region, and the old version is fine, it's the **release**.

Traces tagged with region and version, plus deploy history ("when did each region get the new version?"), confirm it. This is why region and release make good metric labels: there are only a few of each.

</details>

---

## Going deeper

## Three views of the same problem

Imagine checkout becomes slow at 2:05 PM. Each tool shows you a different piece:

| Tool | What it tells you | In this example |
| --- | --- | --- |
| **Metrics** | **That** something changed | p99 latency rose from 400 ms to 3.2 s, and database connections are all in use. |
| **Traces** | **Where** the time went | 2.7 s is spent waiting on the inventory database. |
| **Logs** | **Why** it happened | A new query is missing an index for one product category. |

(*p99 latency* means: 99% of requests are faster than this. It shows how the slowest 1% of users feel.)

Think of a doctor: the thermometer says you have a fever (metric), the scan shows where the infection is (trace), and the lab notes explain what caused it (log).

## The smallest useful request record

A good log line is **structured**: key=value pairs a computer can search, not a free-text sentence.

```text
request_id=R-82 tenant=acme route=/checkout order_id=981
duration_ms=812 payment_state=UNKNOWN inventory_version=44
```

Pass the `request_id` (and trace context) along with every HTTP call and every event, so the whole path stays connected.

🔒 **Never log** passwords, card numbers, access tokens, or personal data you don't need.

## Alert on user pain, not on noise

- ✅ **Good alert:** "At the current failure rate, checkout will use up this month's error budget in 45 minutes."
- ❌ **Noisy alert:** "One CPU sample was 85%."

The *error budget* is the amount of failure your SLO allows. With a 99.9% SLO, 0.1% of checkouts may fail this month. If failures are using that up 20 times faster than normal (a high *burn rate*), something real is wrong.

## The incident loop

1. **Confirm** what users see and **when** it started.
2. **Limit the damage** (the *blast radius*): pause a rollout, turn off optional traffic, or stop a bad queue consumer.
3. **Form a guess and test it** using dashboards, traces and recent changes.
4. **Recover safely**, then test the **real user path**, not just a `/health` check that says "I'm alive".
5. **Write it up:** timeline, root cause, lasting fix, and a new signal that would warn you earlier next time.

The goal is **not** to blame someone. It's to make the next failure smaller and easier to spot.

## A practical incident timeline

| Time | What happens |
| --- | --- |
| 14:05 | SLO alert: checkout failures are burning the error budget **20× too fast**. |
| 14:07 | Incident lead confirms the symptom. Assigns one person to talk to customers and others to investigate. Freezes unrelated deploys. |
| 14:15 | Traces show inventory calls waiting. Pool metrics show all database connections in use. Logs link it to a new report query. |
| 14:18 | **Mitigation:** turn off the new report. |
| 14:22 | Team places a **real test checkout**, not only a `/health` check. It works. |

After recovery, write down:

- when customer impact **started and ended**,
- **what changed**, and **why** safety checks missed it,
- the **lasting fix**: a separate connection pool for reports, the missing index, an earlier alert, and a tested rollback.

Don't claim a cause you can't back up with evidence.

## Telemetry checklist

(*Telemetry* just means all the data your system reports about itself.)

- **Metrics:** traffic, errors, latency percentiles, saturation (how full things are), and business success (e.g. orders placed).
- **Traces:** one shared context passed through HTTP calls, queues and background jobs.
- **Logs:** structured, searchable, with no secrets or unneeded private data.
- **Runbooks:** a written guide per alert with the owner, safe mitigation, rollback steps, how to verify, and who to call next.

Observability works when a brand-new on-call engineer can answer three questions: **Who is hurt? Where is the time going? What change is safe to make?**

## Quick recap

- 👤 **Start from the customer signal** (checkout success), split by region, release and dependency.
- 🔗 **Connect metrics, traces and logs** with shared request and intent IDs, but keep IDs out of metric labels.
- 🧑‍✈️ **One incident lead**, written decisions, and no "restart everything" panic.
- ✅ **Prove recovery** with a real user action, then fix the cause you actually proved.
