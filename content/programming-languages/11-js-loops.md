---
title: JS Loops
summary: "Learn how to repeat code with for, while, do...while, for...of and for...in loops, how to stop or skip with break and continue, and how to avoid infinite loops."
level: Beginner
tags: [javascript, js-tutorial, loops, iteration]
---

## Why loops?

A **loop** runs the same code again and again. Instead of writing `console.log` five times, you write it once and loop five times.

```js
// Without a loop
console.log("Hello 1");
console.log("Hello 2");
console.log("Hello 3");

// With a loop
for (let i = 1; i <= 3; i++) {
  console.log("Hello " + i);
}
// → Hello 1
// → Hello 2
// → Hello 3
```

Each run of the loop is called an **iteration**.

## The for loop

The classic `for` loop has three parts inside the brackets, separated by `;`.

```js
for (let i = 0; i < 5; i++) {
  console.log(i);
}
// → 0 1 2 3 4  (each on its own line)
```

| Part | Example | When it runs |
| --- | --- | --- |
| Start | `let i = 0` | Once, before the loop begins |
| Condition | `i < 5` | Before each iteration; the loop stops when it is false |
| Update | `i++` | After each iteration |

> 📝 Note: `i++` means "add 1 to `i`". Programmers often call the counter `i` (for "index").

You can count down or jump by more than one, too:

```js
for (let i = 10; i > 0; i -= 3) {
  console.log(i);
}
// → 10 7 4 1
```

## Looping over an array with for

Arrays start at index `0`, so loop while `i` is less than the array's `length`.

```js
const fruits = ["apple", "banana", "cherry"];

for (let i = 0; i < fruits.length; i++) {
  console.log(i, fruits[i]);
}
// → 0 apple
// → 1 banana
// → 2 cherry
```

## The while loop

A `while` loop repeats **as long as** a condition is true. Use it when you don't know in advance how many times to loop.

```js
let coins = 1;

while (coins < 50) {
  coins = coins * 2;
}

console.log(coins); // → 64
```

## The do...while loop

A `do...while` loop runs the code **first**, then checks the condition. So it always runs at least once.

```js
let count = 10;

do {
  console.log("Count is", count);
  count++;
} while (count < 3);
// → Count is 10   (runs once even though 10 < 3 is false)
```

## for...of: loop over values

`for...of` gives you each **value** of an array (or string) directly. No index needed. This is usually the nicest way to loop over an array.

```js
const colors = ["red", "green", "blue"];

for (const color of colors) {
  console.log(color);
}
// → red
// → green
// → blue
```

It works on strings too, one character at a time:

```js
for (const letter of "Hi!") {
  console.log(letter);
}
// → H
// → i
// → !
```

> 💡 Tip: Use `const` in `for...of` because each iteration gets a fresh variable. Use `let` in a classic `for` because `i` changes.

## for...in: loop over object keys

`for...in` gives you each **key** (property name) of an object.

```js
const user = { name: "Sara", age: 28, city: "Dhaka" };

for (const key in user) {
  console.log(key, "=", user[key]);
}
// → name = Sara
// → age = 28
// → city = Dhaka
```

> ⚠️ Watch out: don't use `for...in` for arrays. It gives you the indexes as **strings** (`"0"`, `"1"`…) and can include extra properties. Use `for...of` or a classic `for` for arrays.

## break: stop the loop

`break` jumps out of the loop straight away.

```js
const numbers = [4, 9, 15, 22, 7];

for (const n of numbers) {
  if (n > 10) {
    console.log("First number over 10:", n);
    break;
  }
}
// → First number over 10: 15
```

## continue: skip one round

`continue` skips the rest of the current iteration and moves on to the next one.

```js
for (let i = 1; i <= 6; i++) {
  if (i % 2 === 0) continue; // skip even numbers
  console.log(i);
}
// → 1 3 5
```

## Labels (rarely needed)

With loops inside loops, `break` only stops the inner loop. A **label** lets you break out of the outer one.

```js
outer: for (let row = 1; row <= 3; row++) {
  for (let col = 1; col <= 3; col++) {
    if (row * col === 4) break outer;
    console.log(row, col);
  }
}
// → 1 1
// → 1 2
// → 1 3
// → 2 1
```

> 📝 Note: Labels are uncommon. Often a function with `return` is clearer.

## Avoiding infinite loops

An **infinite loop** never stops, because its condition never becomes false. It freezes the browser tab.

```js
// ❌ Bug: i never changes, so i < 5 is always true
let i = 0;
while (i < 5) {
  console.log(i);
  // forgot i++
}
```

Checklist to stay safe:

1. Make sure something inside the loop changes the condition.
2. Check the direction: counting down needs `i--`, not `i++`.
3. Use `<` (not `<=`) with `array.length`, or you go one step too far.

## A preview: forEach

Arrays also have a method called `forEach` that runs a function for each item. You will learn it fully in the Array Methods lesson.

```js
const pets = ["cat", "dog"];

pets.forEach((pet, index) => {
  console.log(index, pet);
});
// → 0 cat
// → 1 dog
```

> 📝 Note: You cannot use `break` inside `forEach`. If you need to stop early, use `for...of`.

## Which loop should I use?

| Loop | Best for |
| --- | --- |
| `for` | Counting, or when you need the index |
| `for...of` | Going through every value in an array or string |
| `for...in` | Going through the keys of an object |
| `while` | Repeating until something happens (unknown count) |
| `do...while` | Like `while`, but must run at least once |

## Try it in a page

```html
<ul id="list"></ul>

<script>
  const items = ["Milk", "Bread", "Eggs"];
  const list = document.getElementById("list");

  for (const item of items) {
    list.innerHTML += "<li>" + item + "</li>";
  }
</script>
```

## Try it yourself

**1.** Print the numbers from 1 to 10 using a `for` loop.

<details>
<summary>Show solution</summary>

```js
for (let i = 1; i <= 10; i++) {
  console.log(i);
}
```
</details>

**2.** Add up all the numbers in `[5, 10, 15, 20]` with `for...of`.

<details>
<summary>Show solution</summary>

```js
const nums = [5, 10, 15, 20];
let sum = 0;

for (const n of nums) {
  sum += n;
}

console.log(sum); // → 50
```
</details>

**3.** Count how many times the letter `"a"` appears in `"banana"`.

<details>
<summary>Show solution</summary>

```js
let count = 0;

for (const ch of "banana") {
  if (ch === "a") count++;
}

console.log(count); // → 3
```
</details>

## Quick check

<details>
<summary>How many times does <code>for (let i = 0; i &lt; 3; i++)</code> run?</summary>

Three times, with `i` equal to `0`, `1` and `2`.
</details>

<details>
<summary>What is the difference between <code>for...of</code> and <code>for...in</code>?</summary>

`for...of` gives you the **values** of an array or string. `for...in` gives you the **keys** of an object.
</details>

<details>
<summary>Which loop always runs at least once?</summary>

`do...while`, because it checks the condition after running the code.
</details>

## Key takeaways

- A `for` loop has a start, a condition and an update.
- Use `while` when you don't know how many times you'll loop; `do...while` runs at least once.
- `for...of` loops over values (arrays, strings); `for...in` loops over object keys.
- `break` stops a loop; `continue` skips to the next iteration.
- Always make sure the loop condition can become false, or you get an infinite loop.
