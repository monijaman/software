---
title: JS Strings
summary: "Learn how to create and work with text in JavaScript: quotes, escape characters, template literals, and the most useful string methods."
level: Beginner
tags: [javascript, js-tutorial, strings, template-literals]
---

## What is a string?

A **string** is a piece of text. You write it inside quotes.

```js
const greeting = "Hello, world!";
console.log(greeting); // → Hello, world!
```

## Single, double or backtick quotes

You can use three kinds of quotes:

```js
const a = "double quotes";
const b = 'single quotes';
const c = `backticks`;
```

Single and double quotes work the same. Backticks are special; they make **template literals** (see below).

You can use one kind of quote inside another:

```js
const say = "It's sunny";
const quote = 'She said "hi"';
console.log(say);   // → It's sunny
console.log(quote); // → She said "hi"
```

> 💡 Tip: Pick one style (single or double) and use it everywhere in a project.

## Escape characters

An **escape character** is a backslash `\` followed by a letter. It lets you put special characters inside a string.

| Code | Result |
|---|---|
| `\'` | Single quote |
| `\"` | Double quote |
| `\\` | Backslash |
| `\n` | New line |
| `\t` | Tab |

```js
console.log('It\'s fine');      // → It's fine
console.log("Line 1\nLine 2");
// → Line 1
// → Line 2
console.log("C:\\Users\\Ana");  // → C:\Users\Ana
```

## String length

The `length` property tells you how many characters a string has.

```js
const word = "JavaScript";
console.log(word.length); // → 10
console.log("".length);   // → 0
```

> 📝 Note: `length` is a **property**, not a method, so there are no parentheses: `word.length`, not `word.length()`.

## Accessing characters

Each character has a position number called an **index**. Counting starts at `0`.

```js
const word = "Hello";
console.log(word[0]);               // → H
console.log(word[4]);               // → o
console.log(word[word.length - 1]); // → o (last character)
console.log(word[10]);              // → undefined
```

## Template literals

A **template literal** is a string written with backticks. Inside it, you can insert values with `${ }`.

```js
const name = "Ana";
const age = 25;

console.log(`My name is ${name} and I am ${age}.`);
// → My name is Ana and I am 25.
```

You can put any expression inside `${ }`, even math:

```js
const price = 8;
const qty = 3;
console.log(`Total: $${price * qty}`); // → Total: $24
```

Template literals can also span several lines:

```js
const poem = `Roses are red,
Violets are blue.`;
console.log(poem);
// → Roses are red,
// → Violets are blue.
```

> 💡 Tip: Template literals are cleaner than joining strings with `+`. Compare `"Hi " + name + "!"` with `` `Hi ${name}!` ``.

## Common string methods

A **method** is a built-in action you can call on a value, with a dot and parentheses: `text.toUpperCase()`.

| Method | What it does | Example | Result |
|---|---|---|---|
| `toUpperCase()` | All capitals | `"hi".toUpperCase()` | `"HI"` |
| `toLowerCase()` | All lower-case | `"Hi".toLowerCase()` | `"hi"` |
| `trim()` | Removes spaces at both ends | `"  hi  ".trim()` | `"hi"` |
| `slice(start, end)` | Part of the string (end not included) | `"Hello".slice(1, 4)` | `"ell"` |
| `substring(start, end)` | Like `slice`, but no negative numbers | `"Hello".substring(1, 4)` | `"ell"` |
| `includes(x)` | Does it contain `x`? | `"Hello".includes("ell")` | `true` |
| `startsWith(x)` | Does it start with `x`? | `"Hello".startsWith("He")` | `true` |
| `endsWith(x)` | Does it end with `x`? | `"Hello".endsWith("lo")` | `true` |
| `indexOf(x)` | Position of first `x`, or `-1` | `"Hello".indexOf("l")` | `2` |
| `replace(a, b)` | Replaces the **first** `a` with `b` | `"a-b-c".replace("-", "+")` | `"a+b-c"` |
| `replaceAll(a, b)` | Replaces **every** `a` with `b` | `"a-b-c".replaceAll("-", "+")` | `"a+b+c"` |
| `split(sep)` | Splits into an array | `"a,b,c".split(",")` | `["a", "b", "c"]` |
| `at(i)` | Character at `i` (negatives count from end) | `"Hello".at(-1)` | `"o"` |
| `repeat(n)` | Repeats `n` times | `"ha".repeat(3)` | `"hahaha"` |
| `padStart(len, ch)` | Pads the start to a length | `"7".padStart(3, "0")` | `"007"` |

