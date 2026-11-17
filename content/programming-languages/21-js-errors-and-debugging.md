---
title: JS Errors & Debugging
summary: "Learn to read error messages, handle errors with try/catch/finally, throw your own errors, and find bugs with console methods and browser DevTools."
level: Beginner
tags: [javascript, js-tutorial, errors, debugging, devtools]
---

## Errors are normal

Every programmer sees errors every day. An **error** is JavaScript telling you, "I can't do this, and here is why."

Learning to read errors calmly is one of the most useful skills you can have.

## Common error types

| Error type | When it happens | Example that causes it |
| --- | --- | --- |
| `SyntaxError` | The code is not written correctly | `let x = ;` |
| `ReferenceError` | You use a variable that doesn't exist | `console.log(total)` (never declared) |
| `TypeError` | You use a value the wrong way | `null.length` or `5()` |
| `RangeError` | A number is outside the allowed range | `new Array(-1)` |

```js
console.log(price);
// ReferenceError: price is not defined

const user = null;
console.log(user.name);
// TypeError: Cannot read properties of null (reading 'name')

(3.14).toFixed(200);
// RangeError: toFixed() digits argument must be between 0 and 100
```

> 📝 Note: A `SyntaxError` stops the whole script before it starts. The other errors happen while the code runs.

## Reading an error message

An error in the browser console looks like this:

```text
Uncaught TypeError: Cannot read properties of undefined (reading 'toUpperCase')
    at formatName (app.js:3:15)
    at showUser (app.js:8:3)
    at app.js:11:1
```

Read it in three parts:

1. **Type** — `TypeError`: you used a value the wrong way.
2. **Message** — something was `undefined`, and the code tried to read `toUpperCase` from it.
3. **Stack trace** — the list of `at ...` lines. The **top** line is where it broke: file `app.js`, line `3`, column `15`. The lines below show which functions called it.

> 💡 Tip: Click the file link in the console to jump straight to the line.

## try...catch

**`try...catch`** lets you run risky code and handle the error instead of crashing.

```js
try {
  const data = JSON.parse("{bad json}");
  console.log(data);
} catch (error) {
  console.log("Something went wrong:", error.name);
}
// → "Something went wrong: SyntaxError"
```

If no error happens, the `catch` block is skipped.

## finally

The **`finally`** block always runs, error or not. Use it for cleanup, like hiding a loading spinner.

```js
function loadData() {
  console.log("Loading...");
  try {
    throw new Error("Server down");
  } catch (error) {
    console.log("Error:", error.message);
  } finally {
    console.log("Done loading");
  }
}

loadData();
// → "Loading..."
// → "Error: Server down"
// → "Done loading"
```

## throw: making your own errors

Use **`throw`** to stop a function when something is wrong.

```js
function divide(a, b) {
  if (b === 0) {
    throw new Error("Cannot divide by zero");
  }
  return a / b;
}

try {
  divide(10, 0);
} catch (error) {
  console.log(error.message); // → "Cannot divide by zero"
}
```

> ⚠️ Watch out: Always throw an `Error` object, not a plain string. `Error` objects carry a stack trace that helps you find the problem.

## The Error object

Every error object has a few useful properties.

| Property | What it holds | Example |
| --- | --- | --- |
| `name` | The error type | `"TypeError"` |
| `message` | The description | `"Cannot divide by zero"` |
| `stack` | The stack trace as text | `"Error: ... at divide ..."` |
| `cause` | The original error (optional) | another `Error` |

## Custom errors

You can make your own error types by extending `Error`. This helps you handle different problems in different ways.

```js
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

function checkAge(age) {
  if (age < 0) throw new ValidationError("Age cannot be negative", "age");
  return age;
}

try {
  checkAge(-5);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(`${error.field}: ${error.message}`); // → "age: Age cannot be negative"
  } else {
    throw error; // not ours: pass it on
  }
}
```

## error.cause

When you catch a low-level error and throw a clearer one, keep the original as the **`cause`**.

```js
function readSettings(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error("Settings file is broken", { cause: err });
  }
}

try {
  readSettings("{oops");
} catch (error) {
  console.log(error.message);     // → "Settings file is broken"
  console.log(error.cause.name);  // → "SyntaxError"
}
```

## Debugging with console

