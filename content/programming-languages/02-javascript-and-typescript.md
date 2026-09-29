---
title: JavaScript and TypeScript Foundations
summary: Core language ideas, static types and safe data handling.
level: Beginner
tags: [languages, javascript, typescript]
---

# JavaScript and TypeScript Foundations

JavaScript runs in browsers and on servers through Node.js. Its important ideas are objects, functions, modules, asynchronous promises and the event loop. TypeScript adds static types and checks your program before it runs; it compiles to JavaScript and does not replace runtime validation. Prefer `unknown` over `any` for untrusted values, enable `strict`, and narrow values with checks before using them.

```ts
type User = { id: string; email: string };
function displayEmail(value: unknown): string {
  if (typeof value === "object" && value !== null && "email" in value) {
    return (value as User).email;
  }
  throw new Error("Invalid user");
}
```

Use interfaces/types to describe data, discriminated unions for state, generics for reusable functions and modules to keep code focused. The Theoretical notes include JavaScript concepts and a full TypeScript guide for deeper study.
