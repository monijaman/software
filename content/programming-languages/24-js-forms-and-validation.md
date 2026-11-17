---
title: JS Forms & Validation
summary: "Learn how to read form values, handle the submit event, use FormData, and check user input with HTML validation and your own JavaScript rules."
level: Beginner
tags: [javascript, js-tutorial, forms, validation, dom]
---

## Forms and JavaScript

A **form** collects information from the user: a name, an email, a choice. JavaScript can read those values, check them, and show helpful messages before anything is sent.

## Reading input values

Every text field has a `.value` property. It is always a **string**.

```html
<input id="age" type="number" value="25">

<script>
  const age = document.querySelector("#age").value;
  console.log(age);          // → "25"
  console.log(typeof age);   // → "string"
  console.log(Number(age));  // → 25
</script>
```

> ⚠️ Watch out: Even `type="number"` gives you a string. Convert with `Number()` before doing math.

### Checkboxes and radio buttons

For checkboxes and radios, use `.checked` (a boolean).

```html
<input id="terms" type="checkbox">
<input type="radio" name="size" value="S">
<input type="radio" name="size" value="M" checked>

<script>
  console.log(document.querySelector("#terms").checked); // → false

  const size = document.querySelector('input[name="size"]:checked').value;
  console.log(size); // → "M"
</script>
```

### Select boxes

A `<select>` also has `.value`: the value of the chosen option.

```html
<select id="country">
  <option value="bd">Bangladesh</option>
  <option value="de" selected>Germany</option>
</select>

<script>
  console.log(document.querySelector("#country").value); // → "de"
</script>
```

## The submit event

When the user presses a submit button (or Enter in a field), the form fires a `submit` event. By default the browser then **reloads** the page. Use `preventDefault()` to handle it yourself.

```html
<form id="greet">
  <input name="name" placeholder="Your name">
  <button>Send</button>
</form>

<script>
  const form = document.querySelector("#greet");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    console.log(`Hello, ${form.elements.name.value}!`);
  });
</script>
```

Typing "Sara" and pressing Send prints `Hello, Sara!`.

> 💡 Tip: Listen to `submit` on the **form**, not `click` on the button. Then pressing Enter works too.

## FormData

`FormData` collects every field that has a `name` attribute in one go.

```js
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = new FormData(form);
  console.log(data.get("name"));        // → "Sara"

  const values = Object.fromEntries(data);
  console.log(values);                   // → { name: "Sara" }
});
```

> 📝 Note: Fields without a `name` are skipped. An unchecked checkbox is skipped too.

## Built-in HTML validation

HTML can check many things for you, with no JavaScript at all.

| Attribute | What it checks | Example |
| --- | --- | --- |
| `required` | Field must not be empty | `<input required>` |
| `type="email"` | Looks like an email | `<input type="email">` |
| `type="number"` | Must be a number | `<input type="number">` |
| `min` / `max` | Number range | `<input type="number" min="18">` |
| `minlength` / `maxlength` | Text length | `<input minlength="8">` |
| `pattern` | Must match a regular expression | `<input pattern="[0-9]{5}">` |

If a rule fails, the browser blocks submit and shows a bubble message.

```html
<form>
  <input type="email" required placeholder="Email">
  <input type="number" min="18" placeholder="Age">
  <button>Join</button>
</form>
```

## The Constraint Validation API

JavaScript can ask the browser about these rules.

| Method / property | What it does |
| --- | --- |
| `input.checkValidity()` | Returns `true` if the field passes all rules |
| `form.checkValidity()` | Returns `true` if every field passes |
| `input.validity` | Object with details, e.g. `valueMissing`, `typeMismatch` |
| `input.validationMessage` | The browser's error text |
| `input.setCustomValidity(msg)` | Sets your own error; `""` clears it |

```js
const email = document.querySelector("#email");
email.value = "not-an-email";

console.log(email.checkValidity());       // → false
console.log(email.validity.typeMismatch); // → true
```

### Your own message

```js
const password = document.querySelector("#password");

password.addEventListener("input", () => {
  if (password.value.length < 8) {
    password.setCustomValidity("Use at least 8 characters.");
  } else {
    password.setCustomValidity(""); // valid again
  }
});
```

