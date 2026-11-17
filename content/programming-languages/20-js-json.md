---
title: JS JSON
summary: "Learn what JSON is, its strict syntax rules, and how to turn JavaScript values into JSON text and back with JSON.stringify and JSON.parse."
level: Beginner
tags: [javascript, js-tutorial, json, data]
---

## What is JSON?

**JSON** stands for **JavaScript Object Notation**. It is a plain **text** format for storing and sending data.

Almost every web API sends data as JSON. It looks a lot like a JavaScript object, but it is just a string of text.

```json
{
  "name": "Ana",
  "age": 28,
  "isAdmin": false,
  "skills": ["js", "css"],
  "address": { "city": "Lisbon" }
}
```

## JSON syntax rules

JSON is stricter than JavaScript. Break one rule and the whole thing fails.

- Property names **must** use **double quotes**: `"name"`.
- Strings must use **double quotes**. Single quotes are not allowed.
- No trailing comma after the last item.
- No comments.
- No functions, `undefined`, `NaN` or dates as real values.

### Allowed value types

| Type | Example |
| --- | --- |
| string | `"hello"` |
| number | `42`, `3.14`, `-1` |
| boolean | `true`, `false` |
| null | `null` |
| array | `[1, 2, 3]` |
| object | `{ "a": 1 }` |

## JSON vs JavaScript object

| | JavaScript object | JSON |
| --- | --- | --- |
| What it is | A live value in memory | A text string |
| Keys | Quotes optional | Double quotes required |
| Strings | `'single'`, `"double"` or `` `backticks` `` | `"double"` only |
| Functions | Allowed | Not allowed |
| `undefined` | Allowed | Not allowed |
| Comments | Allowed in code | Not allowed |
| Trailing commas | Allowed | Not allowed |

## JSON.stringify: object → text

**`JSON.stringify()`** turns a JavaScript value into a JSON string.

```js
const user = { name: "Ana", age: 28, skills: ["js", "css"] };
const text = JSON.stringify(user);

console.log(text);         // → '{"name":"Ana","age":28,"skills":["js","css"]}'
console.log(typeof text);  // → "string"
```

### Pretty printing

The third argument adds **indentation**, which makes the output easy to read.

```js
console.log(JSON.stringify(user, null, 2));
```

Output:

```text
{
  "name": "Ana",
  "age": 28,
  "skills": [
    "js",
    "css"
  ]
}
```

### Choosing properties (replacer)

The second argument is a **replacer**. Pass an array of property names to keep only those.

```js
const account = { name: "Ana", password: "secret123" };
console.log(JSON.stringify(account, ["name"])); // → '{"name":"Ana"}'
```

### What gets dropped

Values JSON cannot hold are skipped (in objects) or turned into `null` (in arrays).

```js
const data = { a: 1, b: undefined, c() {}, d: NaN };
console.log(JSON.stringify(data));         // → '{"a":1,"d":null}'
console.log(JSON.stringify([undefined]));  // → '[null]'
```

## JSON.parse: text → object

**`JSON.parse()`** turns a JSON string back into a real JavaScript value.

```js
const text = '{"name":"Ben","age":31}';
const obj = JSON.parse(text);

console.log(obj.name);      // → "Ben"
console.log(obj.age + 1);   // → 32
```

## Handling parse errors

If the text is not valid JSON, `JSON.parse` throws a `SyntaxError`. Wrap it in **`try...catch`** to handle the problem without crashing.

```js
function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Invalid JSON:", error.message);
    return null;
  }
}

safeParse('{"ok":true}');   // → { ok: true }
safeParse("{name: 'Ana'}"); // logs "Invalid JSON: ..." and returns null
```

> ⚠️ Watch out: Always use `try...catch` when parsing data you don't control, like user input, `localStorage` or responses from other servers.

## Dates in JSON

JSON has no date type. `JSON.stringify` turns a `Date` into an ISO **string**.

```js
const event = { title: "Launch", at: new Date(Date.UTC(2025, 0, 15)) };
const text = JSON.stringify(event);
console.log(text); // → '{"title":"Launch","at":"2025-01-15T00:00:00.000Z"}'
```

When you parse it back, you get a **string**, not a Date. Convert it yourself:

```js
const back = JSON.parse(text);
console.log(typeof back.at);   // → "string"

const date = new Date(back.at);
console.log(date.getUTCFullYear()); // → 2025
```

## Deep copy note

You may see `JSON.parse(JSON.stringify(obj))` used to copy an object. It works for simple data, but it loses dates, `undefined`, functions, `Map` and `Set`.

```js
const original = { list: [1, 2], when: new Date() };
const copy = structuredClone(original); // ✅ modern deep copy

copy.list.push(3);
console.log(original.list); // → [1, 2] (unchanged)
```

> 💡 Tip: Prefer **`structuredClone()`** for deep copies. It is built into modern browsers and Node.js.

## Fetching JSON (preview)

When you load data from a server, you usually get JSON. The `fetch` function can parse it for you with `response.json()`.

```js
async function loadUser() {
  const response = await fetch("https://jsonplaceholder.typicode.com/users/1");
  const user = await response.json(); // parses the JSON for you
  console.log(user.name);
}

loadUser();
```

> 📝 Note: `async`, `await` and `fetch` are explained fully in the Async JavaScript lesson.

## Try it yourself

**1.** Turn `{ city: "Paris", population: 2100000 }` into a JSON string and print it.

<details>
<summary>Show solution</summary>

```js
const city = { city: "Paris", population: 2100000 };
console.log(JSON.stringify(city)); // → '{"city":"Paris","population":2100000}'
```
</details>

**2.** Parse `'["apple","banana","cherry"]'` and print the second item.

<details>
<summary>Show solution</summary>

```js
const fruits = JSON.parse('["apple","banana","cherry"]');
console.log(fruits[1]); // → "banana"
```
</details>

**3.** Save an array of to-dos to `localStorage` and read it back. Use `[]` if nothing was saved.

<details>
<summary>Show solution</summary>

```js
const todos = ["Buy milk", "Learn JSON"];
localStorage.setItem("todos", JSON.stringify(todos));

const saved = JSON.parse(localStorage.getItem("todos") ?? "[]");
console.log(saved.length); // → 2
```
</details>

## Quick check

<details>
<summary>Is <code>{'name': 'Ana'}</code> valid JSON?</summary>

No. JSON needs double quotes for both keys and strings: `{"name": "Ana"}`.
</details>

<details>
<summary>What does <code>JSON.stringify({ a: undefined })</code> return?</summary>

`'{}'`. Properties with `undefined` values are left out.
</details>

<details>
<summary>What type is a date after <code>JSON.parse</code>?</summary>

A string (in ISO format). Use `new Date(value)` to turn it back into a Date.
</details>

## Key takeaways

- JSON is a text format for data; it looks like a JS object but is just a string.
- JSON needs double quotes and allows no comments, functions, `undefined` or trailing commas.
- `JSON.stringify(value, null, 2)` makes JSON text; `JSON.parse(text)` reads it back.
- Wrap `JSON.parse` in `try...catch` when the data may be broken.
- Dates become ISO strings; convert them back with `new Date()`.
- Use `structuredClone()` for deep copies instead of the JSON trick.
