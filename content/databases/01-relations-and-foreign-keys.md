---
title: "Database Relations & Foreign Keys"
summary: "Model one-to-one, one-to-many and many-to-many data with keys, constraints and deletion rules that protect real business facts."
level: Intermediate
tags: [database, relations, foreign-keys, joins, schema]
---

## Start from the real-world ownership rule

A relation is not an ORM decoration. It is a database promise: an order belongs to one customer; an order contains many items; a student may take many courses. Good schemas make invalid states hard or impossible to save.

![Relations: foreign keys connect one-to-one, one-to-many and many-to-many records](/img/database/relations.svg)

## The three relationship shapes

| Shape | Real-life picture | Table design | Constraint that matters |
| --- | --- | --- | --- |
| One-to-one | User has one profile | profiles.user_id | UNIQUE plus foreign key |
| One-to-many | Customer places orders | orders.customer_id | Foreign key and index |
| Many-to-many | Students take courses | enrollments table | Two foreign keys and a composite unique key |

### One-to-one: use it only when it earns its place

A profile table can separate sensitive or rarely-used data from users. Its user_id is both a foreign key and unique. Do not split tables merely because two columns look related; a profile with the same lifecycle can live in the users table.

### One-to-many: the child owns the foreign key

An order has customer_id because many orders point to one customer. Add an index on orders(customer_id) when the product frequently loads a customer orders. A foreign key prevents an order from pointing to a customer that does not exist.

### Many-to-many: use a join table, never a comma-separated list

An enrollment is a relationship with its own facts: enrolled_at, role, grade or status. The table belongs in the model.

    enrollments(student_id, course_id, enrolled_at, status)
    PRIMARY KEY (student_id, course_id)

The composite primary key stops a student being enrolled in the same course twice. Add a reverse index on course_id if you list students in a course.

## Constraints are part of the application

| Rule | Database protection |
| --- | --- |
| Every order has a customer | NOT NULL customer_id + foreign key |
| One profile per user | UNIQUE(user_id) |
| Quantity cannot be negative | CHECK (quantity > 0) |
| One enrollment per pair | PRIMARY KEY(student_id, course_id) |

Application validation gives a friendly message; constraints protect the rule when another service, script or race condition bypasses that validation.

## Delete behavior is a product decision

RESTRICT blocks deleting a customer with history. CASCADE removes true dependents, such as temporary draft items. SET NULL preserves a record whose relationship became optional. Never choose CASCADE by default: deleting a parent can destroy far more data than the screen suggests.

## Practical checklist

1. Name the business relationship in a sentence.
2. Choose the table that owns the foreign key.
3. Add NOT NULL, UNIQUE and CHECK constraints for invariants.
4. Index the foreign key for common joins and filters.
5. Decide delete/update behavior before production data exists.
