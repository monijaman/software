---
title: JS Browser BOM, Timers & Storage
summary: "Meet the browser's own objects: window, location, history and navigator, plus timers with setTimeout and setInterval and saving data with localStorage."
level: Beginner
tags: [javascript, js-tutorial, bom, timers, localstorage]
---

## What is the BOM?

The **BOM** (Browser Object Model) is the set of objects the browser gives you to talk to the browser itself: the window, the address bar, the history, the screen.

The DOM is about the **page content**. The BOM is about **everything around it**.

## The window object

`window` is the top-level object in the browser. Global variables and functions live on it, so you can usually leave it out.

```js
window.console.log("Hi"); // same as console.log("Hi")
window.alert("Hello");    // same as alert("Hello")
```

### Window and screen size

| Property | What it gives you |
| --- | --- |
| `window.innerWidth` | Width of the visible page area, in pixels |
| `window.innerHeight` | Height of the visible page area |
| `screen.width` | Width of the whole screen |
| `window.scrollY` | How far the page is scrolled down |

```js
console.log(window.innerWidth); // → e.g. 1280

window.addEventListener("resize", () => {
  console.log(`Now ${window.innerWidth}px wide`);
});
```

## location: the address bar

`location` holds the current URL and lets you go somewhere else.

```js
// Suppose the URL is https://shop.example.com/search?q=shoes&page=2
console.log(location.href);     // → "https://shop.example.com/search?q=shoes&page=2"
console.log(location.hostname); // → "shop.example.com"
console.log(location.pathname); // → "/search"
console.log(location.search);   // → "?q=shoes&page=2"
```

| Method | What it does |
| --- | --- |
| `location.href = url` | Go to a new page |
| `location.reload()` | Reload the current page |
| `location.replace(url)` | Go to a page without adding a history entry |

### Reading search params

Use `URLSearchParams` to read the `?key=value` part easily.

```js
const params = new URLSearchParams(location.search);

console.log(params.get("q"));         // → "shoes"
console.log(Number(params.get("page"))); // → 2
console.log(params.get("color"));     // → null (not in the URL)
console.log(params.has("q"));         // → true
```

## history: back and forward

```js
history.back();    // like the browser's Back button
history.forward(); // like the Forward button
history.go(-2);    // go back two pages
```

> 📝 Note: Frameworks like Next.js use `history.pushState()` to change the URL without reloading. You rarely call it yourself.

## navigator: about the browser

```js
console.log(navigator.language); // → e.g. "en-US"
console.log(navigator.onLine);   // → true or false
```

You can copy text to the clipboard with `navigator.clipboard`. It returns a promise and usually must run after a user action, like a click.

```js
copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText("Copied text!");
  console.log("Copied");
});
```

## alert, confirm and prompt

These show simple pop-up boxes. They **pause** the page until the user answers.

```js
alert("Saved!");                         // shows a message, returns undefined

const sure = confirm("Delete this item?"); // OK → true, Cancel → false
console.log(sure);

const name = prompt("What is your name?"); // returns the text, or null on Cancel
console.log(name);
```

> 💡 Tip: These are fine for learning and quick tests. Real sites use their own nicer dialogs (for example the HTML `<dialog>` element).

## Timers: setTimeout

`setTimeout(fn, ms)` runs a function **once**, after a delay in milliseconds (1000 ms = 1 second).

```js
console.log("Start");

setTimeout(() => {
  console.log("2 seconds later");
}, 2000);

console.log("End");
```

Output:

```
Start
End
2 seconds later
```

> 📝 Note: "End" prints before the timer. JavaScript does not wait; it schedules the function and moves on. The Async JS lesson explains why.

To cancel a timeout, keep its ID and call `clearTimeout`.

```js
const id = setTimeout(() => console.log("never"), 1000);
clearTimeout(id);
```

## Timers: setInterval

