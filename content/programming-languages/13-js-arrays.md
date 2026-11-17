---
title: JS Arrays
summary: "Learn how to store lists of values in arrays, read and change items by index, add and remove items, copy and combine arrays, and avoid the classic sort() trap with numbers."
level: Beginner
tags: [javascript, js-tutorial, arrays]
---

## What is an array?

An **array** is an ordered list of values stored in one variable. Write it with square brackets `[]` and commas between the items.

```js
const fruits = ["apple", "banana", "cherry"];
console.log(fruits); // → ["apple", "banana", "cherry"]
```

An array can hold any type of value, even a mix:

```js
const mixed = [42, "hello", true, null];
const empty = [];
```

> 💡 Tip: Use `const` for arrays. You can still change the items inside; `const` only stops you from replacing the whole array.

## Reading items by index

Each item has a position number called an **index**. Indexes start at `0`, not `1`.

```js
const fruits = ["apple", "banana", "cherry"];

console.log(fruits[0]); // → "apple"
console.log(fruits[2]); // → "cherry"
console.log(fruits[5]); // → undefined (no item there)
```

To read from the end, use `at()` with a negative number:

```js
console.log(fruits.at(-1)); // → "cherry" (last item)
console.log(fruits.at(-2)); // → "banana"
```

## length

The `length` property tells you how many items are in the array.

```js
const fruits = ["apple", "banana", "cherry"];
console.log(fruits.length);              // → 3
console.log(fruits[fruits.length - 1]);  // → "cherry" (old way to get the last item)
```

## Changing items

Assign a new value to an index to replace that item.

```js
const fruits = ["apple", "banana", "cherry"];
fruits[1] = "blueberry";
console.log(fruits); // → ["apple", "blueberry", "cherry"]
```

## Adding and removing at the ends

| Method | What it does | Returns |
| --- | --- | --- |
| `push(x)` | Adds to the **end** | the new length |
| `pop()` | Removes from the **end** | the removed item |
| `unshift(x)` | Adds to the **start** | the new length |
| `shift()` | Removes from the **start** | the removed item |

```js
const queue = ["a", "b"];

queue.push("c");          // ["a", "b", "c"]
queue.unshift("z");       // ["z", "a", "b", "c"]
const last = queue.pop(); // last = "c",  queue = ["z", "a", "b"]
const first = queue.shift(); // first = "z", queue = ["a", "b"]

console.log(queue); // → ["a", "b"]
```

## splice: add or remove in the middle

`splice(start, deleteCount, ...newItems)` changes the array in place. It returns an array of the removed items.

```js
const letters = ["a", "b", "c", "d", "e"];

const removed = letters.splice(1, 2); // remove 2 items from index 1
console.log(removed); // → ["b", "c"]
console.log(letters); // → ["a", "d", "e"]

letters.splice(1, 0, "X", "Y");       // insert at index 1, remove nothing
console.log(letters); // → ["a", "X", "Y", "d", "e"]
```

## slice: copy a part

`slice(start, end)` returns a **new** array from `start` up to (but not including) `end`. The original is not changed.

```js
const nums = [10, 20, 30, 40, 50];

console.log(nums.slice(1, 3)); // → [20, 30]
console.log(nums.slice(2));    // → [30, 40, 50]
console.log(nums.slice(-2));   // → [40, 50]
console.log(nums);             // → [10, 20, 30, 40, 50] (unchanged)
```

> 📝 Note: Easy way to remember: **splice** changes the array (it "splices" in surgery). **slice** just takes a copy of a slice.

## Combining arrays

Use `concat()` or the **spread** operator `...` (which "spreads out" the items).

```js
const a = [1, 2];
const b = [3, 4];

console.log(a.concat(b));    // → [1, 2, 3, 4]
console.log([...a, ...b]);   // → [1, 2, 3, 4]
console.log([0, ...a, 99]);  // → [0, 1, 2, 99]
```

## Searching

| Method | What it does | Example |
| --- | --- | --- |
| `includes(x)` | `true` if the item exists | `["a","b"].includes("b")` → `true` |
| `indexOf(x)` | Index of the first match, or `-1` | `["a","b"].indexOf("b")` → `1` |
| `lastIndexOf(x)` | Index of the last match, or `-1` | `[1,2,1].lastIndexOf(1)` → `2` |

```js
const pets = ["cat", "dog", "fish"];

console.log(pets.includes("dog"));  // → true
console.log(pets.indexOf("fish"));  // → 2
console.log(pets.indexOf("bird"));  // → -1
```

## join: array to string

`join(separator)` glues all items into one string.

```js
const words = ["I", "love", "JS"];
console.log(words.join(" "));  // → "I love JS"
console.log(words.join("-"));  // → "I-love-JS"
console.log(words.join());     // → "I,love,JS"
```

