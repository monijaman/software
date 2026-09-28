---
title: "Domain-Driven Design: Strategic Design"
summary: DDD's big-picture tools. Domains and subdomains, ubiquitous language, bounded contexts, all the context-mapping patterns, and event storming to discover them.
level: Intermediate
tags: [architecture, ddd, bounded-context, ubiquitous-language, context-map]
---

## The big idea

Software fails most often not because of bad code, but because developers **misunderstand the business**. Ask a warehouse worker and a salesperson what a "customer" is, and you'll get two different answers, both correct in their own world.

**Domain-Driven Design** (Eric Evans, 2003) says: put the **business domain** at the centre of software design, build a **shared language** with domain experts, and draw **explicit boundaries** where that language changes.

DDD has two halves:

| | **Strategic design** (this lesson) | **Tactical design** (next lesson) |
| --- | --- | --- |
| Zoom level | The whole business and system | Code inside one boundary |
| Tools | Subdomains, ubiquitous language, bounded contexts, context maps | Entities, value objects, aggregates, repositories, domain events |
| Answers | *Where* do we draw boundaries? What deserves the most care? | *How* do we model the rules in code? |

![Strategic DDD: subdomains in the problem space, bounded contexts in the solution space](/img/architecture/ddd-strategic.svg)

## 1. Domain and subdomains (the problem space)

The **domain** is the business area the software serves: online retail, insurance, logistics. It splits into **subdomains**, and not all of them are equally important.

| Type | What it is | Strategy | Example (online shop) |
| --- | --- | --- | --- |
| ⭐ **Core** | What makes you **different** and wins customers | Build in-house, best people, richest model | Personalised recommendations, dynamic pricing |
| 🧰 **Supporting** | Necessary and specific to you, but not a differentiator | Build simply, or outsource | Returns handling, supplier onboarding |
| 📦 **Generic** | Every business needs it, and it's solved already | **Buy** or use SaaS/open source | Auth, payments, email, accounting |

```mermaid
quadrantChart
    title Where to invest effort
    x-axis Low business differentiation --> High business differentiation
    y-axis Low complexity --> High complexity
    quadrant-1 Core - build with care
    quadrant-2 Generic - buy it
    quadrant-3 Keep it simple
    quadrant-4 Supporting - build simply
    Recommendations: [0.85, 0.85]
    Dynamic pricing: [0.75, 0.7]
    Returns handling: [0.55, 0.35]
    Authentication: [0.15, 0.7]
    Email sending: [0.1, 0.25]
```

> 💡 Spending your best engineers on building your own login system (generic) while the recommendation engine (core) is a mess is a classic strategic mistake.

## 2. Ubiquitous language

A **ubiquitous language** is a shared vocabulary that developers and domain experts use **everywhere**: in conversations, documents, tests and **the code itself**.

```mermaid
flowchart LR
    subgraph Without["❌ Translation everywhere"]
      E1["Expert: 'The policy<br/>lapses after 30 days'"] --> D1["Dev: 'So set<br/>status = 3 when<br/>cron sees ts > 30d'"]
    end
    subgraph With["✅ One language"]
      E2["Expert: 'The policy<br/>lapses after 30 days'"] --> D2["Code:<br/>policy.lapse()<br/>GRACE_PERIOD_DAYS = 30"]
    end
```

```ts
// ❌ Technical language nobody in the business uses
if (rec.st === 3 && Date.now() - rec.ts > 2592000000) rec.st = 7;

// ✅ The business's own words
if (policy.isInGracePeriod(today) === false && policy.hasUnpaidPremium()) {
  policy.lapse();
}
```

**Build a glossary** and keep it next to the code:

| Term | Meaning in the *Insurance* context |
| --- | --- |
| **Policy** | A contract covering a customer against defined risks |
| **Premium** | The amount the customer pays for a period of cover |
| **Grace period** | 30 days after a missed premium during which cover continues |
| **Lapse** | The policy ends because the premium wasn't paid within the grace period |

When the code uses a different word than the business, that's a smell. Rename the code.

## 3. Bounded contexts ⭐

A **bounded context** is an explicit boundary inside which **one model and one language** apply consistently. Outside it, the same word may mean something else, and that's OK.

```mermaid
flowchart LR
    subgraph Sales["💼 Sales context"]
      C1["Customer<br/>= a lead with contact history,<br/>credit limit, sales rep"]
    end
    subgraph Shipping["🚚 Shipping context"]
      C2["Customer<br/>= a delivery address<br/>and opening hours"]
    end
    subgraph Support["🎧 Support context"]
      C3["Customer<br/>= a ticket requester<br/>with an SLA level"]
    end
```

Trying to build **one** `Customer` class that serves all three creates a bloated model that every team fights over. Instead, each context has **its own small model**, sharing only an identity (the customer ID).

**Subdomain vs bounded context:** a subdomain is part of the **business** (problem space); a bounded context is part of the **software** (solution space). Ideally they line up one-to-one, but not always, especially in legacy systems.

**Bounded contexts are the best starting point for module boundaries** in a modular monolith, and for **service boundaries** in microservices. One team should own each context.

