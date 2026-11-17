---
title: JS Numbers & Math
summary: "Learn how JavaScript stores numbers, why 0.1 + 0.2 looks strange, how to turn text into numbers, and how to use the built-in Math object for rounding and random numbers."
level: Beginner
tags: [javascript, js-tutorial, numbers, math]
---

## One number type

JavaScript has just one main number type, called `number`. Whole numbers (integers) and numbers with a decimal point use the same type.

```js
const age = 30;        // an integer
const price = 9.99;    // a decimal
const big = 2.5e6;     // 2.5 × 1,000,000

console.log(typeof age);   // → "number"
console.log(typeof price); // → "number"
console.log(big);          // → 2500000
```

> 📝 Note: `2.5e6` is "scientific notation". The `e6` means "times 10 to the power 6".

## Basic arithmetic

You can do maths with the usual operators. The full list is in the Operators lesson.

```js
console.log(10 + 5);  // → 15
console.log(10 - 5);  // → 5
console.log(10 * 5);  // → 50
console.log(10 / 4);  // → 2.5
console.log(10 % 3);  // → 1   (remainder)
console.log(2 ** 3);  // → 8   (2 to the power 3)
```

## The 0.1 + 0.2 surprise

Computers store decimals in binary (ones and zeros). Some decimals, like 0.1, cannot be stored exactly, so tiny errors appear. This is called **floating point** error.

```js
console.log(0.1 + 0.2);          // → 0.30000000000000004
console.log(0.1 + 0.2 === 0.3);  // → false
```

This happens in almost every programming language, not just JavaScript. A simple fix for display is to round the result.

```js
const total = 0.1 + 0.2;
console.log(total.toFixed(2));          // → "0.30"
console.log(Math.round(total * 100) / 100); // → 0.3
```

> 💡 Tip: For money, work in whole cents (`999` instead of `9.99`) and divide by 100 only when you show the value.

## NaN: "Not a Number"

`NaN` is a special value that means "this maths did not make sense". It is still of type `number`, which surprises many beginners.

```js
console.log(10 / "apple");  // → NaN
console.log(Number("hi"));  // → NaN
console.log(typeof NaN);    // → "number"
```

`NaN` is not equal to anything, not even itself. Use `Number.isNaN()` to check for it.

```js
console.log(NaN === NaN);         // → false
console.log(Number.isNaN(NaN));   // → true
console.log(Number.isNaN(42));    // → false
```

## Infinity

If a number gets too big, or you divide by zero, you get `Infinity`.

```js
console.log(1 / 0);       // → Infinity
console.log(-1 / 0);      // → -Infinity
console.log(2 ** 1024);   // → Infinity
```

## Formatting numbers

A **method** is a function that belongs to a value. Numbers have a few handy ones.

| Method | What it does | Example |
| --- | --- | --- |
| `toFixed(n)` | Rounds to `n` decimals, returns a string | `(3.14159).toFixed(2)` → `"3.14"` |
| `toString()` | Turns the number into a string | `(42).toString()` → `"42"` |
| `toString(2)` | Writes the number in another base | `(5).toString(2)` → `"101"` |
| `toLocaleString()` | Adds separators for the user's region | `(1234567).toLocaleString("en-US")` → `"1,234,567"` |

```js
const pi = 3.14159;
console.log(pi.toFixed(2));  // → "3.14"
console.log(pi.toFixed(0));  // → "3"
```

> ⚠️ Watch out: `toFixed()` returns a **string**, not a number. Use it for showing values, not for more maths.

## Turning text into numbers

Values from forms and prompts arrive as strings. You need to convert them before doing maths.

```js
console.log("5" + 3);          // → "53"  (joined as text!)
console.log(Number("5") + 3);  // → 8
```

| Function | What it does | Example |
| --- | --- | --- |
| `Number(x)` | Converts the whole value; fails with `NaN` if any part is not a number | `Number("42px")` → `NaN` |
| `parseInt(x, 10)` | Reads a whole number from the start of a string | `parseInt("42px", 10)` → `42` |
| `parseFloat(x)` | Reads a decimal number from the start of a string | `parseFloat("3.5kg")` → `3.5` |

```js
console.log(Number(""));         // → 0
console.log(Number("12.5"));     // → 12.5
console.log(parseInt("12.5", 10)); // → 12
console.log(parseFloat("12.5")); // → 12.5
console.log(parseInt("abc", 10)); // → NaN
```

> 💡 Tip: Always pass `10` as the second argument to `parseInt`. It means "read this as a normal base-10 number".

## Checking numbers

```js
console.log(Number.isInteger(5));     // → true
console.log(Number.isInteger(5.5));   // → false
console.log(Number.isNaN("hello"));   // → false (it's a string, not NaN)
console.log(Number.isFinite(1 / 0));  // → false
```

> ⚠️ Watch out: avoid the old global `isNaN("hello")`. It converts the value first and returns `true`, which is confusing. Prefer `Number.isNaN()`.