Let's look at a few more closely.

### `slice()` with negative numbers

Negative numbers count from the end.

```js
const file = "photo.jpeg";
console.log(file.slice(0, 5)); // → photo
console.log(file.slice(-4));   // → jpeg
console.log(file.slice(6));    // → jpeg (from index 6 to the end)
```

### `trim()` for user input

```js
const typed = "   ana@mail.com  ";
console.log(typed.trim()); // → ana@mail.com
```

### `includes()`, `startsWith()` and `indexOf()`

```js
const url = "https://example.com/blog";

console.log(url.startsWith("https")); // → true
console.log(url.includes("blog"));    // → true
console.log(url.indexOf("blog"));     // → 20
console.log(url.indexOf("shop"));     // → -1 (not found)
```

> 📝 Note: These methods are case-sensitive. `"Hello".includes("hello")` is `false`.

### `split()`

`split()` breaks a string into an **array** (a list). You'll learn arrays in the Arrays lesson.

```js
const csv = "red,green,blue";
console.log(csv.split(",")); // → ["red", "green", "blue"]

console.log("hi".split("")); // → ["h", "i"]
```

### `padStart()`

Handy for times and IDs:

```js
const minutes = 5;
console.log(String(minutes).padStart(2, "0")); // → 05
```

## Strings are immutable

**Immutable** means "cannot be changed". String methods never change the original string; they return a **new** one.

```js
let name = "ana";
name.toUpperCase();
console.log(name); // → ana  (unchanged!)

name = name.toUpperCase();
console.log(name); // → ANA
```

You also cannot change a single character:

```js
const word = "cat";
word[0] = "b";      // silently ignored
console.log(word);  // → cat
```

> ⚠️ Watch out: Always save the result of a string method in a variable if you want to keep it.

## Comparing strings

Use `===` to check if two strings are exactly the same.

```js
console.log("apple" === "apple"); // → true
console.log("apple" === "Apple"); // → false (case matters)
```

To ignore case, convert both sides first:

```js
const input = "YES";
console.log(input.toLowerCase() === "yes"); // → true
```

`<` and `>` compare strings letter by letter, like a dictionary order based on character codes:

```js
console.log("a" < "b");     // → true
console.log("apple" < "banana"); // → true
console.log("Z" < "a");     // → true (all capitals come before lower-case)
```

> 💡 Tip: For sorting words in a human-friendly way, use `a.localeCompare(b)`.

## Try it yourself

**Task 1:** Given `const city = "  lisbon "`, print it trimmed and in capitals.

<details>
<summary>Show solution</summary>

```js
const city = "  lisbon ";
console.log(city.trim().toUpperCase()); // → LISBON
```
</details>

**Task 2:** Use a template literal to print `Ana has 3 new messages.` from these variables.

```js
const user = "Ana";
const count = 3;
```

<details>
<summary>Show solution</summary>

```js
console.log(`${user} has ${count} new messages.`);
// → Ana has 3 new messages.
```
</details>

**Task 3:** Get the file extension from `"report.final.pdf"`.

<details>
<summary>Show solution</summary>

```js
const file = "report.final.pdf";
console.log(file.split(".").at(-1)); // → pdf
```
</details>

**Task 4:** Make `"hello world"` read `"hello_world"`.

<details>
<summary>Show solution</summary>

```js
console.log("hello world".replaceAll(" ", "_")); // → hello_world
```
</details>

## Quick check

<details>
<summary>What does <code>"Hello".slice(1, 3)</code> return?</summary>

`"el"`. It starts at index 1 and stops **before** index 3.
</details>

<details>
<summary>After <code>let s = "hi"; s.toUpperCase();</code>, what is <code>s</code>?</summary>

Still `"hi"`. Strings are immutable, so you must write `s = s.toUpperCase()`.
</details>

<details>
<summary>What does <code>indexOf</code> return when the text is not found?</summary>

`-1`.
</details>

## Key takeaways

- Strings are text inside `"`, `'` or backticks.
- Use `\` to escape special characters like `\n` and `\"`.
- Template literals (`` `Hi ${name}` ``) insert values and allow multi-line text.
- `length` gives the size; indexes start at `0`; `at(-1)` gets the last character.
- Methods like `slice`, `trim`, `includes`, `replaceAll` and `split` return new strings or arrays.
- Strings are immutable, and comparison with `===` is case-sensitive.
