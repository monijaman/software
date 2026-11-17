---
title: JS Variables
summary: "Learn how to store values in variables with let and const, why to avoid var, and how block scope keeps variables tidy."
level: Beginner
tags: [javascript, js-tutorial, variables]
---

## What is a variable?

A **variable** is a named container for a value. You give it a name, put a value in it, and use the name later.

```js
let city = "Paris";
console.log(city); // → Paris
```

Think of it as a labeled box: the label is `city`, and the thing inside is `"Paris"`.

## Three ways to declare a variable

To **declare** a variable means to create it. JavaScript has three keywords for this:

| Keyword | Can change value? | Scope | Use it? |
|---|---|---|---|
| `const` | ❌ No | Block | ✅ Yes, by default |
| `let` | ✅ Yes | Block | ✅ Yes, when the value changes |
| `var` | ✅ Yes | Function | ❌ Avoid (old style) |

## Declaring and assigning

To **assign** means to put a value into a variable, using `=`.

You can declare and assign in one step:

```js
let score = 10;
```

Or in two steps:

```js
let score;     // declare
score = 10;    // assign
console.log(score); // → 10
```

> 📝 Note: In JavaScript, `=` means "put this value in". It does **not** mean "is equal to". For comparing, you use `===` (see the Operators lesson).

## `let`: values that change

Use `let` when the value will change later.

```js
let lives = 3;
lives = 2;
lives = lives - 1;
console.log(lives); // → 1
```

Notice: you write `let` only once, when you create the variable. After that, just use the name.

## `const`: values that stay the same

`const` stands for **constant**. Once you give it a value, you cannot assign a new one.

```js
const birthYear = 1998;
console.log(birthYear); // → 1998

birthYear = 2000;
// TypeError: Assignment to constant variable.
```

A `const` must get its value right away:

```js
const pi;
// SyntaxError: Missing initializer in const declaration
```

## `const` with objects and arrays

`const` stops you from **re-assigning** the variable. But if the value is an object or array, you can still change what is **inside** it.

```js
const user = { name: "Ana", age: 25 };
user.age = 26;           // ✅ changing a property is fine
console.log(user.age);   // → 26

const colors = ["red", "green"];
colors.push("blue");     // ✅ adding an item is fine
console.log(colors);     // → ["red", "green", "blue"]

colors = ["pink"];
// TypeError: Assignment to constant variable.
```

> 💡 Tip: Think of `const` as "this label always points to the same box". The box's contents can still change.

## `undefined`: the default value

If you declare a variable with `let` but do not assign anything, its value is `undefined`.

```js
let answer;
console.log(answer); // → undefined
```

`undefined` means "no value has been given yet".

## Declaring many variables

You can declare several variables in one statement, separated by commas:

```js
let x = 1, y = 2, z = 3;
console.log(x + y + z); // → 6
```

Most people find one variable per line easier to read:

```js
let x = 1;
let y = 2;
let z = 3;
```

## Naming variables

Variable names follow the rules from the Syntax lesson:

- Use letters, digits, `_` and `$`.
- Do not start with a digit.
- Do not use keywords like `let` or `class`.
- Use camelCase: `totalPrice`, `isOpen`, `userList`.

| Bad name | Better name | Why |
|---|---|---|
| `x` | `price` | Says what it holds |
| `d` | `daysLeft` | Clear meaning |
| `flag` | `isLoggedIn` | Booleans read well with `is` / `has` |
| `data2` | `filteredUsers` | Describes the content |

## Re-declaring rules

With `let` and `const`, you cannot declare the same name twice in the same block.

```js
let pet = "cat";
let pet = "dog";
// SyntaxError: Identifier 'pet' has already been declared
```

To change it, just assign: `pet = "dog";`

The old `var` allows re-declaring, which can hide bugs:

```js
var pet = "cat";
var pet = "dog"; // no error, the first value is silently lost
console.log(pet); // → dog
```

## Block scope (a first look)

**Scope** means "where in the code a variable can be used". Variables made with `let` and `const` live only inside the block `{ }` where they are declared.

```js
let message = "outside";

if (true) {
  let message = "inside";
  console.log(message); // → inside
}

console.log(message); // → outside
```

A variable declared inside a block cannot be used outside it:

```js
if (true) {
  const secret = 42;
}
console.log(secret);
// ReferenceError: secret is not defined
```

`var` ignores blocks, which is another reason to avoid it:

```js
if (true) {
  var leaky = "I escaped!";
}
console.log(leaky); // → I escaped!
```

> 📝 Note: You will learn more about scope in the Scope, Hoisting & Closures lesson.

## When to use which?

1. Start with `const` for every variable.
2. If you later need to re-assign it, change it to `let`.
3. Do not use `var` in new code.

```js
const taxRate = 0.2;   // never changes
let cartTotal = 0;     // changes as items are added
cartTotal = cartTotal + 50;
console.log(cartTotal * taxRate); // → 10
```

## Try it yourself

**Task 1:** Create a variable `myName` holding your name and a variable `myAge` holding your age. Print both.

<details>
<summary>Show solution</summary>

```js
const myName = "Sam";
const myAge = 28;
console.log(myName, myAge);
// → Sam 28
```
</details>

**Task 2:** Make a `steps` counter that starts at 0. Add 100, then add 250, then print it.

<details>
<summary>Show solution</summary>

```js
let steps = 0;
steps = steps + 100;
steps = steps + 250;
console.log(steps); // → 350
```
</details>

**Task 3:** This code throws an error. Fix it without removing the `book` object.

```js
const book = { title: "JS Basics", pages: 120 };
book = { title: "JS Basics", pages: 150 };
```

<details>
<summary>Show solution</summary>

```js
const book = { title: "JS Basics", pages: 120 };
book.pages = 150; // change the property, not the variable
console.log(book.pages); // → 150
```
</details>

## Quick check

<details>
<summary>What is the value of a variable declared with <code>let</code> but never assigned?</summary>

`undefined`.
</details>

<details>
<summary>Can you add an item to an array stored in a <code>const</code>?</summary>

Yes. `const` only stops re-assigning the variable. The array's contents can still change.
</details>

<details>
<summary>Which keyword should you reach for first?</summary>

`const`. Switch to `let` only if the value must be re-assigned.
</details>

## Key takeaways

- A variable is a named container for a value.
- Use `const` by default and `let` when the value changes; avoid `var`.
- `=` assigns a value; it does not compare.
- A `let` variable with no value is `undefined`.
- `const` objects and arrays can still have their contents changed.
- `let` and `const` are block-scoped and cannot be re-declared in the same block.