The `console` object has more than just `log`.

| Method | What it does |
| --- | --- |
| `console.log()` | Prints normal messages |
| `console.error()` | Prints in red, as an error |
| `console.warn()` | Prints in yellow, as a warning |
| `console.table()` | Shows arrays and objects as a table |
| `console.group()` / `groupEnd()` | Groups messages together |
| `console.time()` / `timeEnd()` | Measures how long code takes |

```js
const users = [
  { name: "Ana", age: 28 },
  { name: "Ben", age: 31 },
];
console.table(users);

console.time("loop");
for (let i = 0; i < 1_000_000; i++) {}
console.timeEnd("loop"); // → "loop: 2.1 ms" (your number will differ)
```

> 💡 Tip: Log with a label so you know what you are looking at: `console.log("total:", total);`

## The debugger statement and breakpoints

A **breakpoint** pauses your code at a line so you can look at every variable. Here is how to use one.

1. Open your page and press **F12** (or right-click → **Inspect**) to open **DevTools**.
2. Go to the **Sources** tab (called **Debugger** in Firefox) and open your JS file.
3. Click a line number. A blue marker appears: that is a breakpoint.
4. Do the action that runs the code (reload or click a button). The code pauses at that line.
5. Hover over variables, or look in the **Scope** panel, to see their values.
6. Use the step buttons: **Step over** (next line), **Step into** (go inside a function), **Resume** (keep running).

You can also add a breakpoint from your code with the **`debugger`** statement. It pauses only when DevTools is open.

```html
<!DOCTYPE html>
<html>
  <body>
    <button id="btn">Add</button>
    <script>
      let total = 0;
      document.getElementById("btn").addEventListener("click", () => {
        debugger; // pauses here when DevTools is open
        total += 5;
        console.log("total:", total);
      });
    </script>
  </body>
</html>
```

> ⚠️ Watch out: Remove `debugger` lines before you ship your code.

## Strict mode

**Strict mode** makes JavaScript turn some silent mistakes into real errors. Turn it on with `"use strict";` at the top of a file.

```js
"use strict";
score = 10; // ReferenceError: score is not defined (without strict mode, this silently creates a global)
```

> 📝 Note: Code inside classes and JavaScript modules is strict automatically, so modern code usually gets this for free.

## Try it yourself

**1.** Write `getFirst(arr)` that throws an `Error` with the message `"Array is empty"` if the array has no items. Catch it and print the message.

<details>
<summary>Show solution</summary>

```js
function getFirst(arr) {
  if (arr.length === 0) throw new Error("Array is empty");
  return arr[0];
}

try {
  getFirst([]);
} catch (error) {
  console.log(error.message); // → "Array is empty"
}
```
</details>

**2.** What error type does this cause, and why? `const n = 5; n = 6;`

<details>
<summary>Show solution</summary>

```js
// TypeError: Assignment to constant variable.
// A const variable cannot be given a new value.
```
</details>

**3.** Use `try...catch...finally` to parse `'{"ok":true}'` and always print `"finished"`.

<details>
<summary>Show solution</summary>

```js
try {
  const result = JSON.parse('{"ok":true}');
  console.log(result.ok); // → true
} catch (error) {
  console.error(error.message);
} finally {
  console.log("finished"); // → "finished"
}
```
</details>

## Quick check

<details>
<summary>Which line of a stack trace shows where the error actually happened?</summary>

The top `at ...` line. The lines below it show which functions led there.
</details>

<details>
<summary>When does the <code>finally</code> block run?</summary>

Always: after `try` finishes, or after `catch` handles an error.
</details>

<details>
<summary>Why throw <code>new Error("...")</code> instead of a plain string?</summary>

An `Error` object has a `name`, a `message` and a `stack` trace, which make debugging much easier.
</details>

## Key takeaways

- The four common errors are `SyntaxError`, `ReferenceError`, `TypeError` and `RangeError`.
- Read errors as: type, message, then the top line of the stack trace.
- `try...catch` handles errors; `finally` always runs for cleanup.
- Throw `Error` objects (or custom subclasses), and use `cause` to keep the original error.
- Use `console.table`, `console.time` and DevTools breakpoints (or `debugger`) to find bugs.
- Strict mode turns silent mistakes into errors, and classes and modules use it automatically.