`setInterval(fn, ms)` runs a function **again and again**, every `ms` milliseconds, until you stop it with `clearInterval`.

### Countdown example

```html
<p id="timer">5</p>

<script>
  const display = document.querySelector("#timer");
  let seconds = 5;

  const id = setInterval(() => {
    seconds--;
    display.textContent = seconds;

    if (seconds === 0) {
      clearInterval(id);
      display.textContent = "Time's up!";
    }
  }, 1000);
</script>
```

The page shows 5, 4, 3, 2, 1, then "Time's up!".

> ⚠️ Watch out: Always keep the interval ID so you can stop it. A forgotten interval keeps running forever.

## localStorage and sessionStorage

**Web storage** lets you save small bits of text in the browser.

| | `localStorage` | `sessionStorage` |
| --- | --- | --- |
| How long it lasts | Until removed (survives closing the browser) | Until the tab is closed |
| Shared between tabs | Yes, same site | No, one tab only |

Both have the same methods:

| Method | What it does | Example |
| --- | --- | --- |
| `setItem(key, value)` | Save a value | `localStorage.setItem("theme", "dark")` |
| `getItem(key)` | Read a value (or `null`) | `localStorage.getItem("theme")` |
| `removeItem(key)` | Delete one value | `localStorage.removeItem("theme")` |
| `clear()` | Delete everything for this site | `localStorage.clear()` |

```js
localStorage.setItem("theme", "dark");
console.log(localStorage.getItem("theme")); // → "dark"
console.log(localStorage.getItem("color")); // → null
```

### Storing objects with JSON

Storage only keeps **strings**. To save an object or array, turn it into JSON first.

```js
const user = { name: "Sara", score: 42 };

localStorage.setItem("user", JSON.stringify(user));

const saved = JSON.parse(localStorage.getItem("user"));
console.log(saved.score); // → 42
```

> ⚠️ Watch out: Never store passwords or secret tokens in localStorage. Any script on the page can read it.

## Cookies (briefly)

**Cookies** are small pieces of text that are also sent to the server with every request. They are mostly used for logins and are usually set by the server.

```js
document.cookie = "lang=en; max-age=3600; path=/";
console.log(document.cookie); // → "lang=en"
```

For data that only your JavaScript needs, `localStorage` is simpler.

## Try it yourself

1. Log a message 3 seconds after the page loads.

<details>
<summary>Show solution</summary>

```js
setTimeout(() => {
  console.log("3 seconds passed");
}, 3000);
```
</details>

2. Read `?name=Ali` from the URL and show "Hello, Ali" (or "Hello, guest" if missing).

<details>
<summary>Show solution</summary>

```js
const params = new URLSearchParams(location.search);
const name = params.get("name") ?? "guest";
console.log(`Hello, ${name}`);
```
</details>

3. Count how many times the user has visited the page, using localStorage.

<details>
<summary>Show solution</summary>

```js
const visits = Number(localStorage.getItem("visits") ?? 0) + 1;
localStorage.setItem("visits", visits);
console.log(`Visit number ${visits}`);
```
</details>

## Quick check

<details>
<summary>What is the difference between setTimeout and setInterval?</summary>

`setTimeout` runs once after a delay. `setInterval` repeats every delay until you call `clearInterval`.
</details>

<details>
<summary>Why do you need JSON.stringify with localStorage?</summary>

Because storage only saves strings. `JSON.stringify` turns objects into a string, and `JSON.parse` turns it back.
</details>

<details>
<summary>Which storage disappears when the tab closes?</summary>

`sessionStorage`.
</details>

## Key takeaways

- The BOM is the browser's own objects: `window`, `location`, `history`, `navigator`, `screen`.
- `URLSearchParams` makes reading `?key=value` easy.
- `setTimeout` runs once; `setInterval` repeats; clear them with their IDs.
- `localStorage` keeps strings across visits; use JSON for objects.
- Don't store secrets in web storage; cookies are mainly for server logins.