## Very big whole numbers: BigInt

Normal numbers are only exact up to `Number.MAX_SAFE_INTEGER` (9007199254740991). For larger whole numbers, add `n` to the end to make a **BigInt**.

```js
console.log(9007199254740991 + 2);   // → 9007199254740992 (wrong!)
console.log(9007199254740991n + 2n); // → 9007199254740993n
```

> 📝 Note: You cannot mix BigInt and normal numbers in one sum. `1n + 1` throws an error. Most programs never need BigInt.

## The Math object

`Math` is a built-in object full of maths tools. You don't create it; just use `Math.something()`.

| Method | What it does | Example |
| --- | --- | --- |
| `Math.round(x)` | Rounds to the nearest whole number | `Math.round(4.5)` → `5` |
| `Math.floor(x)` | Rounds down | `Math.floor(4.9)` → `4` |
| `Math.ceil(x)` | Rounds up | `Math.ceil(4.1)` → `5` |
| `Math.trunc(x)` | Cuts off the decimal part | `Math.trunc(-4.7)` → `-4` |
| `Math.abs(x)` | Removes the minus sign | `Math.abs(-7)` → `7` |
| `Math.min(a, b, …)` | Smallest value | `Math.min(3, 1, 2)` → `1` |
| `Math.max(a, b, …)` | Largest value | `Math.max(3, 1, 2)` → `3` |
| `Math.pow(x, y)` | `x` to the power `y` (same as `x ** y`) | `Math.pow(2, 4)` → `16` |
| `Math.sqrt(x)` | Square root | `Math.sqrt(81)` → `9` |
| `Math.random()` | Random decimal from 0 up to (not including) 1 | `0.7342…` |

```js
console.log(Math.floor(-4.7)); // → -5
console.log(Math.trunc(-4.7)); // → -4
console.log(Math.PI);          // → 3.141592653589793
```

> 📝 Note: `floor` and `trunc` only differ for negative numbers. `floor` always goes down; `trunc` just drops the decimals.

To find the biggest number in an array, spread it into `Math.max`:

```js
const scores = [12, 45, 7];
console.log(Math.max(...scores)); // → 45
```

## Random integer in a range

`Math.random()` gives a decimal like `0.53`. To get a whole number between `min` and `max` (both included), use this recipe:

```js
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

console.log(randomInt(1, 6)); // → a dice roll: 1, 2, 3, 4, 5 or 6
```

How it works for a dice (min 1, max 6):

1. `Math.random() * 6` gives a decimal from 0 up to 5.999…
2. `Math.floor(...)` turns that into 0, 1, 2, 3, 4 or 5.
3. `+ 1` shifts it to 1–6.

Try it in a page:

```html
<button onclick="document.getElementById('out').textContent = Math.floor(Math.random() * 6) + 1">
  Roll the dice
</button>
<p id="out">?</p>
```

## Try it yourself

**1.** A user typed `"19.99"` and `"5"` into two boxes. Add them as numbers and show the total with 2 decimals.

<details>
<summary>Show solution</summary>

```js
const a = "19.99";
const b = "5";
const total = Number(a) + Number(b);
console.log(total.toFixed(2)); // → "24.99"
```
</details>

**2.** Round `7.456` to 1 decimal place as a number (not a string).

<details>
<summary>Show solution</summary>

```js
const value = 7.456;
console.log(Math.round(value * 10) / 10); // → 7.5
```
</details>

**3.** Write a function `coinFlip()` that returns `"heads"` or `"tails"` at random.

<details>
<summary>Show solution</summary>

```js
const coinFlip = () => (Math.random() < 0.5 ? "heads" : "tails");
console.log(coinFlip()); // → "heads" or "tails"
```
</details>

## Quick check

<details>
<summary>What does <code>parseInt("50px", 10)</code> return? What about <code>Number("50px")</code>?</summary>

`parseInt` returns `50` because it reads digits until it hits something else. `Number` returns `NaN` because the whole string is not a number.
</details>

<details>
<summary>Why is <code>0.1 + 0.2 === 0.3</code> false?</summary>

Decimals are stored in binary, so 0.1 and 0.2 are a tiny bit off. Their sum is `0.30000000000000004`, not exactly `0.3`.
</details>

<details>
<summary>What is the difference between <code>Math.floor(-2.5)</code> and <code>Math.trunc(-2.5)</code>?</summary>

`Math.floor(-2.5)` is `-3` (it goes down). `Math.trunc(-2.5)` is `-2` (it just removes the decimals).
</details>

## Key takeaways

- JavaScript uses one `number` type for integers and decimals.
- Decimal maths can be slightly off (`0.1 + 0.2`); round when you display results.
- `NaN` means a failed calculation; check it with `Number.isNaN()`.
- Convert text with `Number()`, `parseInt(x, 10)` or `parseFloat()` before doing maths.
- `toFixed()` formats numbers but returns a string.
- `Math.floor(Math.random() * (max - min + 1)) + min` gives a random integer in a range.
