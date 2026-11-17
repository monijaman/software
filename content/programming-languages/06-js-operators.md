---
title: JS Operators
summary: "Learn the JavaScript operators for math, assignment, comparison and logic, plus the ternary, nullish and typeof operators."
level: Beginner
tags: [javascript, js-tutorial, operators]
---

## What is an operator?

An **operator** is a symbol that does something with values. The values it works on are called **operands**.

```js
let sum = 5 + 3;
console.log(sum); // → 8
```

Here `+` is the operator, and `5` and `3` are the operands.

## Arithmetic operators

Arithmetic operators do math.

| Operator | Name | Example | Result |
|---|---|---|---|
| `+` | Addition | `7 + 2` | `9` |
| `-` | Subtraction | `7 - 2` | `5` |
| `*` | Multiplication | `7 * 2` | `14` |
| `/` | Division | `7 / 2` | `3.5` |
| `%` | Remainder | `7 % 2` | `1` |
| `**` | Exponent (power) | `7 ** 2` | `49` |

### Remainder `%`

`%` gives what is **left over** after division. It is great for checking if a number is even.

```js
console.log(10 % 3); // → 1  (10 = 3 + 3 + 3, with 1 left)
console.log(8 % 2);  // → 0  (8 is even)
console.log(9 % 2);  // → 1  (9 is odd)
```

### Exponent `**`

`**` raises a number to a power.

```js
console.log(2 ** 3);  // → 8  (2 × 2 × 2)
console.log(10 ** 2); // → 100
```

## Increment and decrement

`++` adds 1 to a variable. `--` subtracts 1.

```js
let count = 5;
count++;
console.log(count); // → 6
count--;
console.log(count); // → 5
```

> ⚠️ Watch out: `count++` returns the **old** value, then adds 1. `++count` adds 1 first, then returns the new value.

```js
let a = 5;
console.log(a++); // → 5  (prints old value)
console.log(a);   // → 6

let b = 5;
console.log(++b); // → 6  (adds first)
```

## Assignment operators

Assignment operators put a value into a variable. The short forms update a variable using its own value.

| Operator | Example | Same as |
|---|---|---|
| `=` | `x = 5` | `x = 5` |
| `+=` | `x += 3` | `x = x + 3` |
| `-=` | `x -= 3` | `x = x - 3` |
| `*=` | `x *= 3` | `x = x * 3` |
| `/=` | `x /= 3` | `x = x / 3` |
| `%=` | `x %= 3` | `x = x % 3` |
| `**=` | `x **= 3` | `x = x ** 3` |

```js
let points = 10;
points += 5;  // 15
points *= 2;  // 30
points -= 4;  // 26
console.log(points); // → 26
```

## String concatenation with `+`

When used with strings (text), `+` joins them together. Joining is called **concatenation**.

```js
const first = "Ada";
const last = "Lovelace";
console.log(first + " " + last); // → Ada Lovelace

let greeting = "Hello";
greeting += ", world!";
console.log(greeting); // → Hello, world!
```

### The number + string gotcha

If **either** side of `+` is a string, JavaScript turns the other side into a string too.

```js
console.log(5 + 5);     // → 10
console.log("5" + 5);   // → "55"
console.log(5 + "5");   // → "55"
console.log(1 + 2 + "3"); // → "33"  (1 + 2 = 3, then "3" + "3")
console.log("1" + 2 + 3); // → "123"
```

Other math operators turn strings into numbers instead:

```js
console.log("10" - 2); // → 8
console.log("4" * "2"); // → 8
```

> 💡 Tip: Values from forms and inputs are always strings. Convert them with `Number()` before adding: `Number("5") + 5` gives `10`.

## Comparison operators

Comparison operators compare two values and give back `true` or `false`.

| Operator | Meaning | Example | Result |
|---|---|---|---|
| `===` | Equal (value **and** type) | `5 === 5` | `true` |
| `!==` | Not equal (value or type) | `5 !== "5"` | `true` |
| `==` | Loosely equal | `5 == "5"` | `true` |
| `!=` | Loosely not equal | `5 != "5"` | `false` |
| `>` | Greater than | `7 > 3` | `true` |
| `<` | Less than | `7 < 3` | `false` |
| `>=` | Greater than or equal | `5 >= 5` | `true` |
| `<=` | Less than or equal | `4 <= 3` | `false` |

### `==` vs `===`

`==` converts types before comparing, which leads to strange results. `===` compares without converting.

```js
console.log(5 == "5");   // → true   (string turned into a number)
console.log(5 === "5");  // → false  (number vs string)
console.log(0 == false); // → true
console.log(0 === false); // → false
console.log("" == 0);    // → true  😬
```

