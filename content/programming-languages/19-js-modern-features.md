---
title: Modern JavaScript (ES6+)
summary: "Learn the modern JavaScript shortcuts you will see everywhere: destructuring, spread and rest, optional chaining, nullish coalescing, logical assignment, Map and Set."
level: Intermediate
tags: [javascript, js-tutorial, es6, destructuring, map-set]
---

## What is "modern JavaScript"?

JavaScript gets new features every year. The big update in 2015 is called **ES6** (or ES2015). "ES" stands for **ECMAScript**, the official name of the JavaScript standard.

This lesson shows the modern features you will meet in almost every codebase.

## Array destructuring

**Destructuring** means unpacking values from an array or object into separate variables in one line.

```js
const colors = ["red", "green", "blue"];
const [first, second] = colors;
console.log(first, second); // → "red" "green"
```

Skip items with an empty spot, and collect the rest with `...`:

```js
const [, , third] = colors;
console.log(third); // → "blue"

const [head, ...others] = colors;
console.log(others); // → ["green", "blue"]
```

> 💡 Tip: Swap two variables without a temporary one: `[a, b] = [b, a];`

## Object destructuring

With objects, you pick values by **property name**, not by position.

```js
const user = { name: "Ana", age: 28, city: "Lisbon" };
const { name, age } = user;
console.log(name, age); // → "Ana" 28
```

### Renaming and defaults

```js
const { name: userName, country = "Unknown" } = user;
console.log(userName); // → "Ana"
console.log(country);  // → "Unknown" (default, because user has no country)
```

### Destructuring in parameters

This is very common for functions that take an "options" object.

```js
function greet({ name, greeting = "Hello" }) {
  return `${greeting}, ${name}!`;
}

console.log(greet({ name: "Sam" }));                 // → "Hello, Sam!"
console.log(greet({ name: "Sam", greeting: "Hi" })); // → "Hi, Sam!"
```

## Spread: ...

The **spread** syntax `...` spreads out the items of an array or the properties of an object.

```js
const a = [1, 2];
const b = [3, 4];
const all = [...a, ...b, 5];
console.log(all); // → [1, 2, 3, 4, 5]

console.log(Math.max(...all)); // → 5
```

With objects, later properties win:

```js
const defaults = { theme: "light", size: "md" };
const settings = { ...defaults, theme: "dark" };
console.log(settings); // → { theme: "dark", size: "md" }
```

> ⚠️ Watch out: Spread makes a **shallow** copy. Nested objects inside are still shared with the original.

## Rest: ...

The same `...` used in **parameters** does the opposite: it **collects** many values into one array. This is called **rest**.

```js
function sum(...numbers) {
  return numbers.reduce((total, n) => total + n, 0);
}

console.log(sum(1, 2, 3));     // → 6
console.log(sum(5, 10, 15, 20)); // → 50
```

> 📝 Note: Easy rule: `...` on the **right** of `=` or in a call **spreads**. `...` on the **left** of `=` or in parameters **collects** (rest).

## Optional chaining: ?.

Reading a property of `undefined` or `null` throws an error. **Optional chaining** `?.` stops and returns `undefined` instead.

```js
const order = { customer: { name: "Lee" } };

console.log(order.customer?.name);       // → "Lee"
console.log(order.shipping?.address);    // → undefined (no error)
console.log(order.customer.getId?.());   // → undefined (method doesn't exist)
console.log(order.items?.[0]);           // → undefined
```

## Nullish coalescing: ??

**`??`** gives a fallback value only when the left side is `null` or `undefined`.

```js
const count = 0;
console.log(count ?? 10); // → 0
console.log(count || 10); // → 10 (|| treats 0 as "empty")

const nickname = null;
console.log(nickname ?? "Guest"); // → "Guest"
```

> 💡 Tip: Use `??` when `0`, `""` or `false` are valid values that you want to keep.

## Logical assignment

These operators assign a value only in certain cases.

| Operator | Meaning | Same as |
| --- | --- | --- |
| `a ??= b` | Set `a` if it is `null`/`undefined` | `a ?? (a = b)` |
| `a \|\|= b` | Set `a` if it is falsy | `a \|\| (a = b)` |
| `a &&= b` | Set `a` if it is truthy | `a && (a = b)` |

```js
const config = { retries: 0 };
config.retries ??= 3;  // stays 0
config.timeout ??= 5000;
console.log(config); // → { retries: 0, timeout: 5000 }
```

## Short property and method syntax

If a variable has the same name as the property, write it once.

```js
const name = "Mo";
const age = 30;

const person = {
  name,          // same as name: name
  age,
  sayHi() {      // same as sayHi: function () { ... }
    return `Hi, I'm ${this.name}`;
  },
};

