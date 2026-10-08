---
title: "Big Data: ETL, Warehouses and Streaming"
summary: "Build reliable analytical pipelines with batch/stream processing, lake and warehouse layers, and explicit freshness contracts."
level: Advanced
tags: [system-design, mapreduce, etl, data-lake, warehouse, lambda, kappa]
---

![Analytics pipeline: raw events land durably, ETL/stream processing creates curated lake and warehouse datasets](/img/system-design-l6/big-data.svg)

MapReduce partitions large batch work into map, shuffle and reduce stages. ETL extracts, transforms and loads curated data. A data lake holds raw/flexible data; a warehouse optimizes governed analytical queries; a lakehouse combines lake storage with warehouse-style tables.

Lambda architecture combines batch truth with a speed layer; Kappa treats an ordered event stream as the main source and reprocesses it when logic changes. Choose based on team operations and freshness needs, not fashion. Record lineage, schema evolution, data quality checks and the age of the newest successful dataset.

## A dependable analytics pipeline

Land immutable raw events with source, schema version and arrival time. Validate them, quarantine malformed records, and transform them into curated tables. Publish a freshness contract: for example, “daily revenue is complete by 08:00 UTC; dashboard events are under five minutes old.” A dashboard with old data should say it is old, not silently look current.

Every stage needs counts and reconciliation: input rows, accepted rows, rejected rows, output rows, duplicates and newest data timestamp. Partition data by time and commonly filtered dimensions, but avoid producing millions of tiny files/partitions.

Backfills must be isolated from current production work and idempotent. They often expose hidden assumptions about mutable source data, schema changes and duplicate events.
