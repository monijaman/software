---
title: JS Functions
summary: "Learn how to write reusable blocks of code with functions: parameters, return values, default and rest parameters, arrow functions, and passing functions around as values."
level: Beginner
tags: [javascript, js-tutorial, functions, arrow-functions]
---

## Why functions?

A **function** is a named block of code you can run whenever you want. Write it once, use it many times.

Functions help you:

- avoid repeating the same code,
- give a clear name to a task (`calculateTotal` says what it does),
- split a big problem into small pieces.

## Declaring and calling a function

A **function declaration** starts with the `function` keyword, a name, brackets `()` and a block `{}`.

```js
function sayHello() {
  console.log("Hello!");
}

sayHello(); // → Hello!
sayHello(); // → Hello!
```

Writing the function only **defines** it. Adding `()` after the name **calls** (runs) it.

> ⚠️ Watch out: `sayHello` without `()` does not run anything. It just refers to the function itself.

## Parameters and arguments

**Parameters** are the names listed in the function definition. **Arguments** are the real values you pass in when you call it.

```js
function greet(name) {          // name is a parameter
  console.log("Hi, " + name);
}

greet("Aisha");  // "Aisha" is an argument → Hi, Aisha
greet("Tom");    // → Hi, Tom
```

A function can have several parameters, separated by commas:

```js
function add(a, b) {
  console.log(a + b);
}

add(2, 3); // → 5
```

If you pass too few arguments, the missing ones are `undefined`.

```js
add(2); // → NaN  (2 + undefined)
```

## return: giving back a value

`return` sends a value back to the code that called the function. The function stops at `return`.

```js
function multiply(a, b) {
  return a * b;
}

const result = multiply(4, 5);
console.log(result);           // → 20
console.log(multiply(2, 10));  // → 20
```

A function without `return` gives back `undefined`.

```js
function noReturn() {
  const x = 5;
}
console.log(noReturn()); // → undefined
```

> 💡 Tip: Prefer functions that `return` a value over functions that only `console.log`. Returned values can be stored, tested and reused.

## Default parameters

You can give a parameter a **default value**. It is used when the argument is missing (`undefined`).

```js
function greet(name = "friend") {
  return `Hello, ${name}!`;
}

console.log(greet("Lina")); // → Hello, Lina!
console.log(greet());       // → Hello, friend!
```

## Rest parameters

A **rest parameter** (`...name`) collects any number of arguments into an array. It must be the last parameter.

```js
function sum(...numbers) {
  let total = 0;
  for (const n of numbers) {
    total += n;
  }
  return total;
}

console.log(sum(1, 2));        // → 3
console.log(sum(1, 2, 3, 4));  // → 10
console.log(sum());            // → 0
```

## Function expressions

You can also store a function in a variable. This is called a **function expression**.

```js
const square = function (n) {
  return n * n;
};

console.log(square(6)); // → 36
```

## Arrow functions

An **arrow function** is a shorter way to write a function expression, using `=>`.

```js
const square = (n) => {
  return n * n;
};
```

When the body is a single expression, you can drop the `{}` and the `return`. The value is returned automatically.

```js
const square = (n) => n * n;
const add = (a, b) => a + b;
const sayHi = () => "Hi!";

console.log(square(4)); // → 16
console.log(add(2, 3)); // → 5
console.log(sayHi());   // → "Hi!"
```

| Form | Example |
| --- | --- |
| No parameters | `() => "Hi"` |
| One parameter | `n => n * 2` or `(n) => n * 2` |
| Several parameters | `(a, b) => a + b` |
| Multi-line body | `(a, b) => { const s = a + b; return s; }` |

> ⚠️ Watch out: with `{}` you **must** write `return`. `(a, b) => { a + b }` returns `undefined`.

### Returning an object

To return an object in the short form, wrap it in brackets `()`. Otherwise JavaScript thinks the `{` starts a code block.

```js
const makeUser = (name, age) => ({ name, age });

console.log(makeUser("Ali", 30)); // → { name: "Ali", age: 30 }
```

## Functions are values

In JavaScript, a function is a value, just like a number or string. You can store it, put it in an array, or pass it to another function.

A function you pass into another function is called a **callback**.

```js
function repeat(times, action) {
  for (let i = 0; i < times; i++) {
    action(i);
  }
}

repeat(3, (i) => console.log("Round", i));
// → Round 0
// → Round 1
// → Round 2
```

You'll use callbacks all the time with array methods and events:

```js
const doubled = [1, 2, 3].map((n) => n * 2);
console.log(doubled); // → [2, 4, 6]
```

## Hoisting of declarations

Function **declarations** are "hoisted": JavaScript sets them up before running your code, so you can call them above where they are written.

```js
console.log(double(5)); // → 10

function double(n) {
  return n * 2;
}
```

Function **expressions** and arrow functions are not usable before their line.

```js
console.log(triple(5)); // ❌ ReferenceError: Cannot access 'triple' before initialization

const triple = (n) => n * 3;
```

> 📝 Note: The Scope, Hoisting & Closures lesson explains this in more detail.

## Pure functions

A **pure function** always gives the same output for the same input and does not change anything outside itself.

```js
// Pure: depends only on its inputs
const addTax = (price) => price * 1.2;

// Not pure: changes an outside variable
let total = 0;
function addToTotal(price) {
  total += price;
}
```

Pure functions are easier to test and reason about. Aim for them when you can.

## Try it in a page

```html
<input id="c" type="number" placeholder="°C">
<button onclick="convert()">Convert</button>
<p id="out"></p>

<script>
  const toFahrenheit = (c) => c * 9 / 5 + 32;

  function convert() {
    const c = Number(document.getElementById("c").value);
    document.getElementById("out").textContent = `${c}°C = ${toFahrenheit(c)}°F`;
  }
</script>
```

## Try it yourself

**1.** Write a function `area(width, height)` that returns the area of a rectangle.

<details>
<summary>Show solution</summary>

```js
function area(width, height) {
  return width * height;
}

console.log(area(4, 5)); // → 20
```
</details>

**2.** Rewrite it as a one-line arrow function.

<details>
<summary>Show solution</summary>

```js
const area = (width, height) => width * height;
console.log(area(3, 7)); // → 21
```
</details>

**3.** Write `average(...nums)` that returns the average of any number of values.

<details>
<summary>Show solution</summary>

```js
const average = (...nums) => {
  let total = 0;
  for (const n of nums) total += n;
  return total / nums.length;
};

console.log(average(2, 4, 6)); // → 4
```
</details>

## Quick check

<details>
<summary>What is the difference between a parameter and an argument?</summary>

A parameter is the name in the function definition (`name`). An argument is the actual value passed when calling it (`"Aisha"`).
</details>

<details>
<summary>What does <code>const f = (x) =&gt; { x * 2 };</code> return for <code>f(3)</code>?</summary>

`undefined`. With curly braces, you must write `return x * 2;`.
</details>

<details>
<summary>Can you call a function declaration before the line where it is written?</summary>

Yes. Function declarations are hoisted. Arrow functions and function expressions stored in `const` cannot.
</details>

## Key takeaways

- A function is a reusable, named block of code; call it with `()`.
- Parameters are placeholders; arguments are the real values you pass in.
- `return` sends a value back and stops the function; without it you get `undefined`.
- Default (`b = 1`) and rest (`...args`) parameters make functions flexible.
- Arrow functions are short; wrap returned objects in `()`.
- Functions are values, so you can pass them around as callbacks.
