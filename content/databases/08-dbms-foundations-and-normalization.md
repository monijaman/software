---
title: "DBMS Foundations, Keys & Normalization"
summary: "Detailed interview answers for DBMS advantages, normalization, keys, abstraction and conceptual design. Covers PDF questions 1-5, 12, 14-17 and 19."
level: Intermediate
tags: [database, interview, normalization, keys, functional-dependency, schema]
---

## Q1 and Q12: What is normalization and why use it?

Normalization organizes facts so each fact has one authoritative home. It reduces redundancy and insertion, update and deletion anomalies. Start from functional dependencies, split tables only when the split preserves necessary relationships, and stop when the design meets product query needs. Normalized tables protect correctness; a read-heavy path may use a controlled denormalized projection.

![Interview map: keys identify records, dependencies guide normalization, and constraints enforce relationships](/img/database-interviews/foundations.svg)

## Q2, Q3 and Q19: Explain key types

| Key | Interview answer |
| --- | --- |
| Superkey | Any attributes that uniquely identify a row. |
| Candidate key | A minimal superkey. |
| Primary key | One chosen candidate key; non-null and unique. |
| Unique constraint | Enforces uniqueness; null behavior varies by engine. |
| Foreign key | References another table key and protects integrity. |

Do not claim unique keys allow exactly one null everywhere: engine behavior differs. A primary key is always non-null.

## Q4 and Q5: Why DBMS instead of files?

A DBMS centralizes data, supports concurrent access, transactions, constraints, authorization, backup/recovery and data independence. File systems store bytes but do not naturally enforce cross-file integrity or safe shared updates.

## Q14-Q17: Abstraction, dependencies and design

Physical level describes storage; logical level describes entities and relations; view level exposes a useful slice. A functional dependency A -> B means A determines B. Conceptual design models entities, attributes, relations and constraints before implementation.
