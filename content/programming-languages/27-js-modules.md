---
title: JS Modules
summary: "Split your code into files with export and import, load modules in the browser, use dynamic import(), and see how ES modules differ from CommonJS in Node."
level: Intermediate
tags: [javascript, js-tutorial, modules, esm]
---

## Why modules?

As a program grows, one big file becomes hard to read. A **module** is simply a JavaScript file that shares some of its code with other files.

Modules help you:

- Keep each file small and focused (one job per file).
- Avoid name clashes, because each module has its own scope.
- Reuse code in many places.

## export: sharing code

Use `export` to make something available to other files.

### Named exports

A file can have **many** named exports.

```js
// math.js
export const PI = 3.14159;

export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}
```

You can also list them at the bottom:

```js
// math.js
const PI = 3.14159;
function add(a, b) { return a + b; }

export { PI, add };
```

### Default export

A file can have **one** default export: the "main thing" the file offers.

```js
// greet.js
export default function greet(name) {
  return `Hello, ${name}!`;
}
```

> 💡 Tip: Many teams prefer named exports, because the name is fixed and editors can auto-import them reliably.

## import: using code

| Syntax | What it imports |
| --- | --- |
| `import { add } from "./math.js"` | A named export |
| `import { add, PI } from "./math.js"` | Several named exports |
| `import greet from "./greet.js"` | The default export (any name you like) |
| `import { add as sum } from "./math.js"` | A named export, renamed |
| `import * as math from "./math.js"` | Everything, as one object |

```js
// app.js
import greet from "./greet.js";
import { add, multiply as times } from "./math.js";
import * as math from "./math.js";

console.log(greet("Sara"));  // → "Hello, Sara!"
console.log(add(2, 3));      // → 5
console.log(times(2, 3));    // → 6
console.log(math.PI);        // → 3.14159
```

> ⚠️ Watch out: In the browser, the path must start with `./`, `../` or `/` and include the `.js` extension. `"./math"` without `.js` will fail.

> 📝 Note: Imports are **read-only**. You can't do `PI = 3` in `app.js`.

## Modules in the browser

Add `type="module"` to the script tag.

```html
<!DOCTYPE html>
<html>
<body>
  <p id="out"></p>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

Module scripts behave a little differently from normal scripts:

- They are **deferred** automatically: they run after the HTML is parsed.
- They run in **strict mode** automatically.
- They run only once, even if imported many times.

> ⚠️ Watch out: Modules don't work if you open the file by double-clicking (`file://`). You need a local server. For example, run `npx serve` in the folder, or use the "Live Server" extension in VS Code.

## Module scope

Variables at the top of a module are **not** global. They belong to that module only.

```js
// counter.js
let count = 0; // private to this file

export function increment() {
  count++;
  return count;
}
```

```js
// app.js
import { increment } from "./counter.js";

console.log(increment()); // → 1
console.log(increment()); // → 2
console.log(typeof count); // → "undefined" (not visible here)
```

This is great: no more accidental clashes between files.

## Dynamic import()

Normal `import` statements must be at the top of the file. `import()` (with brackets) loads a module **later**, only when you need it. It returns a promise.

```js
const button = document.querySelector("#chart-btn");

button.addEventListener("click", async () => {
  const { drawChart } = await import("./chart.js");
  drawChart();
});
```

> 💡 Tip: This keeps the first page load small. The chart code is downloaded only if the user clicks.

## Top-level await

Inside a module, you can use `await` outside of any function.

```js
// config.js (a module)
const response = await fetch("/config.json");
export const config = await response.json();
```

Any file that imports `config.js` waits until the config is loaded.

> 📝 Note: Top-level await works only in modules, not in classic `<script>` tags.

## ES modules vs CommonJS

Node.js had its own module system before `import`/`export` existed. It is called **CommonJS** and uses `require`. You will still see it in older code.

```js
// CommonJS (older Node style)
const fs = require("fs");
module.exports = { add };
```

```js
// ES modules (modern)
import fs from "node:fs";
export { add };
```

| | ES modules (ESM) | CommonJS (CJS) |
| --- | --- | --- |
| Import | `import x from "./x.js"` | `const x = require("./x")` |
| Export | `export` / `export default` | `module.exports = ...` |
| Where | Browsers and modern Node | Node only |
| Loading | Static, analyzed before running | Runs when `require` is called |
| Top-level await | Yes | No |
| Enable in Node | `"type": "module"` in package.json, or `.mjs` files | Default, or `.cjs` files |

> 💡 Tip: For new projects, use ES modules. Tools like Next.js, Vite and modern Node all support them.

## Try it yourself

1. Create `strings.js` that exports `shout(text)` (returns uppercase + "!"). Import and use it.

<details>
<summary>Show solution</summary>

```js
// strings.js
export function shout(text) {
  return text.toUpperCase() + "!";
}

// app.js
import { shout } from "./strings.js";
console.log(shout("hello")); // → "HELLO!"
```
</details>

2. Give `user.js` a default export (an object) and a named export `VERSION`. Import both in one line.

<details>
<summary>Show solution</summary>

```js
// user.js
export const VERSION = "1.0";
export default { name: "Sara", role: "admin" };

// app.js
import user, { VERSION } from "./user.js";
console.log(user.name, VERSION); // → Sara 1.0
```
</details>

3. Load `./help.js` only when a "Help" button is clicked, and call its `showHelp()` function.

<details>
<summary>Show solution</summary>

```js
helpButton.addEventListener("click", async () => {
  const { showHelp } = await import("./help.js");
  showHelp();
});
```
</details>

## Quick check

<details>
<summary>How many default exports can a file have?</summary>

Only one. It can have any number of named exports.
</details>

<details>
<summary>Why does my module page fail when I double-click the HTML file?</summary>

Browsers block modules on `file://`. Serve the folder with a local server instead.
</details>

<details>
<summary>What does import() return?</summary>

A promise that resolves to the module object, with all its exports.
</details>

## Key takeaways

- A module is a file that shares code with `export` and uses code with `import`.
- Named exports use `{ }`; the single default export does not.
- Use `<script type="module">` in the browser, served from a local server.
- Module variables are private to the file, not global.
- `import()` loads code on demand; top-level `await` works in modules.
- Prefer ES modules; CommonJS `require` is the older Node style.
