---
title: "DRY: Don't Repeat Yourself"
summary: Every piece of knowledge should live in one place. Learn when to remove duplication, and when duplication is actually fine.
level: Beginner
tags: [clean-code, dry, principles, duplication]
---

## The big idea

Imagine your phone number is written on 12 sticky notes around the house. You change your number. How many notes will you forget to update?

![DRY: one source of truth instead of many copies that drift apart](/img/clean-code/dry.svg)

**DRY = Don't Repeat Yourself.** From *The Pragmatic Programmer*:

> 📘 *"Every piece of knowledge must have a single, unambiguous, authoritative representation within a system."*

Note the word **knowledge**. DRY is about *rules and facts*, not about lines of text that happen to look the same.

## The copy-paste bug

```mermaid
sequenceDiagram
    participant Dev
    participant A as signup.js
    participant B as profile.js
    participant C as admin.js
    Note over A,C: Email check copy-pasted into 3 files
    Dev->>A: Fix: allow "+" in emails
    Dev->>B: Fix: allow "+" in emails
    Note over C: ❌ Forgotten!
    C-->>Dev: Admin panel rejects valid emails 🐛
```

```js
// ❌ The same rule in three places
// signup.js
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Invalid email");
// profile.js
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Invalid email");
// admin.js
if (!/^[^@\s]+@[^@\s]+$/.test(email)) throw new Error("Bad email"); // already drifted!
```

```js
// ✅ One source of truth
// validation/email.js
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const isValidEmail = (email) => EMAIL_PATTERN.test(email);

// everywhere else
import { isValidEmail } from "./validation/email.js";
if (!isValidEmail(email)) throw new ValidationError("Invalid email");
```

## DRY is more than functions

| Duplicated knowledge | DRY fix |
| --- | --- |
| Magic numbers (`0.2` tax everywhere) | A named constant: `TAX_RATE` |
| The same validation in frontend and backend | A shared schema (for example, Zod) used by both |
| API types written by hand in the client | Generate types from OpenAPI / GraphQL schema |
| Config values copied between files | One `.env` / config module |
| The same SQL in many places | A repository function |
| Repeated UI markup | A reusable component |

```mermaid
flowchart LR
    S["📜 One Zod schema<br/>userSchema"] --> F[Frontend form validation]
    S --> B[Backend request validation]
    S --> T[TypeScript types]
```

```ts
// schemas/user.ts — used by the React form AND the API route
import { z } from "zod";

export const userSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(18),
});
export type User = z.infer<typeof userSchema>;
```

## ⚠️ The trap: wrong abstraction

Two pieces of code can **look** the same today but represent **different knowledge**. Merging them couples things that should change independently.

```js
// These look identical…
const validateProductName = (name) => name.length > 0 && name.length <= 50;
const validateUsername = (name) => name.length > 0 && name.length <= 50;
```

Should you merge them into `validateName()`? **No.** Product names and usernames are different business rules. Next month usernames will need "no spaces" and product names will allow 100 characters. If merged, you will add flags:

```js
// ❌ The wrong abstraction grows ugly
function validateName(name, isUser, allowLong, allowSpaces) { /* … */ }
```

> 💡 **"Duplication is far cheaper than the wrong abstraction."** (Sandi Metz)

## The Rule of Three

A practical guide for when to extract shared code:

```mermaid
flowchart LR
    One["1st time<br/>just write it"] --> Two["2nd time<br/>wince, but duplicate"]
    Two --> Three["3rd time<br/>✅ now extract it"]
```

By the third time you can see what is truly common and what varies.

## DRY vs WET

- **DRY:** Don't Repeat Yourself.
- **WET:** "Write Everything Twice" or "We Enjoy Typing". Copy-paste culture.
- **AHA:** "Avoid Hasty Abstractions". The balanced middle ground: prefer duplication until the right abstraction is obvious.

## Key takeaways

- DRY is about **knowledge**, not identical-looking text.
- Business rules, constants, schemas and config should each live in one place.
- Don't merge code that only *looks* alike but changes for different reasons.
- Use the Rule of Three before extracting.

## Try it yourself

Search your project for a number like `0.2`, `100`, or `86400`. Is it repeated? Give it a name and a single home.
