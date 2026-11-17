---
title: JS Objects
summary: "Learn how to group related data with objects: creating them, reading and changing properties, adding methods, looping over keys and values, and copying objects safely."
level: Beginner
tags: [javascript, js-tutorial, objects]
---

## What is an object?

An **object** groups related values under names. Each name–value pair is called a **property**. Think of an object as a labelled box, like a contact card.

```js
const user = {
  name: "Sara",
  age: 28,
  isAdmin: false,
};

console.log(user); // → { name: "Sara", age: 28, isAdmin: false }
```

This `{ ... }` syntax is called an **object literal**. The name before `:` is the **key**; the part after is the **value**.

## Reading properties

There are two ways to read a property: **dot notation** and **bracket notation**.

```js
const user = { name: "Sara", age: 28 };

console.log(user.name);    // → "Sara"
console.log(user["age"]);  // → 28
console.log(user.email);   // → undefined (no such property)
```

Use brackets when the key is stored in a variable, or has spaces or dashes:

```js
const field = "name";
console.log(user[field]); // → "Sara"

const settings = { "dark-mode": true };
console.log(settings["dark-mode"]); // → true
```

> 💡 Tip: Use dot notation by default. Reach for brackets only when you need them.

## Adding, changing and deleting

```js
const car = { brand: "Toyota", year: 2018 };

car.color = "red";   // add a new property
car.year = 2020;     // change an existing one
delete car.brand;    // remove a property

console.log(car); // → { year: 2020, color: "red" }
```

> 📝 Note: `const` stops you from replacing the whole object, but you can still change its properties.

## Methods

A property whose value is a function is called a **method**. Inside a method, `this` refers to the object the method was called on.

```js
const counter = {
  count: 0,
  increase() {
    this.count++;
  },
  show() {
    console.log(`Count: ${this.count}`);
  },
};

counter.increase();
counter.increase();
counter.show(); // → Count: 2
```

> ⚠️ Watch out: don't use arrow functions for methods that need `this`. Arrow functions don't get their own `this`. The Classes & this lesson covers this in depth.

## Shorthand properties

When a variable has the same name as the key, you can write it once.

```js
const name = "Ali";
const age = 30;

const person = { name, age }; // same as { name: name, age: age }
console.log(person); // → { name: "Ali", age: 30 }
```

## Computed keys

Put an expression in `[]` to use its value as the key.

```js
const key = "score";
const result = { [key]: 99, [`${key}Max`]: 100 };

console.log(result); // → { score: 99, scoreMax: 100 }
```

## Checking if a property exists

```js
const user = { name: "Sara", nickname: undefined };

console.log("name" in user);               // → true
console.log("email" in user);              // → false
console.log(Object.hasOwn(user, "nickname")); // → true
console.log(user.nickname !== undefined);  // → false (exists, but empty)
```

> 📝 Note: `Object.hasOwn(obj, key)` checks only the object's own properties. `in` also looks at inherited ones (like `toString`). For everyday checks, `Object.hasOwn` is the safer pick.

## Looping over an object

### for...in

`for...in` gives you each key.

```js
const scores = { math: 90, art: 75, music: 82 };

for (const subject in scores) {
  console.log(subject, scores[subject]);
}
// → math 90
// → art 75
// → music 82
```

### Object.keys, values and entries

These turn an object into an array, so you can use array methods like `map` and `forEach`.

| Method | Returns | Example result |
| --- | --- | --- |
| `Object.keys(obj)` | array of keys | `["math", "art", "music"]` |
| `Object.values(obj)` | array of values | `[90, 75, 82]` |
| `Object.entries(obj)` | array of `[key, value]` pairs | `[["math", 90], ["art", 75], …]` |

```js
const total = Object.values(scores).reduce((sum, n) => sum + n, 0);
console.log(total); // → 247

for (const [subject, score] of Object.entries(scores)) {
  console.log(`${subject}: ${score}`);
}
// → math: 90
// → art: 75
// → music: 82
```

## Nested objects

Objects can contain other objects and arrays.

```js
const order = {
  id: 501,
  customer: { name: "Lina", city: "Cairo" },
  items: ["Pen", "Notebook"],
};

console.log(order.customer.city); // → "Cairo"
console.log(order.items[1]);      // → "Notebook"
```

