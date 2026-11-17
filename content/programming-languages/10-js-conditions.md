---
title: JS Booleans, If/Else & Switch
summary: "Learn how JavaScript makes decisions with true and false, if/else, the ternary operator and switch, and how to pick the right one for clean, readable code."
level: Beginner
tags: [javascript, js-tutorial, booleans, conditions, if-else, switch]
---

## Booleans

A **boolean** is a value that is either `true` or `false`. Nothing else. Booleans are how a program answers yes/no questions.

```js
const isLoggedIn = true;
const hasPaid = false;

console.log(typeof isLoggedIn); // → "boolean"
```

> 💡 Tip: Name boolean variables like questions: `isOpen`, `hasItems`, `canEdit`. The code then reads like English.

## Comparisons give booleans

Comparison operators compare two values and return `true` or `false`.

| Operator | Meaning | Example | Result |
| --- | --- | --- | --- |
| `===` | equal (same value and type) | `5 === 5` | `true` |
| `!==` | not equal | `5 !== "5"` | `true` |
| `>` | greater than | `10 > 3` | `true` |
| `<` | less than | `10 < 3` | `false` |
| `>=` | greater than or equal | `5 >= 5` | `true` |
| `<=` | less than or equal | `4 <= 3` | `false` |

```js
const age = 20;
console.log(age >= 18);  // → true
console.log(age === 21); // → false
```

> ⚠️ Watch out: avoid `==` and `!=`. They convert types first, so `"5" == 5` is `true`. Always use `===` and `!==`.

## Truthy and falsy

In a condition, JavaScript turns any value into a boolean. Values that become `false` are called **falsy**. Everything else is **truthy**.

There are only a few falsy values. Learn this list:

| Falsy value | What it is |
| --- | --- |
| `false` | the boolean false |
| `0` and `-0` | zero |
| `0n` | BigInt zero |
| `""` | an empty string |
| `null` | "no value on purpose" |
| `undefined` | "no value yet" |
| `NaN` | "not a number" |

```js
console.log(Boolean(""));       // → false
console.log(Boolean("hello"));  // → true
console.log(Boolean(0));        // → false
console.log(Boolean([]));       // → true  (an empty array is truthy!)
console.log(Boolean("0"));      // → true  (a non-empty string)
```

> 📝 Note: Empty arrays `[]` and empty objects `{}` are truthy. To check an empty array, use `list.length === 0`.

## if

The `if` statement runs a block of code only when a condition is true.

```js
const temperature = 32;

if (temperature > 30) {
  console.log("It's hot today!");
}
// → It's hot today!
```

## if...else

Add `else` to run different code when the condition is false.

```js
const hour = 20;

if (hour < 18) {
  console.log("Good day");
} else {
  console.log("Good evening");
}
// → Good evening
```

## else if

Use `else if` to test several conditions in order. JavaScript runs the **first** block whose condition is true, then skips the rest.

```js
const score = 72;

if (score >= 90) {
  console.log("A");
} else if (score >= 70) {
  console.log("B");
} else if (score >= 50) {
  console.log("C");
} else {
  console.log("Fail");
}
// → B
```

> 💡 Tip: Order matters. Put the strictest check first. If `score >= 50` came first, a 95 would print "C".

## Logical operators in conditions

Combine conditions with `&&` (and), `||` (or) and `!` (not).

| Operator | Name | True when… |
| --- | --- | --- |
| `a && b` | AND | both are true |
| `a \|\| b` | OR | at least one is true |
| `!a` | NOT | `a` is false |

```js
const age = 25;
const hasTicket = true;

if (age >= 18 && hasTicket) {
  console.log("Welcome to the concert");
}
// → Welcome to the concert

const day = "Sunday";
if (day === "Saturday" || day === "Sunday") {
  console.log("Weekend!");
}
// → Weekend!

if (!hasTicket) {
  console.log("Please buy a ticket");
}
// (nothing printed, because hasTicket is true)
```

## The ternary operator

The **ternary** operator is a short `if...else` that gives back a value. It has three parts: `condition ? valueIfTrue : valueIfFalse`.

```js
const age = 16;
const label = age >= 18 ? "adult" : "minor";
console.log(label); // → "minor"
```

> ⚠️ Watch out: don't nest ternaries inside ternaries. It quickly becomes hard to read. Use `if...else` instead.

## switch

A `switch` compares one value against many possible matches (called **cases**). It is neat when you check the same variable many times.

