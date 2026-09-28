---
title: "SQL Interview Query Drills"
summary: "Correct solutions for duplicates, above-average values and third-highest salary. Covers PDF questions 23, 25 and 26."
level: Intermediate
tags: [database, interview, sql, group-by, subquery, window-functions]
---

![SQL drill workflow: define grouping, compute an aggregate, then filter with a clear tie policy](/img/database-interviews/sql-drills.svg)

## Q23: Find repeated rows

SELECT name, section, COUNT(*) AS copies FROM students GROUP BY name, section HAVING COUNT(*) > 1;

For cleanup, decide which row to keep in a transaction and add a unique constraint to prevent recurrence.

## Q25: Students above average

SELECT student, marks FROM student_marks WHERE marks > (SELECT AVG(marks) FROM student_marks);

The parentheses are essential. For an average per class, use a correlated subquery or partitioned window function.

## Q26: Third-highest distinct salary

Use DENSE_RANK ordered by salary descending, then filter rank = 3. It returns all people tied at the third distinct salary. Ask whether the interviewer instead wants one row or the third row after sorting; the query differs.
