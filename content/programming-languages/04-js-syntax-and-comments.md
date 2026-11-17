---
title: JS Syntax & Comments
summary: "Learn the basic grammar of JavaScript: statements, semicolons, code blocks, naming rules, keywords, values, and how to write comments."
level: Beginner
tags: [javascript, js-tutorial, syntax, comments]
---

## What is syntax?

**Syntax** is the set of rules for how code must be written. It is like grammar for a language.

If you break a syntax rule, JavaScript cannot understand your code and shows a **SyntaxError**.

```js
console.log("Hello";
// SyntaxError: missing ) after argument list
```

## Statements

A **statement** is one instruction for the computer. A program is a list of statements, run one after another, from top to bottom.

```js
let price = 10;          // statement 1
let quantity = 3;        // statement 2
let total = price * quantity; // statement 3
console.log(total);      // statement 4
// → 30
```

## Semicolons

A semicolon `;` marks the end of a statement.

```js
let a = 5;
let b = 6;
console.log(a + b); // → 11
```

JavaScript can often add missing semicolons for you. This is called **Automatic Semicolon Insertion**, but it sometimes guesses wrong.

> 💡 Tip: End each statement with a semicolon. It keeps your code clear and avoids rare surprises.

## Whitespace and line breaks

JavaScript ignores extra spaces. These two lines do the same thing:

```js
let name="Ana";
let name2 = "Ana";
```

Spaces around operators (`=`, `+`, `*`) make code easier to read. Long statements can also be split across lines:

```js
const message =
  "This is a long sentence, so we put it on its own line.";
```

## Code blocks

A **code block** is a group of statements inside curly braces `{ }`. Blocks are used with functions, `if` statements, loops and more.

```js
function greet() {
  console.log("Hello!");
  console.log("Nice to meet you.");
}

greet();
// → Hello!
// → Nice to meet you.
```

We **indent** (push to the right) the code inside a block, usually by 2 spaces. Indenting does not change how the code runs, but it shows the structure.

## Case sensitivity

JavaScript is **case-sensitive**. Upper-case and lower-case letters are different.

```js
let color = "red";
let Color = "blue";

console.log(color); // → red
console.log(Color); // → blue
```

`color` and `Color` are two different variables. Also, `console.log` works but `Console.Log` does not.

## Identifiers (names)

An **identifier** is a name you give to something, like a variable or function.

Rules for names:

- They can contain letters, digits, `_` and `$`.
- They **cannot start with a digit**.
- They cannot contain spaces or dashes `-`.
- They cannot be a reserved keyword (like `let` or `if`).

| Name | Valid? | Why |
|---|---|---|
| `userName` | ✅ | Letters only |
| `_count` | ✅ | May start with `_` |
| `$price` | ✅ | May start with `$` |
| `item2` | ✅ | Digits are fine after the first letter |
| `2item` | ❌ | Starts with a digit |
| `user-name` | ❌ | Dash is the minus operator |
| `let` | ❌ | Reserved keyword |

## camelCase

Most JavaScript developers write names in **camelCase**: the first word is lower-case and every next word starts with a capital letter.

```js
let firstName = "Ana";
let totalPrice = 99;
let isLoggedIn = true;
```

Other styles you will see:

| Style | Example | Used for |
|---|---|---|
| camelCase | `userAge` | Variables and functions |
| PascalCase | `UserAccount` | Classes |
| UPPER_SNAKE_CASE | `MAX_SIZE` | Fixed settings (constants) |

> 💡 Tip: Pick names that say what the value is. `userAge` is better than `x`.

## Keywords

**Keywords** are words that JavaScript has reserved for itself. You cannot use them as names.

| Keyword | What it does |
|---|---|
| `let`, `const` | Create a variable |
| `if`, `else` | Run code only when a condition is true |
| `for`, `while` | Repeat code (loops) |
| `function` | Create a function |
| `return` | Send a value out of a function |
| `class` | Create a class |
| `true`, `false`, `null` | Special values |

## Values: literals and variables

JavaScript code works with **values**. There are two common ways to write them.

A **literal** is a fixed value written directly in the code:

```js
42          // a number literal
3.14        // a number literal
"Hello"     // a string (text) literal
true        // a boolean literal
```

A **variable** is a named box that holds a value:

```js
let age = 30;      // 30 is a literal stored in the variable age
console.log(age);  // → 30
```

You will learn all about variables in the next lesson.

## Comments

A **comment** is a note in your code. JavaScript ignores comments completely. They are for humans.

### Single-line comments

Start with `//`. Everything after it on that line is ignored.

```js
// Show a welcome message
console.log("Welcome!"); // this part is also a comment
```

### Multi-line comments

Start with `/*` and end with `*/`. Everything in between is ignored.

```js
/*
  This program calculates the total price.
  Written for the JS tutorial.
*/
let total = 5 * 4;
```

> 📝 Note: Good comments explain **why** you did something, not what every line does.

## Using comments to disable code

You can "turn off" a line by putting `//` in front of it. This is handy when testing.

```js
console.log("Line A");
// console.log("Line B");
console.log("Line C");
```

Output:

```
Line A
Line C
```

You can turn off a whole block with `/* ... */`:

```js
/*
console.log("Step 1");
console.log("Step 2");
*/
console.log("Only this runs");
// → Only this runs
```

> 💡 Tip: In most code editors, press `Ctrl + /` (or `Cmd + /` on Mac) to comment or uncomment the selected lines.

## Try it yourself

**Task 1:** Fix the names so this code works.

```js
let 1stPlace = "Ana";
let last-place = "Ben";
```

<details>
<summary>Show solution</summary>

```js
let firstPlace = "Ana";
let lastPlace = "Ben";
```
</details>

**Task 2:** Add a single-line comment above this code that explains it, and a multi-line comment with your name and today's date.

```js
let hoursPerWeek = 7 * 24;
```

<details>
<summary>Show solution</summary>

```js
/*
  Author: Sam
  Date: 2026-11-17
*/

// Number of hours in one week
let hoursPerWeek = 7 * 24;
```
</details>

**Task 3:** Disable the second line so only "A" and "C" print.

```js
console.log("A");
console.log("B");
console.log("C");
```

<details>
<summary>Show solution</summary>

```js
console.log("A");
// console.log("B");
console.log("C");
```
</details>

## Quick check

<details>
<summary>Are <code>score</code> and <code>Score</code> the same variable?</summary>

No. JavaScript is case-sensitive, so they are two different names.
</details>

<details>
<summary>Which of these is a valid name: <code>my-name</code>, <code>myName</code>, <code>9lives</code>?</summary>

Only `myName`. A dash is not allowed, and names cannot start with a digit.
</details>

<details>
<summary>How do you write a comment that spans several lines?</summary>

Start it with `/*` and end it with `*/`.
</details>

## Key takeaways

- A program is a list of statements, usually ending with `;`.
- Code blocks use `{ }` and are indented for readability.
- JavaScript is case-sensitive: `name` and `Name` are different.
- Names can use letters, digits, `_` and `$`, but cannot start with a digit; use camelCase.
- Literals are fixed values; variables are named boxes for values.
- `//` and `/* */` create comments, which are also useful for turning code off.
