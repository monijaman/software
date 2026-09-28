---
title: "Normalization & Denormalization"
summary: "Learn 1NF, 2NF, 3NF and BCNF with one concrete order example, then decide when a controlled denormalized read model is worth it."
level: Intermediate
tags: [database, normalization, denormalization, 1nf, 2nf, 3nf, bcnf, data-modeling]
---

## The goal: one fact, one home

Normalization organizes a relational database so a fact is stored once, in the table that owns it. This avoids three problems: an **update anomaly** (the same fact changes in some rows but not others), an **insert anomaly** (you cannot record a fact until an unrelated fact exists), and a **delete anomaly** (deleting one row accidentally removes a fact you still need).

We will normalize one deliberately bad order table:

| order_id | customer_name | customer_email | product_id | product_name | unit_price | quantity |
| --- | --- | --- | --- | --- | ---: | ---: |
| 1001 | Asha | asha@example.com | P10 | Keyboard | 50 | 1 |
| 1001 | Asha | asha@example.com | P20 | Mouse | 20 | 2 |
| 1002 | Ben | ben@example.com | P10 | Keyboard | 50 | 1 |

Problems are already visible: Asha email repeats, Keyboard price repeats, and an order has several products. If the keyboard is renamed, every historical line could be changed by mistake.

![Normal forms reduce a mixed order table into tables that each own one kind of fact](/img/database/normal-forms.svg)

## Before 1NF: identify the key and dependencies

The natural row key is **(order_id, product_id)** because one order can contain many products. The important dependencies are:

- order_id determines the customer for that order.
- product_id determines the current product name and catalog price.
- customer_id determines customer name and email.
- (order_id, product_id) determines quantity.

Write dependencies before splitting tables. They explain exactly why a column belongs somewhere else.

## First Normal Form (1NF): atomic values, no repeating groups

**Rule:** each cell contains one value; every row has a key; do not keep a repeating list inside a column.

Bad 1NF example: an orders row contains products = "Keyboard, Mouse" or product_ids = "P10,P20". A query cannot safely join, constrain, index, or update one item inside that string.

Good 1NF shape: one row per order item. The example table above is already in 1NF because each row represents one order-product combination and each cell is atomic.

> 💡 1NF does not mean “no duplicate values.” It means values are atomic and repeating groups are modeled as rows in another table.

## Second Normal Form (2NF): depend on the whole key

**Rule:** be in 1NF, and every non-key column must depend on the **whole** composite key, not only part of it. This matters only when the key has multiple columns.

In the order_items table keyed by (order_id, product_id):

- quantity depends on both order_id and product_id, so it stays.
- customer_name and customer_email depend only on order_id, so they move to orders/customers.
- product_name and unit_price depend only on product_id, so they move to products.

After 2NF:

| Table | Key | Owns |
| --- | --- | --- |
| order_items | order_id, product_id | quantity and price_at_purchase |
| orders | order_id | customer_id, ordered_at, status |
| products | product_id | product_name, current_catalog_price |

Keep **price_at_purchase** in order_items if it is the historical amount charged. It is not an accidental duplicate of current_catalog_price: it represents a different business fact.

## Third Normal Form (3NF): no non-key depends on another non-key

**Rule:** be in 2NF, and a non-key attribute must not depend on another non-key attribute. In short: key -> the row facts, not key -> other column -> another column.

Suppose orders stores customer_id, customer_name and customer_email. Then order_id -> customer_id and customer_id -> customer_name/email. Name/email have a **transitive dependency** on order_id through customer_id. Move them to customers.

Final 3NF core:

| customers | products | orders | order_items |
| --- | --- | --- | --- |
| customer_id PK | product_id PK | order_id PK | order_id FK |
| name | name | customer_id FK | product_id FK |
| email UNIQUE | current price | ordered_at | quantity |
|  |  | status | price_at_purchase |

Now changing a customer email changes one row, and creating a product does not require inventing an order.

## BCNF: every determinant is a candidate key

BCNF is stricter than 3NF. For every dependency X -> Y, X must be a candidate key. It handles rare cases where a table passes 3NF but a business rule still causes redundancy.

Example: course_room(course, instructor, room), with course -> instructor and instructor -> room because each instructor uses one assigned room. If the key is (course, room), instructor determines room but instructor is not a candidate key. Split into course_instructor(course, instructor) and instructor_room(instructor, room).

For normal application schemas, reaching solid 3NF plus explicit constraints is usually the practical goal. Use BCNF when you can clearly identify a non-key determinant causing anomalies.

## Normal forms at a glance

| Form | Removes | Question to ask |
| --- | --- |
| 1NF | Lists/repeating groups in cells | Is each cell one value and each row identifiable? |
| 2NF | Partial dependency on part of composite key | Does every non-key need the whole key? |
| 3NF | Transitive dependency between non-keys | Does a non-key fact depend on another non-key fact? |
| BCNF | Any non-key determinant | Is every determinant a candidate key? |

## Denormalization: an intentional, measured exception

Denormalization copies or precomputes data to make a measured read path faster. It is not a replacement for good modeling. Use it after you have a correct source of truth and evidence that a query is slow enough to matter.

![A normalized source of truth can publish a controlled, rebuildable read model for a fast dashboard](/img/database/normalization.svg)

Good examples: a materialized sales summary, a search document, a product card projection, or an order total. For each one document:

1. The normalized source of truth.
2. The event/transactional outbox or refresh job that updates the copy.
3. Acceptable freshness delay.
4. Rebuild and reconciliation procedure.
5. Metric for stale/failed projections.

## Interview-ready answer

> I normalize to ensure one fact has one authoritative home. First I make values atomic in 1NF. If I have a composite key, I move fields that depend on only part of it to reach 2NF. Then I remove non-key-to-non-key dependencies for 3NF, using foreign keys and unique constraints to preserve the relationships. I use BCNF for exceptional dependency patterns where a non-key determinant still creates redundancy. I denormalize only for a measured read bottleneck, with an explicit source of truth, update path, freshness target and rebuild plan.