> ⚠️ Watch out: Always use `===` and `!==`. Avoid `==` and `!=`.

## Logical operators

Logical operators combine `true`/`false` values.

| Operator | Name | True when… |
|---|---|---|
| `&&` | AND | **both** sides are true |
| `\|\|` | OR | **at least one** side is true |
| `!` | NOT | flips true to false and false to true |

```js
const age = 20;
const hasTicket = true;

console.log(age >= 18 && hasTicket); // → true
console.log(age < 12 || hasTicket);  // → true
console.log(!hasTicket);             // → false
```

`||` is also used to give a fallback value:

```js
const nickname = "";
console.log(nickname || "Guest"); // → Guest
```

## The ternary operator `? :`

The **ternary operator** is a short `if/else` in one line: `condition ? valueIfTrue : valueIfFalse`.

```js
const temp = 30;
const advice = temp > 25 ? "Wear shorts" : "Take a jacket";
console.log(advice); // → Wear shorts
```

## Nullish coalescing `??`

`??` gives a fallback **only** when the left side is `null` or `undefined`.

```js
const savedVolume = 0;

console.log(savedVolume || 50); // → 50  (0 counts as "falsy", so it is replaced)
console.log(savedVolume ?? 50); // → 0   (0 is a real value, so it is kept)

let theme;
console.log(theme ?? "light"); // → light
```

> 💡 Tip: Use `??` when `0`, `""` or `false` are valid values you want to keep.

## The `typeof` operator

`typeof` tells you the type of a value, as a string.

```js
console.log(typeof 42);        // → "number"
console.log(typeof "hi");      // → "string"
console.log(typeof true);      // → "boolean"
console.log(typeof undefined); // → "undefined"
```

You will see the full list in the Data Types lesson.

## Operator precedence

**Precedence** decides which operator runs first, like in school math.

| Order | Operators | Example |
|---|---|---|
| 1 (first) | `( )` grouping | `(2 + 3) * 4` → `20` |
| 2 | `++` `--` `!` `typeof` | `!true` → `false` |
| 3 | `**` | `2 * 3 ** 2` → `18` |
| 4 | `*` `/` `%` | `2 + 3 * 4` → `14` |
| 5 | `+` `-` | `10 - 2 + 1` → `9` |
| 6 | `<` `>` `<=` `>=` | |
| 7 | `===` `!==` `==` `!=` | |
| 8 | `&&` | |
| 9 | `\|\|` `??` | |
| 10 | `? :` | |
| 11 (last) | `=` `+=` `-=` … | |

```js
console.log(2 + 3 * 4);   // → 14
console.log((2 + 3) * 4); // → 20
```

> 📝 Note: When unsure, add parentheses. They make the order clear to everyone.

## Try it yourself

**Task 1:** Check if `17` is even or odd using `%` and the ternary operator.

<details>
<summary>Show solution</summary>

```js
const n = 17;
console.log(n % 2 === 0 ? "even" : "odd"); // → odd
```
</details>

**Task 2:** Fix this so it prints `15`, not `"105"`.

```js
const input = "10";
console.log(input + 5);
```

<details>
<summary>Show solution</summary>

```js
const input = "10";
console.log(Number(input) + 5); // → 15
```
</details>

**Task 3:** A user can enter if they are 18 or older **and** have a ticket, **or** if they are a VIP. Write the check.

<details>
<summary>Show solution</summary>

```js
const age = 16;
const hasTicket = true;
const isVip = true;

const canEnter = (age >= 18 && hasTicket) || isVip;
console.log(canEnter); // → true
```
</details>

## Quick check

<details>
<summary>What is <code>"3" + 4</code>?</summary>

`"34"`, a string. The `+` joins them because one side is a string.
</details>

<details>
<summary>What is the difference between <code>||</code> and <code>??</code> for fallbacks?</summary>

`||` replaces any falsy value (`0`, `""`, `false`, `null`, `undefined`). `??` replaces only `null` and `undefined`.
</details>

<details>
<summary>What does <code>10 % 4</code> return?</summary>

`2`, the remainder after dividing 10 by 4.
</details>

## Key takeaways

- Arithmetic: `+ - * / % **`, plus `++` and `--` to add or subtract 1.
- `+=`, `-=` and friends are short ways to update a variable.
- `+` with a string joins text: `"5" + 5` is `"55"`.
- Always compare with `===` and `!==`.
- `&&`, `||`, `!` combine conditions; `? :` is a one-line if/else.
- Use `??` for fallbacks when `0` or `""` are valid values.
