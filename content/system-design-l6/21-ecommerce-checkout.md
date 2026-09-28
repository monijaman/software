---
title: "Design an E-Commerce Checkout"
summary: "Keep browsing scalable while protecting the correctness-critical path: inventory reservation, idempotent payment, order creation and durable events."
level: Advanced
tags: [system-design, ecommerce, checkout, inventory, payments]
---

![Checkout: catalog/search are read paths while inventory, payment and order transitions are owned and idempotent](/img/system-design-l6/ecommerce-checkout.svg)

Catalog, search and recommendations can be cached and eventually consistent. Checkout cannot: reserve inventory atomically, create/get a payment attempt with an idempotency key, then commit an order and publish an outbox event.

Do not hold a database transaction open across payment. Handle unknown provider outcomes through reconciliation; expire reservations; isolate checkout capacity from bulk exports and marketing traffic.
