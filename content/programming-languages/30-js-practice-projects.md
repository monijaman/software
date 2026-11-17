---
title: JS Practice Projects
summary: "Six small projects, from a click counter to a weather app, that put everything from this tutorial into practice, with hints and full solutions."
level: Beginner
tags: [javascript, js-tutorial, projects, practice]
---

## How to use this lesson

The best way to learn JavaScript is to **build things**. Here are six mini projects, from easy to harder.

For each one:

1. Read the goal and the hints.
2. Try to build it yourself first. Getting stuck is part of learning.
3. Only then open the solution and compare.

> 💡 Tip: Make one folder per project with an `index.html` file. Open it in your browser and keep the console (F12) open.

## Project 1: Click counter

**Goal:** A number with three buttons: −, Reset and +.

**Skills:** DOM selection, `click` events, `let` variables.

**Hints:**

1. Keep the count in a `let` variable.
2. Write one `render()` function that puts the count on the page.
3. Each button changes the count, then calls `render()`.

<details>
<summary>Show solution</summary>

```html
<!DOCTYPE html>
<html>
<body>
  <h1 id="count">0</h1>
  <button id="minus">−</button>
  <button id="reset">Reset</button>
  <button id="plus">+</button>

  <script>
    let count = 0;
    const display = document.querySelector("#count");

    function render() {
      display.textContent = count;
      display.style.color = count < 0 ? "crimson" : "inherit";
    }

    document.querySelector("#minus").addEventListener("click", () => { count--; render(); });
    document.querySelector("#plus").addEventListener("click", () => { count++; render(); });
    document.querySelector("#reset").addEventListener("click", () => { count = 0; render(); });
  </script>
</body>
</html>
```
</details>

## Project 2: Tip calculator

**Goal:** Enter a bill, a tip percent and the number of people. Show the tip and the amount per person.

**Skills:** reading inputs, `Number()`, the `input` event, `toFixed()`.

**Hints:**

1. Listen for `input` on all three fields and recalculate every time.
2. Remember: `.value` is a string. Convert it with `Number()`.
3. Guard against 0 people so you don't divide by zero.

<details>
<summary>Show solution</summary>

```html
<!DOCTYPE html>
<html>
<body>
  <label>Bill <input id="bill" type="number" min="0" value="50"></label>
  <label>Tip % <input id="tip" type="number" min="0" value="15"></label>
  <label>People <input id="people" type="number" min="1" value="2"></label>
  <p>Tip: <strong id="tipOut"></strong></p>
  <p>Each person pays: <strong id="eachOut"></strong></p>

  <script>
    const fields = ["bill", "tip", "people"].map((id) => document.querySelector(`#${id}`));
    const tipOut = document.querySelector("#tipOut");
    const eachOut = document.querySelector("#eachOut");

    function calculate() {
      const [bill, tipPercent, people] = fields.map((f) => Number(f.value));
      if (people < 1) {
        eachOut.textContent = "Enter at least 1 person";
        return;
      }
      const tip = bill * (tipPercent / 100);
      tipOut.textContent = tip.toFixed(2);
      eachOut.textContent = ((bill + tip) / people).toFixed(2);
    }

    fields.forEach((f) => f.addEventListener("input", calculate));
    calculate(); // bill 50, tip 15%, 2 people → Tip 7.50, each 28.75
  </script>
</body>
</html>
```
</details>

## Project 3: To-do list with localStorage

**Goal:** Add tasks, tick them as done, delete them. Tasks survive a page reload.

**Skills:** forms, arrays of objects, event delegation, `localStorage` with JSON.

**Hints:**

1. Keep tasks in an array like `[{ id, text, done }]`.
2. After every change: save to `localStorage` and re-draw the list.
3. Use **one** click listener on the `<ul>` and check which button was clicked.
4. Store each task's `id` in a `data-id` attribute.

<details>
<summary>Show solution</summary>

```html
<!DOCTYPE html>
<html>
<head>
  <style>.done span { text-decoration: line-through; color: gray; }</style>