console.log(person.sayHi()); // → "Hi, I'm Mo"
```

## Template literals recap

Backticks let you put values inside strings with `${ }`, and write multiline strings.

```js
const item = "coffee";
const price = 3.5;
console.log(`One ${item} costs $${price.toFixed(2)}`);
// → "One coffee costs $3.50"
```

## Map

A **Map** stores key–value pairs, like an object, but keys can be **any type** (even objects), and it remembers insertion order.

```js
const scores = new Map();
scores.set("Ana", 90);
scores.set("Ben", 75);

console.log(scores.get("Ana")); // → 90
console.log(scores.size);       // → 2

for (const [player, score] of scores) {
  console.log(`${player}: ${score}`);
}
// → "Ana: 90"
// → "Ben: 75"
```

| Method / property | What it does | Example |
| --- | --- | --- |
| `set(key, value)` | Adds or updates an entry | `m.set("a", 1)` |
| `get(key)` | Reads a value | `m.get("a")` → `1` |
| `has(key)` | Checks if a key exists | `m.has("a")` → `true` |
| `delete(key)` | Removes an entry | `m.delete("a")` |
| `clear()` | Removes everything | `m.clear()` |
| `size` | Number of entries | `m.size` |

## Set

A **Set** stores a list of **unique** values. Adding a duplicate does nothing.

```js
const tags = new Set(["js", "css", "js"]);
console.log(tags.size);       // → 2
console.log(tags.has("css")); // → true

const unique = [...new Set([1, 2, 2, 3, 3, 3])];
console.log(unique); // → [1, 2, 3]
```

| Method / property | What it does | Example |
| --- | --- | --- |
| `add(value)` | Adds a value | `s.add("html")` |
| `has(value)` | Checks if it exists | `s.has("js")` → `true` |
| `delete(value)` | Removes a value | `s.delete("js")` |
| `clear()` | Removes everything | `s.clear()` |
| `size` | Number of values | `s.size` |

## What came in which version?

| Version | Features from this lesson (and nearby) |
| --- | --- |
| ES2015 (ES6) | `let`/`const`, arrow functions, classes, template literals, destructuring, spread/rest for arrays, Map, Set, modules, promises |
| ES2017 | `async`/`await` |
| ES2018 | Spread and rest for objects |
| ES2020 | Optional chaining `?.`, nullish coalescing `??` |
| ES2021 | Logical assignment `??=`, `\|\|=`, `&&=` |
| ES2022 | Private class fields `#`, `array.at()` |

> 📝 Note: All of these work in every modern browser today.

## Try it yourself

**1.** From `const point = { x: 3, y: 7 };`, destructure `x` and `y` and print their sum.

<details>
<summary>Show solution</summary>

```js
const point = { x: 3, y: 7 };
const { x, y } = point;
console.log(x + y); // → 10
```
</details>

**2.** Merge `{ a: 1, b: 2 }` and `{ b: 3, c: 4 }` into one new object.

<details>
<summary>Show solution</summary>

```js
const merged = { ...{ a: 1, b: 2 }, ...{ b: 3, c: 4 } };
console.log(merged); // → { a: 1, b: 3, c: 4 }
```
</details>

**3.** Count how many times each word appears in `["a", "b", "a", "c", "a"]` using a `Map`.

<details>
<summary>Show solution</summary>

```js
const words = ["a", "b", "a", "c", "a"];
const counts = new Map();
for (const w of words) {
  counts.set(w, (counts.get(w) ?? 0) + 1);
}
console.log(counts.get("a")); // → 3
console.log(counts.get("b")); // → 1
```
</details>

**4.** Safely read `data.user.profile.email`, printing `"no email"` if anything along the way is missing.

<details>
<summary>Show solution</summary>

```js
const data = { user: {} };
console.log(data.user?.profile?.email ?? "no email"); // → "no email"
```
</details>

## Quick check

<details>
<summary>What is the difference between <code>0 || 5</code> and <code>0 ?? 5</code>?</summary>

`0 || 5` is `5` because `0` is falsy. `0 ?? 5` is `0` because `0` is not `null` or `undefined`.
</details>

<details>
<summary>Is <code>...</code> in <code>function f(...args)</code> spread or rest?</summary>

Rest. In parameters, `...` collects the arguments into an array.
</details>

<details>
<summary>When should you choose a Set over an array?</summary>

When you need unique values only, or need fast "is this value in here?" checks with `has()`.
</details>

## Key takeaways

- Destructuring unpacks arrays (by position) and objects (by name), with defaults and renaming.
- `...` spreads values out, or collects them as rest parameters.
- `?.` safely reads nested data; `??` gives a fallback only for `null`/`undefined`.
- `??=`, `||=` and `&&=` assign only when needed.
- `Map` holds key–value pairs with any key type; `Set` holds unique values.
- Short property syntax and template literals make objects and strings cleaner.
