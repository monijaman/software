---
title: "Big Data: ETL, Warehouses and Streaming"
summary: "Turn millions of raw events into reports people can trust: keep the raw data, clean it in clear stages, say how fresh each report is, and be able to rebuild when something goes wrong."
level: Advanced
tags: [system-design, mapreduce, etl, data-lake, warehouse, lambda, kappa]
---

## The story in one minute

A retailer gets **50 million** events a day: purchases, page views, clicks. Two teams want numbers:

- **Finance** wants yesterday's revenue, exact, and the same every time they ask.
- **Operations** wants a live dashboard, **at most 2 minutes** behind.

Here is what goes wrong, step by step:

1. A small code change in the cleanup step counts each purchase **twice**.
2. Yesterday's revenue report shows **$2 million** instead of $1 million.
3. The team fixes the code, but the raw events were thrown away after cleanup. There's **nothing to recompute from**.
4. They patch the report by hand. Halfway through, finance opens it and sees a mix of old and new numbers.
5. Meanwhile, the live dashboard stopped updating an hour ago, but still looks "live." Nobody notices.

This lesson is about building data pipelines you can **trust, explain and rebuild**.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Pipeline** | A series of steps that moves and cleans data. | A water plant: collect, filter, deliver. |
| **ETL** | **E**xtract data, **T**ransform (clean, join, sum) it, **L**oad it where reports read it. | Collect receipts, sort and total them, put the summary in a binder. |
| **Data warehouse** | A database built for big report queries. | A library organized for research. |
| **Batch vs streaming** | Batch: process a big pile at once (e.g. nightly). Streaming: process each event as it arrives. | Doing laundry once a week vs washing each shirt right away. |
| **Backfill** | Re-running a pipeline over past data. | Re-grading last month's exams with the corrected answer key. |

## The fix in three rules

### Rule 1: Keep the raw events, and never change them