## Objects are references

Like arrays, assigning an object to a new variable does **not** copy it. Both names point to the same object.

```js
const a = { x: 1 };
const b = a;
b.x = 99;
console.log(a.x); // → 99
```

### Copying objects

| Way | Copies nested objects? |
| --- | --- |
| `{ ...obj }` (spread) | ❌ No, only the top level (a **shallow** copy) |
| `structuredClone(obj)` | ✅ Yes, everything (a **deep** copy) |

```js
const original = { name: "Sam", address: { city: "Rome" } };

const shallow = { ...original };
shallow.name = "Max";
shallow.address.city = "Paris";

console.log(original.name);         // → "Sam"   (top level was copied)
console.log(original.address.city); // → "Paris" (nested object is shared!)

const deep = structuredClone(original);
deep.address.city = "Oslo";
console.log(original.address.city); // → "Paris" (unchanged)
```

> 💡 Tip: Spread is also handy for "copy and change": `const updated = { ...user, age: 29 };`

## Object.freeze

`Object.freeze(obj)` locks an object so its properties can't be added, changed or removed.

```js
const config = Object.freeze({ apiUrl: "/api", retries: 3 });

config.retries = 10;      // silently ignored (an error in strict mode)
console.log(config.retries); // → 3
```

> 📝 Note: `freeze` is shallow too. Objects nested inside can still be changed.

## Objects vs arrays: which one?

| Use an **array** when… | Use an **object** when… |
| --- | --- |
| You have a list of similar things | You describe one thing with named parts |
| Order matters | You look things up by name |
| `["Pen", "Book", "Bag"]` | `{ name: "Pen", price: 2 }` |

Often you combine them: an array of objects, like a list of products.

## Try it in a page

```html
<p id="card"></p>

<script>
  const profile = { name: "Nora", job: "Designer", city: "Lisbon" };

  document.getElementById("card").textContent =
    `${profile.name} is a ${profile.job} in ${profile.city}.`;
</script>
```

## Try it yourself

**1.** Create a `book` object with `title`, `author` and `pages`. Then change `pages` to `320` and add `year: 2021`.

<details>
<summary>Show solution</summary>

```js
const book = { title: "JS Basics", author: "Kim", pages: 250 };
book.pages = 320;
book.year = 2021;
console.log(book);
// → { title: "JS Basics", author: "Kim", pages: 320, year: 2021 }
```
</details>

**2.** Add a method `describe()` to `book` that returns `"JS Basics by Kim"`.

<details>
<summary>Show solution</summary>

```js
const book = {
  title: "JS Basics",
  author: "Kim",
  describe() {
    return `${this.title} by ${this.author}`;
  },
};

console.log(book.describe()); // → "JS Basics by Kim"
```
</details>

**3.** Given `const prices = { tea: 3, coffee: 4, cake: 5 }`, print every item as `"tea costs $3"`.

<details>
<summary>Show solution</summary>

```js
const prices = { tea: 3, coffee: 4, cake: 5 };

for (const [item, price] of Object.entries(prices)) {
  console.log(`${item} costs $${price}`);
}
// → tea costs $3
// → coffee costs $4
// → cake costs $5
```
</details>

## Quick check

<details>
<summary>When must you use bracket notation instead of dot notation?</summary>

When the key is in a variable (`obj[key]`) or is not a valid name, like `"dark-mode"` or `"first name"`.
</details>

<details>
<summary>Does <code>{ ...obj }</code> copy nested objects?</summary>

No. It makes a shallow copy, so nested objects are still shared. Use `structuredClone` for a deep copy.
</details>

<details>
<summary>What does <code>Object.keys({ a: 1, b: 2 })</code> return?</summary>

`["a", "b"]`.
</details>

## Key takeaways

- Objects store named values (properties) as `key: value` pairs.
- Read with `obj.key` or `obj["key"]`; add, change and `delete` properties freely.
- Methods are functions inside objects; `this` refers to the object.
- Loop with `for...in` or `Object.keys/values/entries`.
- Objects are references: spread makes a shallow copy, `structuredClone` a deep one.
- Use arrays for ordered lists and objects for describing one thing.