> ⚠️ Watch out: Always clear it with `setCustomValidity("")`, or the field stays invalid forever.

## Custom error messages in the page

Browser bubbles look different in every browser. Many sites show their own message under the field instead. Add `novalidate` to the form to turn off the bubbles, then check in JavaScript.

```js
function showError(input, message) {
  const errorEl = document.querySelector(`#${input.id}-error`);
  errorEl.textContent = message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
}
```

> 📝 Note: `aria-invalid` tells screen readers the field has a problem.

## Full example: a sign-up form

Copy this into a file and open it in your browser.

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    .error { color: crimson; font-size: 0.9em; min-height: 1.2em; }
    input[aria-invalid="true"] { border-color: crimson; }
  </style>
</head>
<body>
  <form id="signup" novalidate>
    <label>Name <input id="name" name="name" required></label>
    <p class="error" id="name-error"></p>

    <label>Email <input id="email" name="email" type="email" required></label>
    <p class="error" id="email-error"></p>

    <label>Password <input id="password" name="password" type="password" minlength="8" required></label>
    <p class="error" id="password-error"></p>

    <label>Repeat password <input id="confirm" name="confirm" type="password" required></label>
    <p class="error" id="confirm-error"></p>

    <button>Sign up</button>
    <p id="result"></p>
  </form>

  <script>
    const form = document.querySelector("#signup");

    function showError(input, message) {
      document.querySelector(`#${input.id}-error`).textContent = message;
      input.setAttribute("aria-invalid", message ? "true" : "false");
    }

    function validate() {
      const { name, email, password, confirm } = form.elements;
      let ok = true;

      const checks = [
        [name, name.value.trim() === "" ? "Please enter your name." : ""],
        [email, !email.checkValidity() ? "Please enter a valid email." : ""],
        [password, password.value.length < 8 ? "At least 8 characters." : ""],
        [confirm, confirm.value !== password.value ? "Passwords do not match." : ""],
      ];

      for (const [input, message] of checks) {
        showError(input, message);
        if (message) ok = false;
      }
      return ok;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!validate()) return;

      const data = Object.fromEntries(new FormData(form));
      delete data.confirm;
      document.querySelector("#result").textContent =
        `Welcome, ${data.name}! (Ready to send to the server.)`;
    });
  </script>
</body>
</html>
```

> 💡 Tip: To send the data, you would use `fetch` with a POST request. You will learn that in the Async JS lesson.

## The server must check too

JavaScript validation is for the **user's comfort**: fast feedback, no waiting. It is **not** security. Anyone can turn off JavaScript or send a request directly to your server.

> ⚠️ Watch out: Always validate again on the server. Never trust data just because the browser checked it.

## Try it yourself

1. Log whether the checkbox `#news` is checked when the form is submitted.

<details>
<summary>Show solution</summary>

```js
form.addEventListener("submit", (event) => {
  event.preventDefault();
  console.log(document.querySelector("#news").checked);
});
```
</details>

2. Show "Too short" under a username field while the user types, if it has fewer than 3 characters.

<details>
<summary>Show solution</summary>

```js
const username = document.querySelector("#username");
const error = document.querySelector("#username-error");

username.addEventListener("input", () => {
  error.textContent = username.value.length < 3 ? "Too short" : "";
});
```
</details>

3. Turn a form into a plain object and log it.

<details>
<summary>Show solution</summary>

```js
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  console.log(values);
});
```
</details>

## Quick check

<details>
<summary>What type is input.value, even for type="number"?</summary>

Always a string. Convert it with `Number()` if you need a number.
</details>

<details>
<summary>What does setCustomValidity("") do?</summary>

It clears your custom error, so the field can become valid again.
</details>

<details>
<summary>Is browser validation enough to keep bad data out?</summary>

No. Users can bypass it. The server must validate too.
</details>

## Key takeaways

- Read text with `.value`, checkboxes and radios with `.checked`.
- Handle the form's `submit` event and call `preventDefault()`.
- `FormData` + `Object.fromEntries` turns a form into an object.
- HTML attributes like `required`, `type`, `min` and `pattern` give free validation.
- `checkValidity()` and `setCustomValidity()` let JavaScript work with those rules.
- Client checks help users; the server must still validate everything.