Land every event as-is, with an **event ID**, a **schema version** (which format it's in), and the time it arrived. These raw files are **immutable** (never edited, only added to).

Keep **ingestion** (collecting) separate from **transformation** (cleaning and calculating). Then a bug in transformation can always be fixed by re-running from the untouched raw data.

### Rule 2: Clean in stages, and say how fresh each result is

1. **Raw** layer: exactly what arrived.
2. **Curated** layer: cleaned, duplicates removed, sorted by **event time** (when it actually happened, not when it arrived; a phone offline for an hour sends events late).
3. **Warehouse** layer: tables shaped for reports ("revenue per day per store").

Publish a **freshness promise** for each output, like: "daily revenue complete by 08:00 UTC" and "dashboard under 5 minutes old." If data is older than promised, the dashboard should **say so**.

### Rule 3: Stream for speed, batch for repair, and write the rules once

- **Streaming** keeps the dashboard fresh.
- **Batch backfills** (limited to the date range you need) fix the past.
- Try to keep **one** implementation of each business rule ("what counts as revenue?"). Two separate versions, one for streaming and one for batch, will slowly drift apart and give different answers.
- **Partition** data (split it into folders) by how people query it, usually by date, so a "last 7 days" query reads 7 folders, not all of history.

## Walk through a failure

The double-counting bug doubled yesterday's revenue.

1. **Fix** the transformation code.
2. **Replay** yesterday's raw partition through the fixed code into a **new version** of the output (e.g. `revenue_v2`), not on top of the live one.
3. **Check** the new numbers against the order database.
4. **Swap** the report to point at the new version in **one step** (an **atomic publish**). Finance never sees a half-fixed table.

## How to prove it works

1. **Reconcile:** compare report totals to the real transactional records (the orders database). They must match.
2. **Test a full backfill** of, say, a month, before you need one in an emergency.
3. **Measure freshness:** how old is the newest data in each output?
4. **Count at each step:** missing input, duplicates, and **cost** per job.

A fast dashboard with **wrong** revenue is a failure, not a success.

### Check your understanding

The team must rebuild a full month of reports after a bug. What must they have kept to do that?

<details>
<summary>Show answer</summary>

- The **raw events** for that whole month, unchanged, with their event IDs (to remove duplicates).
- The **schema versions** so old events can still be read correctly.
- The **code and business rules** (version of the transformation) that should apply.
- Any **reference data** used in the calculation as it was at that time (e.g. product prices, currency rates, store list).

If the raw events were deleted or edited, the month can't be rebuilt honestly. That's why raw data is kept immutable.

</details>

---

## Going deeper

![Analytics pipeline: raw events land durably, ETL/stream processing creates curated lake and warehouse datasets](/img/system-design-l6/big-data.svg)

## MapReduce: the original big batch idea

Say you want "total sales per store" over 10 billion rows. One machine is too slow. **MapReduce** splits the work across many machines in three stages:

1. **Map:** each machine reads its chunk and outputs pairs like `(store_7, $20)`.
2. **Shuffle:** all pairs for the same store are sent to the same machine.
3. **Reduce:** each machine adds up the values for its stores: `(store_7, $41,200)`.

Modern tools (like Spark) are faster and easier, but use the same idea.

## Lake, warehouse, lakehouse

| | Data lake | Data warehouse | Lakehouse |
| --- | --- | --- | --- |
| Stores | Raw files of any shape | Clean, structured tables | Files in a lake, but with table features |
| Like... | A big storage unit, everything in boxes | A neat library with a catalog | A storage unit with a catalog and shelves |
| Good for | Keeping everything cheaply, replay | Fast, governed business reports | Both, in one place |

## Lambda vs Kappa architecture

- **Lambda:** run **two** paths. A **batch** layer computes the correct, complete answer slowly. A **speed** layer gives quick, approximate answers for the latest data. Reports combine both. Downside: two codebases for the same logic.
- **Kappa:** keep everything as **one ordered event stream** (like a long log). There's only a streaming path. When logic changes, **replay the stream** from the start through the new code.

Pick by your team's skills and freshness needs, not by what's trendy.

## A dependable pipeline, step by step

1. **Land** immutable raw events with source, schema version and arrival time.
2. **Validate** them. Move broken records to a **quarantine** area (a holding pen) instead of dropping them silently or crashing the pipeline.
3. **Transform** into curated tables.
4. **Publish** with a freshness contract. An old dashboard should **show its age** ("data as of 10:42"), not quietly look current.

Track **lineage**: which inputs and code produced each table, so you can answer "where did this number come from?"

## Count everything at every stage

| Stage | Count |
| --- | --- |
| Input | 50,000,000 rows |
| Accepted | 49,980,000 |
| Rejected (quarantined) | 15,000 |
| Duplicates removed | 5,000 |
| Output | 49,980,000 |
| Newest event time | 07:58 UTC |

If accepted + rejected + duplicates doesn't add up to input, something is leaking. Here, 49,980,000 + 15,000 + 5,000 = 50,000,000, so it checks out.

## Partitions: not too few, not too many

Partition by **time** (e.g. one folder per day) and maybe one commonly filtered field (e.g. country). But don't go too fine: partitioning by day **and** by user creates millions of tiny files, and reading many tiny files is very slow.

## Backfills need care

- **Isolate them:** run on separate capacity so they don't slow down today's pipeline.
- **Make them idempotent:** running a backfill twice must give the same result, not double data.
- **Expect surprises:** backfills often reveal that source data was edited after the fact, old events had a different schema, or duplicates existed all along.

## Quick recap

- 📥 **Keep raw events forever (or long enough), unchanged.** They're your undo button.
- 🧹 **Clean in layers:** raw, curated, warehouse.
- ⏱️ **Publish freshness promises**, and show the data's age when it's late.
- 🔁 **Fix by replaying** into a new version, then swap in one step.
- 🧮 **Count rows at every stage** and reconcile with the real records.