The opposite is the string method `split()`: `"a,b,c".split(",")` → `["a", "b", "c"]`.

## Is it an array?

`typeof` says arrays are `"object"`, which isn't helpful. Use `Array.isArray()` instead.

```js
console.log(typeof [1, 2]);         // → "object"
console.log(Array.isArray([1, 2])); // → true
console.log(Array.isArray("hi"));   // → false
```

## Nested arrays

An array can contain other arrays. This is handy for grids and tables.

```js
const grid = [
  [1, 2, 3],
  [4, 5, 6],
];

console.log(grid[1][2]); // → 6  (row 1, column 2)
```

## Arrays are references

When you assign an array to another variable, both names point to the **same** array. Changing one also changes the other.

```js
const original = [1, 2, 3];
const sameArray = original;

sameArray.push(4);
console.log(original); // → [1, 2, 3, 4]  (it changed too!)
```

To make a real copy, use spread:

```js
const copy = [...original];
copy.push(5);
console.log(original); // → [1, 2, 3, 4]
console.log(copy);     // → [1, 2, 3, 4, 5]
```

> ⚠️ Watch out: `[1, 2] === [1, 2]` is `false`. `===` checks if they are the same array in memory, not if they have the same items.

## The sort() gotcha

`sort()` sorts the array in place. By default it sorts items **as strings**, which breaks numbers.

```js
const names = ["Zara", "adam", "Bob"];
names.sort();
console.log(names); // → ["Bob", "Zara", "adam"] (capitals come first)

const nums = [10, 1, 5, 100];
nums.sort();
console.log(nums);  // → [1, 10, 100, 5]  (😬 sorted as text!)
```

Fix it with a **compare function**. It gets two items `a` and `b` and returns a negative number if `a` should come first, or a positive number if `b` should.

```js
const nums = [10, 1, 5, 100];

nums.sort((a, b) => a - b);
console.log(nums); // → [1, 5, 10, 100]  (smallest first)

nums.sort((a, b) => b - a);
console.log(nums); // → [100, 10, 5, 1]  (largest first)
```

> 💡 Tip: `sort()` changes the original array. The Array Methods lesson shows `toSorted()`, which returns a sorted copy instead.

## Try it in a page

```html
<ul id="todo"></ul>

<script>
  const todos = ["Learn arrays", "Practice push/pop"];
  todos.push("Build a project");

  document.getElementById("todo").innerHTML =
    "<li>" + todos.join("</li><li>") + "</li>";
</script>
```

## Try it yourself

**1.** Create `const colors = ["red", "green"]`. Add `"blue"` to the end and `"black"` to the start. Print the array and its length.

<details>
<summary>Show solution</summary>

```js
const colors = ["red", "green"];
colors.push("blue");
colors.unshift("black");
console.log(colors);        // → ["black", "red", "green", "blue"]
console.log(colors.length); // → 4
```
</details>

**2.** From `[1, 2, 3, 4, 5]`, get a new array with only the middle three numbers, without changing the original.

<details>
<summary>Show solution</summary>

```js
const nums = [1, 2, 3, 4, 5];
const middle = nums.slice(1, 4);
console.log(middle); // → [2, 3, 4]
console.log(nums);   // → [1, 2, 3, 4, 5]
```
</details>

**3.** Sort `[40, 3, 25, 100]` from smallest to largest.

<details>
<summary>Show solution</summary>

```js
const values = [40, 3, 25, 100];
values.sort((a, b) => a - b);
console.log(values); // → [3, 25, 40, 100]
```
</details>

## Quick check

<details>
<summary>What is the index of the first item in an array?</summary>

`0`. The last item is at `length - 1`, or use `at(-1)`.
</details>

<details>
<summary>Which changes the original array: <code>slice</code> or <code>splice</code>?</summary>

`splice` changes the original. `slice` returns a new array and leaves the original alone.
</details>

<details>
<summary>Why does <code>[10, 1, 5].sort()</code> give <code>[1, 10, 5]</code>?</summary>

By default, `sort()` compares items as strings, and `"10"` comes before `"5"` in text order. Use `sort((a, b) => a - b)` for numbers.
</details>

## Key takeaways

- Arrays are ordered lists; indexes start at `0` and `at(-1)` gets the last item.
- `push`/`pop` work on the end; `unshift`/`shift` work on the start.
- `splice` changes the array; `slice`, `concat` and spread make new arrays.
- Use `includes`, `indexOf` and `Array.isArray` to search and check.
- Assigning an array copies the reference, not the items; copy with `[...arr]`.
- Always pass a compare function when sorting numbers.