## 4. Context mapping: how contexts relate

A **context map** shows the bounded contexts and the **relationships** between them, which are as much about teams and politics as about code.

| Pattern | Relationship | Use when |
| --- | --- | --- |
| **Partnership** | Two teams succeed or fail together; they plan jointly | Tightly linked features, good collaboration |
| **Shared kernel** | A small model shared and co-owned by two contexts | Truly shared concepts; keep it tiny |
| **Customer / Supplier** | Upstream (supplier) plans around downstream (customer) needs | Downstream has influence over the upstream API |
| **Conformist** | Downstream simply adopts the upstream model as it is | Upstream won't change (a big vendor), and its model is acceptable |
| **Anti-Corruption Layer (ACL)** | Downstream **translates** the upstream model into its own | Upstream model is messy or legacy; protect your model |
| **Open Host Service (OHS)** | Upstream offers a well-defined public API for everyone | Many consumers |
| **Published Language** | A documented shared format (schemas, events) | Paired with OHS: e.g. JSON Schemas, Avro events |
| **Separate Ways** | No integration at all; duplicate if needed | Integration costs more than it's worth |

```mermaid
flowchart LR
    Catalog["📚 Catalog<br/>(upstream)"] -->|"OHS + Published Language<br/>(product events)"| Ordering["🛒 Ordering"]
    Ordering -->|Customer / Supplier| Shipping["🚚 Shipping"]
    Legacy["🏚️ Legacy ERP<br/>(upstream)"] -->|"ACL: translate CUST_NO,<br/>ORD_HDR into clean models"| Billing["💰 Billing"]
    Stripe["💳 Stripe<br/>(upstream)"] -->|Conformist| Billing
    Ordering <-->|Partnership| Pricing["🏷️ Pricing"]
```

### Anti-corruption layer in code

```ts
// Legacy ERP gives us this…
type ErpCustomerRecord = { CUST_NO: string; NM1: string; NM2: string; STAT_CD: "A" | "I" | "B" };

// …our Billing context wants this.
type BillingCustomer = { id: string; fullName: string; canBeInvoiced: boolean };

// The ACL is an Adapter that keeps legacy concepts OUT of our model
export class ErpCustomerTranslator {
  toBillingCustomer(record: ErpCustomerRecord): BillingCustomer {
    return {
      id: record.CUST_NO,
      fullName: `${record.NM1} ${record.NM2}`.trim(),
      canBeInvoiced: record.STAT_CD === "A",   // "B" = blocked, "I" = inactive
    };
  }
}
```

## 5. Event storming: discovering the contexts

**Event storming** (Alberto Brandolini) is a workshop: domain experts and developers put **orange sticky notes** on a long wall, one for every **domain event** (something that happened, in the past tense), in time order. Then add commands, actors, policies and hot spots.

| Sticky note | Colour | Example |
| --- | --- | --- |
| Domain event | 🟧 Orange | *Order Placed*, *Payment Failed* |
| Command | 🟦 Blue | *Place Order* |
| Actor | 🟨 Small yellow | *Customer*, *Warehouse clerk* |
| Policy ("whenever… then…") | 🟪 Lilac | *Whenever payment fails, then notify the customer* |
| External system | 🩷 Pink | *Stripe* |
| Hot spot / question | 🟥 Red | *What if stock runs out after payment?* |

```mermaid
flowchart LR
    A1["🟨 Customer"] --> C1["🟦 Place order"] --> E1["🟧 Order placed"]
    E1 --> P1["🟪 Whenever an order is placed,<br/>reserve stock"] --> E2["🟧 Stock reserved"]
    E2 --> C2["🟦 Charge card"] --> X1["🩷 Stripe"] --> E3["🟧 Payment captured"]
    E3 --> E4["🟧 Parcel shipped"]
    classDef ordering fill:#dbeafe,stroke:#3b82f6,color:#1e3a8a
    classDef billing fill:#fef3c7,stroke:#f59e0b,color:#78350f
    classDef ship fill:#dcfce7,stroke:#22c55e,color:#14532d
    class A1,C1,E1 ordering
    class C2,X1,E3 billing
    class P1,E2,E4 ship
```

Where the language changes and events cluster together, you've found the edges of **bounded contexts** (here: Ordering, Billing, Fulfilment).

## Strategic design → architecture

```mermaid
flowchart LR
    ES["🗒️ Event storming"] --> BC["Bounded contexts"] --> MOD["Modules in a modular monolith<br/>or microservices"]
    BC --> TEAM["One team per context"]
    BC --> INSIDE["Inside each: Hexagonal / Clean<br/>+ tactical DDD (next lesson)"]
```

## Key takeaways

- DDD puts the **business domain** at the centre, built together with domain experts.
- Classify subdomains: invest in the **core**, keep **supporting** simple, **buy generic**.
- Speak a **ubiquitous language**, in conversation and in code.
- A **bounded context** is a boundary with one consistent model; the same word can mean different things in different contexts.
- **Context maps** describe how contexts integrate: ACL, OHS, customer/supplier, conformist, shared kernel…
- **Event storming** is a fast, visual way to discover the boundaries.
