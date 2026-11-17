---
title: JS Best Practices & Common Mistakes
summary: "Habits that make JavaScript clean and safe, plus the ten mistakes beginners make most often, each shown with a fix."
level: Beginner
tags: [javascript, js-tutorial, best-practices, debugging]
---

## Why best practices?

Code is read far more often than it is written. Good habits make your code easier to read, easier to fix, and less likely to break.

This lesson has two parts: **good habits**, then **common mistakes** with fixes.

## Use clear names

A good name says what something **is** or **does**. You should not need a comment to explain it.

```js
// ❌ Unclear
const d = 7;
function calc(x) { return x * 1.2; }

// ✅ Clear
const daysPerWeek = 7;
function addTax(price) { return price * 1.2; }
```

| Kind | Style | Example |
| --- | --- | --- |
| Variables, functions | camelCase | `userName`, `getTotal()` |
| Classes | PascalCase | `ShoppingCart` |
| Fixed constants | UPPER_SNAKE_CASE | `MAX_ITEMS` |
| Booleans | start with is/has/can | `isLoggedIn`, `hasItems` |

## Use const by default

Use `const` unless the value must change; then use `let`. Never use `var`.

```js
const name = "Sara";   // never reassigned
let score = 0;         // will change
score += 10;
```

> 💡 Tip: When you see `let`, you know "this changes later". That makes code easier to follow.

## Always use ===

`===` compares value **and** type. `==` converts types first and gives surprises.

```js
console.log(0 == "");   // → true  😬
console.log(0 === "");  // → false ✅
```

## Avoid global variables

Globals can be changed by any code anywhere, which causes hard-to-find bugs. Keep variables inside functions, blocks or modules.

```js
// ❌ Global that anything can change
count = 0;

// ✅ Private to a module or function
function createCounter() {
  let count = 0;
  return () => ++count;
}
```

## Keep functions small, use early returns

A function should do **one** job. Return early for special cases instead of nesting `if` inside `if`.

```js
// ❌ Deep nesting
function getDiscount(user) {
  if (user) {
    if (user.isMember) {
      return 0.1;
    } else {
      return 0;
    }
  } else {
    return 0;
  }
}

// ✅ Early returns
function getDiscount(user) {
  if (!user) return 0;
  if (!user.isMember) return 0;
  return 0.1;
}
```

## Avoid mutation where you can

**Mutation** means changing an existing object or array. Creating a new one instead is often safer, because other code holding the old one is not surprised.

```js
const cart = ["apple"];

// ❌ Changes the original
cart.push("bread");

// ✅ Creates a new array
const newCart = [...cart, "bread"];

const user = { name: "Sara", age: 30 };
const older = { ...user, age: 31 }; // user is unchanged
```

## Handle errors, don't trust input

Expect things to fail: network requests, `JSON.parse`, user input. Catch errors and give a helpful message.

```js
function parseSettings(text) {
  try {
    return JSON.parse(text);
  } catch {
    console.warn("Bad settings, using defaults");
    return {};
  }
}
```

Never trust data from users or other sites. Check it, and never put it into the page with `innerHTML`.

```js
// ❌ A user could inject a <script> or <img onerror=...>
output.innerHTML = userComment;

// ✅ Shown as plain text
output.textContent = userComment;
```

## Use modules and strict mode

**Strict mode** turns silent mistakes into errors (like assigning to an undeclared variable). Modules are strict automatically.

```js
"use strict"; // at the top of a classic script

total = 5; // ❌ ReferenceError in strict mode (good: you forgot let/const)
```

## Let tools help: Prettier and ESLint

- **Prettier** formats your code automatically (spacing, quotes, line breaks), so you never argue about style.
- **ESLint** finds likely bugs, like unused variables or `==` instead of `===`.

```bash
npm install --save-dev prettier eslint
npx prettier --write .
npx eslint .
```

> 💡 Tip: Turn on "format on save" in your editor. Then your code is always tidy.

## Common mistakes

Each mistake shows ❌ the problem, then ✅ the fix.

### 1. Using = instead of ===

```js
// ❌ This ASSIGNS 5, so the condition is always true
let x = 1;
if (x = 5) console.log("x is 5"); // prints, and x is now 5!

// ✅ Compare with ===
if (x === 5) console.log("x is 5");
```

### 2. + with strings

```js
// ❌ Input values are strings, + joins them
const a = "5";
console.log(a + 3); // → "53"

// ✅ Convert first
console.log(Number(a) + 3); // → 8
```

### 3. Floating point surprises

```js
// ❌
console.log(0.1 + 0.2);          // → 0.30000000000000004
console.log(0.1 + 0.2 === 0.3);  // → false

// ✅ Work in whole cents, or round for display
console.log(10 + 20);                  // cents → 30
console.log((0.1 + 0.2).toFixed(2));   // → "0.30"
```

