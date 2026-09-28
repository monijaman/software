---
title: Which Pattern Do I Need?
summary: A problem-first guide for picking the right design pattern, telling look-alike patterns apart, and spotting when you don't need a pattern at all.
level: Intermediate
tags: [design-patterns, cheat-sheet, decision-guide]
---

## Start from the pain, not the pattern

Find your problem in the left column, then follow the arrow.

```mermaid
flowchart LR
    P1["Creating objects is messy<br/>or depends on conditions"] --> F[Factory]
    P2["Constructor has too<br/>many parameters"] --> B[Builder]
    P3["Need matching families<br/>(themes, providers)"] --> AF[Abstract Factory]
    P4["3rd-party API doesn't<br/>fit my interface"] --> AD[Adapter]
    P5["Add features without<br/>editing a class"] --> DE[Decorator]
    P6["Complex subsystem,<br/>want a simple entry point"] --> FA[Facade]
    P7["Control access, cache,<br/>lazy-load"] --> PR[Proxy]
    P8["Tree of items and groups"] --> CO[Composite]
    P9["Many things react<br/>to one change"] --> OB[Observer]
    P10["Swap algorithms<br/>at runtime"] --> ST[Strategy]
    P11["Undo / queue / log actions"] --> CM[Command]
    P12["Behaviour depends on status"] --> SA[State]
    P13["Pipeline of checks,<br/>any can stop it"] --> CH[Chain of Responsibility]
```

## Look-alike patterns

Several patterns have the **same code shape** but different **intent**. The intent is what matters.

| These look alike… | The difference |
| --- | --- |
| **Decorator** vs **Proxy** | Decorator *adds* behaviour. Proxy *controls access* to the same behaviour. |
| **Adapter** vs **Facade** | Adapter makes *one* interface fit another. Facade simplifies *many* interfaces into one. |
| **Strategy** vs **State** | In Strategy the *caller* chooses. In State the object *changes itself*. |
| **Factory** vs **Builder** | Factory creates in *one call* and decides the type. Builder creates *step by step*. |
| **Observer** vs **Mediator** | Observer broadcasts one-to-many. Mediator coordinates many-to-many through a hub. |
| **Command** vs **Memento** (undo) | Command stores *operations* to reverse. Memento stores *snapshots* to restore. |
| **Composite** vs **Decorator** | Both wrap objects. Composite *groups many children*; Decorator wraps *exactly one*. |

```mermaid
flowchart TB
    subgraph Same["Same shape: an object wrapping another"]
      W[Wrapper] --> O[Original]
    end
    Same --> D["Decorator:<br/>'I add logging'"]
    Same --> P["Proxy:<br/>'I decide if you may enter'"]
    Same --> A["Adapter:<br/>'I translate the interface'"]
```

## The top 8 to learn first

If you only have time for a few, learn these. They cover most real-world code:

1. 🏭 **Factory** — creating the right object from config or input
2. 🔌 **Adapter** — wrapping 3rd-party libraries
3. ☕ **Decorator** — middleware, HOCs, retry/cache/log wrappers
4. 🏨 **Facade** — service layers and SDKs
5. 📰 **Observer** — events everywhere, UI and backend
6. 🗺️ **Strategy** — pluggable algorithms (payments, pricing, auth)
7. 🚦 **State** — order and payment workflows
8. 📞 **Chain of Responsibility** — request pipelines

## Anti-patterns: when patterns go wrong

| Anti-pattern | What it looks like | Better |
| --- | --- | --- |
| **Patternitis** | `AbstractSingletonProxyFactoryBean` for a one-off task | Plain function first |
| **Singleton abuse** | Global state everywhere, flaky tests | Dependency injection |
| **God object** | One class that knows and does everything | Split by responsibility (SRP) |
| **Premature abstraction** | Interfaces with a single implementation "for flexibility" | Wait for the second use case |
| **Golden hammer** | "We use Observer for everything" | Pick per problem |

> 💡 **The best pattern is often no pattern.** A clear function with a good name beats a textbook pattern applied to a problem you don't have.

## Patterns at system scale

The same ideas reappear when you design whole systems, which you'll meet later in the Microservices and Kafka lessons:

| Object-level pattern | System-level cousin |
| --- | --- |
| Observer | Pub/Sub, Kafka topics, event-driven architecture |
| Facade | API Gateway, Backend for Frontend |
| Proxy | Reverse proxy, CDN, service mesh sidecar |
| Adapter | Anti-corruption layer |
| Command | Message queues, CQRS commands |
| Mediator | Saga orchestrator |
| Chain of Responsibility | Middleware pipelines, API gateway filters |
| Memento | Event sourcing snapshots |

## Key takeaways

- Start from the problem you have, then pick the pattern.
- Look-alike patterns differ in **intent**, not code shape.
- Learn the top 8 first; they cover most real code.
- Avoid patternitis: add a pattern when simple code starts to hurt.
- Object patterns scale up into system architecture patterns.
