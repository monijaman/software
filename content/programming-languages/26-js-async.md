---
title: "JS Async: Callbacks, Promises & Fetch"
summary: "Understand why some JavaScript runs later, and learn callbacks, promises, async/await and fetch to load data without freezing the page."
level: Intermediate
tags: [javascript, js-tutorial, async, promises, fetch]
---

## Sync vs async

**Synchronous** code runs one line at a time, in order. Each line waits for the one before.

**Asynchronous** (async) code starts a slow task, keeps going, and handles the result **later**.

Think of a café. A sync barista takes your order, makes your coffee, and only then serves the next person. An async barista takes your order, gives you a buzzer, and serves the next person. When your coffee is ready, the buzzer rings.

```js
console.log("1. Order coffee");

setTimeout(() => {
  console.log("3. Coffee is ready");
}, 1000);

console.log("2. Read a book while waiting");
```

Output:

```
1. Order coffee
2. Read a book while waiting
3. Coffee is ready
```

Slow tasks like loading data from a server are async, so the page does not freeze.

## Callbacks

A **callback** is a function you pass to another function, to be called later.

```js
function loadUser(id, callback) {
  setTimeout(() => {
    callback({ id, name: "Sara" });
  }, 500);
}

loadUser(1, (user) => {
  console.log(user.name); // → "Sara" (after 0.5 s)
});
```

### Callback hell

When each step needs the result of the last one, callbacks nest deeper and deeper. This is called **callback hell**.

```js
// ❌ Hard to read, hard to handle errors
loadUser(1, (user) => {
  loadOrders(user.id, (orders) => {
    loadDetails(orders[0], (details) => {
      console.log(details);
    });
  });
});
```

Promises were created to fix this.

## Promises

A **promise** is an object that stands for a value you will get later. It is like the café buzzer.

A promise is always in one of three **states**:

| State | Meaning |
| --- | --- |
| pending | Still waiting |
| fulfilled | Finished successfully, has a value |
| rejected | Failed, has an error |

Once a promise is fulfilled or rejected, it is **settled** and never changes again.

### then, catch, finally

```js
fetch("https://jsonplaceholder.typicode.com/users/1")
  .then((response) => response.json())
  .then((user) => console.log(user.name))  // → "Leanne Graham"
  .catch((error) => console.log("Failed:", error.message))
  .finally(() => console.log("Done"));
```

- `.then(fn)` runs when the promise is fulfilled. Returning a value passes it to the next `.then`.
- `.catch(fn)` runs if any step before it fails.
- `.finally(fn)` runs at the end either way. Good for hiding a loading spinner.

### Creating a promise

You can make your own with `new Promise`. You get two functions: `resolve` (success) and `reject` (failure).

```js
function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function rollDice() {
  return new Promise((resolve, reject) => {
    const n = Math.floor(Math.random() * 6) + 1;
    if (n === 1) reject(new Error("Rolled a 1!"));
    else resolve(n);
  });
}

wait(1000).then(() => console.log("1 second passed"));

rollDice()
  .then((n) => console.log(`You rolled ${n}`))
  .catch((err) => console.log(err.message));
```

> 💡 Tip: Most of the time you don't create promises yourself. You **use** promises returned by `fetch` and other APIs.

## async and await

`async`/`await` lets you write promise code that reads like normal, top-to-bottom code.

- Put `async` before a function. It now always returns a promise.
- Inside it, `await` pauses that function until a promise settles, then gives you its value.

```js
async function showUser() {
  const response = await fetch("https://jsonplaceholder.typicode.com/users/1");
  const user = await response.json();
  console.log(user.name); // → "Leanne Graham"
}

showUser();
```

Compare it with the `.then` version above. Same work, easier to read.

> 📝 Note: `await` only pauses **this** function. The rest of the page keeps running.

## Error handling with try/catch

With `await`, handle errors with a normal `try...catch` block.

