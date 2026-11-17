---
title: JS Where To & Output
summary: "Learn where to put JavaScript in a web page, how to use external .js files, and the different ways JavaScript can show output."
level: Beginner
tags: [javascript, js-tutorial, script, output, console]
---

## The `<script>` tag

In an HTML page, JavaScript goes inside a `<script>` tag.

```html
<script>
  console.log("I am JavaScript inside HTML");
</script>
```

The browser reads the page from top to bottom. When it reaches a `<script>` tag, it runs the code inside.

## JavaScript in `<head>` or `<body>`

You can put scripts in the `<head>` or in the `<body>`.

```html
<!DOCTYPE html>
<html>
<head>
  <script>
    console.log("Runs early, before the page content exists");
  </script>
</head>
<body>
  <h1 id="title">Hello</h1>

  <script>
    // The <h1> above already exists here
    document.getElementById("title").textContent = "Hi there!";
  </script>
</body>
</html>
```

A script in the `<head>` runs **before** the body is built. So it cannot find elements like the `<h1>` yet.

> ⚠️ Watch out: If a script tries to use an element that does not exist yet, `getElementById` returns `null` and you get an error. Putting scripts at the end of `<body>`, or using `defer`, fixes this.

## External JavaScript files

For real projects, put your code in a separate file that ends in `.js`. Then link it with the `src` attribute.

**script.js**

```js
console.log("Hello from an external file!");
```

**index.html**

```html
<!DOCTYPE html>
<html>
<head>
  <script src="script.js" defer></script>
</head>
<body>
  <h1>My page</h1>
</body>
</html>
```

Why use external files?

- HTML and JavaScript stay separate, so both are easier to read.
- Many pages can share the same `.js` file.
- The browser can **cache** (save) the file, so pages load faster next time.

> 📝 Note: A `.js` file contains only JavaScript. Do **not** write `<script>` tags inside it.

## The `defer` attribute

`defer` tells the browser: "download this script now, but run it only after the whole page is built."

```html
<head>
  <script src="app.js" defer></script>
</head>
```

With `defer`, your script can safely find any element on the page, even though the tag sits in the `<head>`.

> 💡 Tip: For external scripts, `<script src="..." defer>` in the `<head>` is a simple, modern default.

## Ways to show output

JavaScript can "display" data in several ways:

| Method | Where the output goes | Good for |
|---|---|---|
| `console.log()` | Browser console | Testing and debugging |
| `element.textContent` | Inside an HTML element (as text) | Showing text to users |
| `element.innerHTML` | Inside an HTML element (as HTML) | Inserting HTML you control |
| `alert()` | A pop-up box | Quick tests only |
| `document.write()` | Straight into the page | Avoid it |

## `console.log()`

`console.log()` prints values in the console. It is the tool you will use most while learning.

```js
console.log("Hello");
console.log(5 + 10);
console.log("Total:", 42);
```

Output:

```
Hello
15
Total: 42
```

You can pass several values separated by commas. They print with a space between them.

## `textContent` and `innerHTML`

To show output **on the page**, find an element and change its content.

```html
<p id="demo"></p>

<script>
  document.getElementById("demo").textContent = "5 + 6 = " + (5 + 6);
</script>
```

The paragraph now shows: **5 + 6 = 11**

`innerHTML` is similar, but it reads the text as HTML:

```html
<p id="a"></p>
<p id="b"></p>

<script>
  document.getElementById("a").textContent = "<b>Bold?</b>";
  document.getElementById("b").innerHTML = "<b>Bold!</b>";
</script>
```

The first paragraph shows the tags as plain text: `<b>Bold?</b>`. The second shows **Bold!** in bold.

> ⚠️ Watch out: Never put text typed by users into `innerHTML`. Someone could inject harmful code. Use `textContent` for plain text.

## `alert()`

`alert()` opens a small pop-up box with a message. The user must click OK to continue.

```js
alert("Welcome to my site!");
```

It is handy for a very quick test, but it blocks the page and annoys users. Avoid it in real sites.

## `document.write()` (and why to avoid it)

`document.write()` writes straight into the HTML while the page is loading.

```html
<script>
  document.write("Hello!");
</script>
```

If you call it **after** the page has finished loading (for example, on a button click), it **erases the whole page** and replaces it.

```html
<button onclick="document.write('Oops')">Click me</button>
<!-- Clicking wipes the page and shows only "Oops" -->
```

> ⚠️ Watch out: `document.write()` is an old method. Use `textContent` or `innerHTML` instead.

## More console methods

The console can do more than `log`.

| Method | What it does | Example |
|---|---|---|
| `console.error()` | Prints a message in red, as an error | `console.error("Failed to load")` |
| `console.warn()` | Prints a yellow warning | `console.warn("Low battery")` |
| `console.info()` | Prints an info message | `console.info("Saved")` |
| `console.table()` | Shows arrays/objects as a table | `console.table(users)` |
| `console.clear()` | Clears the console | `console.clear()` |

`console.table()` is great for lists of data:

```js
const users = [
  { name: "Ana", age: 25 },
  { name: "Ben", age: 31 },
];

console.table(users);
```

Output (in the console):

```
┌─────────┬───────┬─────┐
│ (index) │ name  │ age │
├─────────┼───────┼─────┤
│    0    │ 'Ana' │ 25  │
│    1    │ 'Ben' │ 31  │
└─────────┴───────┴─────┘
```

## Try it yourself

**Task 1:** Print the result of `7 * 8` to the console with a label, like `Result: 56`.

<details>
<summary>Show solution</summary>

```js
console.log("Result:", 7 * 8);
// → Result: 56
```
</details>

**Task 2:** Make a page with `<p id="greeting"></p>` and use JavaScript to show "Good morning!" inside it.

<details>
<summary>Show solution</summary>

```html
<p id="greeting"></p>

<script>
  document.getElementById("greeting").textContent = "Good morning!";
</script>
```
</details>

**Task 3:** Move the code from Task 2 into a file called `main.js` and link it from the `<head>` so it still works.

<details>
<summary>Show solution</summary>

```html
<head>
  <script src="main.js" defer></script>
</head>
<body>
  <p id="greeting"></p>
</body>
```

```js
// main.js
document.getElementById("greeting").textContent = "Good morning!";
```
</details>

## Quick check

<details>
<summary>What does <code>defer</code> do?</summary>

It downloads the script right away but runs it only after the HTML page is fully built.
</details>

<details>
<summary>What is the difference between <code>textContent</code> and <code>innerHTML</code>?</summary>

`textContent` treats the value as plain text. `innerHTML` reads it as HTML, so tags like `<b>` become real elements.
</details>

<details>
<summary>Why should you avoid <code>document.write()</code>?</summary>

It is outdated, and if it runs after the page loads it wipes out the whole page.
</details>

## Key takeaways

- JavaScript lives inside `<script>` tags or in external `.js` files linked with `src`.
- Use `defer` so scripts run after the page is built.
- `console.log()` is for you, the developer; `textContent` is for showing text to users.
- Use `innerHTML` only with HTML you trust.
- Avoid `alert()` in real sites and avoid `document.write()` completely.
- `console.error`, `console.warn` and `console.table` make debugging easier.
