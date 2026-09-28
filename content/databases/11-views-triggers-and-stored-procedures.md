---
title: "Views, Triggers & Stored Procedures"
summary: "Interview answers for views, materialized views, triggers and stored procedures. Covers PDF questions 20, 24 and 27-30."
level: Advanced
tags: [database, interview, views, materialized-view, trigger, stored-procedure]
---

## Q20, Q27 and Q28: What are views?

A regular view stores a query definition and runs it when queried. It can simplify joins, expose a secure subset, and give clients a stable interface. A materialized view stores result data; it makes expensive reads fast but has refresh work and can be stale.

| Type | Read behavior | Cost |
| --- | --- | --- |
| View | Runs the base query | Query cost each read |
| Materialized view | Reads stored result | Storage and refresh delay |

## Q24: Trigger guidance

A trigger can react to a department change, but row-by-row cursor updates are often slow. Prefer set-based updates, clear ownership and auditability. Use triggers for local data rules, not cross-service workflows.

## Q29 and Q30: Stored procedure versus trigger

A stored procedure is explicitly called and accepts inputs. A trigger runs automatically from an event. Transaction-control and return-value capabilities vary by engine, so name the product in an interview.