```js
const day = 3;
let name;

switch (day) {
  case 1:
    name = "Monday";
    break;
  case 2:
    name = "Tuesday";
    break;
  case 3:
    name = "Wednesday";
    break;
  default:
    name = "Another day";
}

console.log(name); // → "Wednesday"
```

- `break` stops the switch. Without it, the code keeps running into the next case.
- `default` runs when no case matches, like a final `else`.
- `switch` uses strict comparison (`===`), so `case "3"` would not match the number `3`.

## Fall-through

When you leave out `break`, code "falls through" to the next case. You can use this on purpose to group cases.

```js
const fruit = "lemon";

switch (fruit) {
  case "lemon":
  case "lime":
    console.log("Sour");
    break;
  case "mango":
    console.log("Sweet");
    break;
  default:
    console.log("Unknown taste");
}
// → Sour
```

> ⚠️ Watch out: forgetting `break` by accident is a classic bug. Every case should end with `break` (or `return`) unless you group cases on purpose.

## Which one should I use?

| Use | When |
| --- | --- |
| `if` / `else` | Most decisions, especially with ranges (`>`, `<`) or mixed conditions |
| ternary `? :` | Picking one of two **values** in a single short line |
| `switch` | Comparing one value against many exact matches |

## Guard clauses

A **guard clause** is an early `return` that handles a bad or special case first. It keeps the main code flat instead of deeply nested.

```js
// Nested version (harder to read)
function getDiscount(user) {
  if (user) {
    if (user.isMember) {
      return 10;
    } else {
      return 0;
    }
  } else {
    return 0;
  }
}

// Guard clause version (easier to read)
function getDiscountClean(user) {
  if (!user) return 0;
  if (!user.isMember) return 0;
  return 10;
}

console.log(getDiscountClean({ isMember: true })); // → 10
console.log(getDiscountClean(null));               // → 0
```

## Try it in a page

```html
<input id="age" type="number" placeholder="Your age">
<button onclick="check()">Check</button>
<p id="result"></p>

<script>
  function check() {
    const age = Number(document.getElementById("age").value);
    const message = age >= 18 ? "You can vote." : "Too young to vote.";
    document.getElementById("result").textContent = message;
  }
</script>
```

## Try it yourself

**1.** Given `const n = 7;`, print `"even"` or `"odd"`.

<details>
<summary>Show solution</summary>

```js
const n = 7;
if (n % 2 === 0) {
  console.log("even");
} else {
  console.log("odd");
}
// → odd
```
</details>

**2.** Write a `switch` that turns a traffic light colour (`"red"`, `"yellow"`, `"green"`) into an action (`"Stop"`, `"Slow down"`, `"Go"`), with `"Unknown"` as the default.

<details>
<summary>Show solution</summary>

```js
const light = "yellow";
let action;

switch (light) {
  case "red":
    action = "Stop";
    break;
  case "yellow":
    action = "Slow down";
    break;
  case "green":
    action = "Go";
    break;
  default:
    action = "Unknown";
}

console.log(action); // → "Slow down"
```
</details>

**3.** Use a ternary to set `const fee` to `0` if `isStudent` is true, otherwise `15`.

<details>
<summary>Show solution</summary>

```js
const isStudent = true;
const fee = isStudent ? 0 : 15;
console.log(fee); // → 0
```
</details>

## Quick check

<details>
<summary>Is the string <code>"false"</code> truthy or falsy?</summary>

Truthy. It is a non-empty string. Only the empty string `""` is falsy.
</details>

<details>
<summary>What happens if you forget <code>break</code> in a switch case?</summary>

The code keeps running into the next case (fall-through) until it hits a `break` or the end of the switch.
</details>

<details>
<summary>What does <code>10 > 5 &amp;&amp; 3 > 8</code> give?</summary>

`false`. `&&` needs both sides to be true, and `3 > 8` is false.
</details>

## Key takeaways

- Booleans are `true` or `false`; comparisons like `===` and `>` produce them.
- Only a handful of values are falsy: `false`, `0`, `""`, `null`, `undefined`, `NaN` (and `0n`, `-0`).
- `if / else if / else` runs the first matching block, so order your checks carefully.
- Use the ternary for picking between two values, not for complex logic.
- `switch` needs `break` in each case; `default` handles everything else.
- Guard clauses (early `return`) keep code flat and readable.