</head>
<body>
  <form id="form">
    <input id="text" placeholder="New task" required>
    <button>Add</button>
  </form>
  <ul id="list"></ul>

  <script>
    const form = document.querySelector("#form");
    const input = document.querySelector("#text");
    const list = document.querySelector("#list");

    let todos = JSON.parse(localStorage.getItem("todos") ?? "[]");

    function save() {
      localStorage.setItem("todos", JSON.stringify(todos));
    }

    function render() {
      list.innerHTML = "";
      for (const todo of todos) {
        const li = document.createElement("li");
        li.dataset.id = todo.id;
        li.className = todo.done ? "done" : "";

        const span = document.createElement("span");
        span.textContent = todo.text; // textContent: safe for user text

        const toggle = document.createElement("button");
        toggle.textContent = todo.done ? "Undo" : "Done";
        toggle.dataset.action = "toggle";

        const remove = document.createElement("button");
        remove.textContent = "Delete";
        remove.dataset.action = "delete";

        li.append(span, " ", toggle, remove);
        list.append(li);
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      todos.push({ id: Date.now(), text, done: false });
      input.value = "";
      save();
      render();
    });

    list.addEventListener("click", (event) => {
      const action = event.target.dataset.action;
      if (!action) return;
      const id = Number(event.target.closest("li").dataset.id);

      if (action === "toggle") {
        todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      } else {
        todos = todos.filter((t) => t.id !== id);
      }
      save();
      render();
    });

    render();
  </script>
</body>
</html>
```
</details>

## Project 4: Quiz app

**Goal:** Show one multiple-choice question at a time, count the score, and show the result at the end.

**Skills:** arrays of objects, creating elements, `index` state, conditionals.

**Hints:**

1. Store questions as `{ question, options: [...], answer: index }`.
2. Keep a `current` index and a `score`.
3. When an option is clicked, check it, add to the score, move to the next question.
4. When `current` reaches the end, show "You scored X of Y".

<details>
<summary>Show solution</summary>

```html
<!DOCTYPE html>
<html>
<body>
  <h2 id="question"></h2>
  <div id="options"></div>
  <p id="result"></p>

  <script>
    const questions = [
      { question: "Which keyword makes a constant?", options: ["var", "let", "const"], answer: 2 },
      { question: "What does 2 + '2' give?", options: ["4", "'22'", "NaN"], answer: 1 },
      { question: "Which method adds to the end of an array?", options: ["push", "shift", "pop"], answer: 0 },
    ];

    let current = 0;
    let score = 0;
    const questionEl = document.querySelector("#question");
    const optionsEl = document.querySelector("#options");
    const resultEl = document.querySelector("#result");

    function showQuestion() {
      const q = questions[current];
      questionEl.textContent = `${current + 1}. ${q.question}`;
      optionsEl.innerHTML = "";

      q.options.forEach((option, i) => {
        const btn = document.createElement("button");
        btn.textContent = option;
        btn.addEventListener("click", () => choose(i));
        optionsEl.append(btn);
      });
    }

    function choose(i) {
      if (i === questions[current].answer) score++;
      current++;

      if (current < questions.length) {
        showQuestion();
      } else {
        questionEl.textContent = "Quiz finished!";
        optionsEl.innerHTML = "";
        resultEl.textContent = `You scored ${score} of ${questions.length}.`;
      }
    }

    showQuestion();
  </script>
</body>
</html>
```
</details>

## Project 5: Weather app with fetch

**Goal:** Type a city name and show the current temperature and wind speed.

**Skills:** forms, `async`/`await`, `fetch`, `response.ok`, error handling.

We use **Open-Meteo**, a free weather API that needs no key. It takes two calls:

1. Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name=Berlin&count=1` gives latitude and longitude.
2. Forecast: `https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current=temperature_2m,wind_speed_10m` gives the weather.

**Hints:**

1. Write a small `getJSON(url)` helper that checks `response.ok`.
2. Use `encodeURIComponent(city)` when putting the city in the URL.
3. If the geocoding result has no `results`, show "City not found".
4. Show "Loading…" while waiting, and errors in a friendly way.