```js
async function showUser(id) {
  try {
    const response = await fetch(`https://jsonplaceholder.typicode.com/users/${id}`);
    const user = await response.json();
    console.log(user.name);
  } catch (error) {
    console.log("Something went wrong:", error.message);
  } finally {
    console.log("Finished");
  }
}
```

> ⚠️ Watch out: If you forget `await`, `try/catch` will not catch the error, because the promise fails later.

## Running promises together

Waiting for tasks one after another is slow if they don't depend on each other. These helpers run many promises at once.

| Method | Resolves when… | Rejects when… |
| --- | --- | --- |
| `Promise.all(list)` | **all** succeed → array of values | **any one** fails |
| `Promise.allSettled(list)` | all are settled → array of `{status, value/reason}` | never |
| `Promise.race(list)` | the **first** one settles (success or fail) | the first one settles with a fail |
| `Promise.any(list)` | the **first** one succeeds | **all** fail |

```js
const wait = (ms, value) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const results = await Promise.all([wait(300, "A"), wait(100, "B")]);
console.log(results); // → ["A", "B"]  (order of the list, not of finishing)

const first = await Promise.race([wait(300, "slow"), wait(100, "fast")]);
console.log(first);   // → "fast"
```

> 📝 Note: `await` at the top level (outside a function) works in modules and the browser console. In normal scripts, put it inside an `async` function.

## fetch: GET request

`fetch(url)` asks a server for data and returns a promise of a **Response**.

```js
async function getTodo() {
  const response = await fetch("https://jsonplaceholder.typicode.com/todos/1");

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  const todo = await response.json();
  console.log(todo.title); // → "delectus aut autem"
}

getTodo().catch((error) => console.log(error.message));
```

> ⚠️ Watch out: `fetch` only rejects on **network** failures. A 404 or 500 still "succeeds". Always check `response.ok`.

## fetch: POST JSON

To send data, pass an options object with `method`, `headers` and `body`.

```js
async function createPost() {
  const response = await fetch("https://jsonplaceholder.typicode.com/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Hello", body: "My first post", userId: 1 }),
  });

  if (!response.ok) throw new Error(`HTTP error ${response.status}`);

  const created = await response.json();
  console.log(created.id); // → 101 (a fake id from the test server)
}

createPost();
```

## How does it all work? The event loop

JavaScript runs one thing at a time. When a slow task finishes, its callback waits in a queue, and the **event loop** runs it as soon as the current code is done.

That is why `setTimeout(..., 0)` still runs *after* the code below it.

## Try it yourself

1. Write `wait(ms)` and use it with `await` to log "Go!" after 2 seconds.

<details>
<summary>Show solution</summary>

```js
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function start() {
  await wait(2000);
  console.log("Go!");
}

start();
```
</details>

2. Fetch `https://jsonplaceholder.typicode.com/users` and log how many users there are.

<details>
<summary>Show solution</summary>

```js
async function countUsers() {
  const response = await fetch("https://jsonplaceholder.typicode.com/users");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const users = await response.json();
  console.log(users.length); // → 10
}

countUsers().catch(console.error);
```
</details>

3. Load users 1 and 2 **at the same time** and log both names.

<details>
<summary>Show solution</summary>

```js
async function loadTwo() {
  const base = "https://jsonplaceholder.typicode.com/users/";
  const [a, b] = await Promise.all([
    fetch(base + 1).then((r) => r.json()),
    fetch(base + 2).then((r) => r.json()),
  ]);
  console.log(a.name, "&", b.name); // → Leanne Graham & Ervin Howell
}

loadTwo();
```
</details>

## Quick check

<details>
<summary>What are the three states of a promise?</summary>

Pending, fulfilled and rejected.
</details>

<details>
<summary>Does fetch reject when the server returns 404?</summary>

No. It resolves with `response.ok === false`. You must check `response.ok` yourself.
</details>

<details>
<summary>What is the difference between Promise.all and Promise.allSettled?</summary>

`all` fails as soon as one promise fails. `allSettled` always waits for every promise and tells you which ones succeeded or failed.
</details>

## Key takeaways

- Async code starts slow work and handles the result later, so the page stays responsive.
- Callbacks work, but nested callbacks become "callback hell".
- A promise is pending, then fulfilled or rejected; use `.then`, `.catch`, `.finally`.
- `async`/`await` with `try/catch` is the clearest way to write async code.
- Use `Promise.all` and friends to run independent tasks together.
- With `fetch`, always check `response.ok` and call `response.json()`.
