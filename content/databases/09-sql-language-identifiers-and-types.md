---
title: "SQL Language, Identifiers & Data Types"
summary: "Interview answers for DDL/DML/DCL, generated IDs, UNION, static/dynamic SQL and CHAR/VARCHAR. Covers PDF questions 6, 7, 13, 21 and 22."
level: Intermediate
tags: [database, interview, sql, ddl, dml, identity, union, varchar]
---

## Q6: DDL, DML and DCL

DDL defines structures: CREATE, ALTER and DROP. DML reads/changes data: SELECT, INSERT, UPDATE and DELETE. DCL manages permissions: GRANT and REVOKE. Many systems call COMMIT and ROLLBACK transaction-control statements.

## Q7: Identity, sequence and UUID

An identity/auto-increment column generates numeric values. A sequence is a reusable database counter. UUIDs can be generated without a central counter and help distributed writes, but cost more index space. Generated IDs still usually need primary-key indexes.

## Q13: UNION vs UNION ALL

UNION removes duplicates, usually with sort/hash work. UNION ALL returns every row and is faster when duplicates are valid or impossible.

## Q21: Static versus dynamic SQL

Static SQL has a known shape and binds values. Dynamic SQL constructs statement shape at runtime. Bind user values rather than concatenating them to prevent injection.

## Q22: CHAR versus VARCHAR

CHAR is fixed-width; VARCHAR is variable-width. Use CHAR for truly fixed values such as a country code and VARCHAR for variable text. Exact limits and behavior are engine-specific.