### 4. Sorting numbers

```js
// ❌ sort() compares as text by default
console.log([10, 1, 5, 100].sort()); // → [1, 10, 100, 5]

// ✅ Give a compare function
console.log([10, 1, 5, 100].sort((a, b) => a - b)); // → [1, 5, 10, 100]
```

### 5. Forgetting return in an arrow function with braces

```js
// ❌ Braces make a block, so nothing is returned
const double = (n) => { n * 2 };
console.log(double(4)); // → undefined

// ✅ Add return, or drop the braces
const double2 = (n) => n * 2;
console.log(double2(4)); // → 8
```

### 6. Losing this in a callback

```js
const counter = {
  count: 0,
  increase() {
    this.count++;
    console.log(this.count);
  },
};

// ❌ Passing the method alone loses "this" (it becomes the button)
button.addEventListener("click", counter.increase); // → NaN

// ✅ Wrap it in an arrow function
button.addEventListener("click", () => counter.increase()); // → 1, 2, 3...
```

### 7. async inside forEach

```js
// ❌ forEach does not wait for async functions
ids.forEach(async (id) => {
  await saveItem(id);
});
console.log("All saved!"); // runs BEFORE the saves finish

// ✅ Use for...of (one by one) or Promise.all (in parallel)
for (const id of ids) {
  await saveItem(id);
}
await Promise.all(ids.map((id) => saveItem(id)));
console.log("All saved!");
```

### 8. Thinking const makes objects frozen

```js
const user = { name: "Sara" };

user.name = "Ali";   // ✅ allowed! const only stops reassigning the variable
// user = {};        // ❌ TypeError: Assignment to constant variable

// ✅ If you really need it fixed, freeze it
const settings = Object.freeze({ theme: "dark" });
settings.theme = "light"; // ignored (error in strict mode)
console.log(settings.theme); // → "dark"
```

### 9. Comparing objects and arrays

```js
// ❌ Compares references (are they the SAME object?), not contents
console.log([1, 2] === [1, 2]);         // → false
console.log({ a: 1 } === { a: 1 });     // → false

// ✅ Compare the contents
const sameArray = (x, y) =>
  x.length === y.length && x.every((value, i) => value === y[i]);
console.log(sameArray([1, 2], [1, 2])); // → true
```

### 10. Off-by-one in loops

```js
const fruits = ["apple", "banana", "cherry"];

// ❌ <= goes one too far
for (let i = 0; i <= fruits.length; i++) {
  console.log(fruits[i]); // last one prints undefined
}

// ✅ Use <, or better, for...of
for (const fruit of fruits) {
  console.log(fruit);
}
```

## Try it yourself

1. Fix this code so it prints `15`: `const sum = (a, b) => { a + b }; console.log(sum("10", 5));`

<details>
<summary>Show solution</summary>

```js
const sum = (a, b) => Number(a) + Number(b);
console.log(sum("10", 5)); // → 15
```
</details>

2. Rewrite this with an early return: `function greet(name) { if (name) { return "Hi " + name; } else { return "Hi guest"; } }`

<details>
<summary>Show solution</summary>

```js
function greet(name) {
  if (!name) return "Hi guest";
  return `Hi ${name}`;
}
```
</details>

3. Add `"kiwi"` to `const fruits = ["apple"]` without changing the original array.

<details>
<summary>Show solution</summary>

```js
const fruits = ["apple"];
const moreFruits = [...fruits, "kiwi"];
console.log(fruits);     // → ["apple"]
console.log(moreFruits); // → ["apple", "kiwi"]
```
</details>

## Quick check

<details>
<summary>Why does [3, 20, 100].sort() give [100, 20, 3]?</summary>

By default `sort` compares items as text, and "1" comes before "2" before "3". Use `sort((a, b) => a - b)`.
</details>

<details>
<summary>Can you change a property of an object declared with const?</summary>

Yes. `const` only stops you from reassigning the variable. Use `Object.freeze` to stop changes.
</details>

<details>
<summary>Why prefer textContent over innerHTML for user input?</summary>

`innerHTML` would run HTML the user typed, which can inject harmful code. `textContent` shows it as plain text.
</details>

## Key takeaways

- Use clear names, `const` by default, and always `===`.
- Keep functions small, return early, and avoid globals.
- Prefer creating new objects/arrays over mutating old ones.
- Handle errors and never trust input; use `textContent` for user text.
- Let Prettier format and ESLint catch bugs for you.
- Know the classic traps: string `+`, float math, `sort`, `this`, async `forEach`, off-by-one.