<details>
<summary>Show solution</summary>

```html
<!DOCTYPE html>
<html>
<body>
  <form id="form">
    <input id="city" placeholder="City" required>
    <button>Get weather</button>
  </form>
  <p id="output"></p>

  <script>
    const form = document.querySelector("#form");
    const output = document.querySelector("#output");

    async function getJSON(url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      return response.json();
    }

    async function showWeather(city) {
      const geo = await getJSON(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`
      );
      if (!geo.results?.length) {
        output.textContent = "City not found.";
        return;
      }

      const { latitude, longitude, name, country } = geo.results[0];
      const data = await getJSON(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m`
      );

      const { temperature_2m, wind_speed_10m } = data.current;
      output.textContent =
        `${name}, ${country}: ${temperature_2m}°C, wind ${wind_speed_10m} km/h`;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      output.textContent = "Loading…";
      try {
        await showWeather(document.querySelector("#city").value.trim());
      } catch (error) {
        output.textContent = `Sorry, something went wrong (${error.message}).`;
      }
    });
  </script>
</body>
</html>
```
</details>

## Project 6: Stopwatch

**Goal:** A stopwatch with Start, Stop and Reset that shows `mm:ss.cc` (minutes, seconds, hundredths).

**Skills:** `setInterval`/`clearInterval`, `Date.now()`, string padding, button states.

**Hints:**

1. Don't count ticks; intervals can drift. Save the start time and compute `Date.now() - startTime`.
2. Keep `elapsed` so that Stop then Start continues where it left off.
3. Format with `String(n).padStart(2, "0")`.
4. Disable Start while running so the user can't start two intervals.

<details>
<summary>Show solution</summary>

```html
<!DOCTYPE html>
<html>
<body>
  <h1 id="time">00:00.00</h1>
  <button id="start">Start</button>
  <button id="stop" disabled>Stop</button>
  <button id="reset">Reset</button>

  <script>
    const timeEl = document.querySelector("#time");
    const startBtn = document.querySelector("#start");
    const stopBtn = document.querySelector("#stop");
    const resetBtn = document.querySelector("#reset");

    let intervalId = null;
    let startTime = 0;
    let elapsed = 0; // milliseconds from earlier runs

    const pad = (n) => String(n).padStart(2, "0");

    function format(ms) {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      const hundredths = Math.floor((ms % 1000) / 10);
      return `${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
    }

    function tick() {
      timeEl.textContent = format(elapsed + (Date.now() - startTime));
    }

    startBtn.addEventListener("click", () => {
      startTime = Date.now();
      intervalId = setInterval(tick, 10);
      startBtn.disabled = true;
      stopBtn.disabled = false;
    });

    stopBtn.addEventListener("click", () => {
      clearInterval(intervalId);
      elapsed += Date.now() - startTime;
      startBtn.disabled = false;
      stopBtn.disabled = true;
    });

    resetBtn.addEventListener("click", () => {
      clearInterval(intervalId);
      elapsed = 0;
      timeEl.textContent = format(0);
      startBtn.disabled = false;
      stopBtn.disabled = true;
    });
  </script>
</body>
</html>
```
</details>

> 💡 Tip: Done with all six? Add a feature to each: keyboard shortcuts for the counter, a "clear done" button for the to-do list, a timer per quiz question, lap times for the stopwatch.

## Where to go next

You now know the basics of JavaScript. To go deeper, continue with these lessons in this category:

- **JavaScript Language Fundamentals** — values vs references, coercion, prototypes and more, in depth.
- **Async JavaScript: Promises and async/await** — how async code really works, including on the server.
- **TypeScript in Practice** — add types to JavaScript to catch bugs before you run the code.
- **Node.js and Express** — run JavaScript on the server and build your own APIs.

## Key takeaways

- Building small projects is the fastest way to make the lessons stick.
- Most apps follow the same loop: keep state, change it on events, re-draw the page.
- Use `localStorage` for data that should survive a reload.
- Use `fetch` with `async`/`await`, check `response.ok`, and show loading and error states.
- Base timers on `Date.now()` instead of counting ticks.
