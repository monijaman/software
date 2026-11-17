---
title: JS Regular Expressions
summary: "Learn to search, check and replace text with regular expressions: how to write patterns, use flags and groups, and apply them to everyday tasks."
level: Intermediate
tags: [javascript, js-tutorial, regex, strings]
---

## What is a regular expression?

A **regular expression** (regex for short) is a **pattern** that describes text. You use it to find, check or replace pieces of a string.

For example, the pattern `/\d+/` means "one or more digits".

```js
const text = "Order 42 shipped";
console.log(text.match(/\d+/)[0]); // → "42"
```

## Creating a regex

There are two ways.

```js
// 1. Literal: between slashes, flags at the end
const re1 = /cat/i;

// 2. Constructor: from a string (useful when the pattern is in a variable)
const word = "cat";
const re2 = new RegExp(word, "i");

console.log(re1.test("Cat")); // → true
console.log(re2.test("Cat")); // → true
```

> ⚠️ Watch out: In a string, backslashes must be doubled. `/\d+/` becomes `new RegExp("\\d+")`.

## Methods you will use

| Method | What it does | Example | Result |
| --- | --- | --- | --- |
| `regex.test(str)` | Does it match? | `/ai/.test("rain")` | `true` |
| `str.match(regex)` | First match (or all with `g`) | `"a1b2".match(/\d/g)` | `["1", "2"]` |
| `str.matchAll(regex)` | All matches with details (needs `g`) | see below | an iterator |
| `str.replace(regex, new)` | Replace match(es) | `"a-b".replace(/-/, "+")` | `"a+b"` |
| `str.split(regex)` | Split by a pattern | `"a1b2c".split(/\d/)` | `["a", "b", "c"]` |
| `str.search(regex)` | Index of first match | `"hello".search(/l/)` | `2` |

### test

```js
console.log(/cat/.test("concatenate")); // → true
console.log(/dog/.test("concatenate")); // → false
```

### match

Without `g` you get the first match. With `g` you get an array of all matches.

```js
const text = "The rain in Spain";
console.log(text.match(/ain/)[0]); // → "ain"
console.log(text.match(/ain/g));   // → ["ain", "ain"]
console.log(text.match(/xyz/g));   // → null
```

> ⚠️ Watch out: `match` returns `null` when nothing is found. Check before using the result.

### matchAll

`matchAll` gives every match **with its groups**. Loop over it with `for...of`.

```js
const text = "a1 b2 c3";

for (const m of text.matchAll(/([a-z])(\d)/g)) {
  console.log(m[1], m[2]);
}
// → a 1
// → b 2
// → c 3
```

### replace and split

```js
console.log("hello world".replace(/o/g, "0"));    // → "hell0 w0rld"
console.log("a, b,c ,  d".split(/\s*,\s*/));      // → ["a", "b", "c", "d"]
```

## Flags

Flags go after the closing slash and change how the pattern works.

| Flag | Name | What it does |
| --- | --- | --- |
| `g` | global | Find **all** matches, not just the first |
| `i` | ignore case | `A` and `a` are the same |
| `m` | multiline | `^` and `$` match at the start/end of **each line** |
| `s` | dotAll | `.` also matches a newline |
| `u` | unicode | Handle emoji and other Unicode characters correctly |

```js
console.log(/hello/i.test("HELLO"));       // → true
console.log("one\ntwo".match(/^\w+/gm));    // → ["one", "two"]
console.log(/a.b/.test("a\nb"));            // → false
console.log(/a.b/s.test("a\nb"));           // → true
console.log(/^.$/.test("😀"));              // → false
console.log(/^.$/u.test("😀"));             // → true
```

## Pattern cheat sheet

| Pattern | Matches | Example | Matches in "Ab 12!" |
| --- | --- | --- | --- |
| `\d` | a digit 0–9 | `/\d/g` | `1`, `2` |
| `\w` | a letter, digit or `_` | `/\w/g` | `A`, `b`, `1`, `2` |
| `\s` | a space, tab or newline | `/\s/g` | the space |
| `.` | any character except newline | `/./g` | every character |
| `^` | start of the string | `/^A/` | `A` |
| `$` | end of the string | `/!$/` | `!` |
| `[abc]` | one of a, b, c | `/[ab]/gi` | `A`, `b` |
| `[^abc]` | any character **except** a, b, c | `/[^ab]/gi` | ` `, `1`, `2`, `!` |
| `[a-z]` | a range | `/[a-z]/g` | `b` |
| `*` | 0 or more of the previous | `/1\d*/` | `12` |
| `+` | 1 or more | `/\d+/` | `12` |
| `?` | 0 or 1 (optional) | `/colou?r/` | (matches "color" and "colour") |
| `{n,m}` | between n and m times | `/\d{1,2}/` | `12` |
| `( )` | a group | `/(ab)+/` | (matches "abab") |
| `a\|b` | a **or** b | `/cat\|dog/` | (matches "cat" or "dog") |

> 💡 Tip: Capital letters mean the opposite: `\D` is "not a digit", `\W` "not a word character", `\S` "not a space".

## Groups

Round brackets `( )` make a **group**. Groups let you pull out parts of a match. Group 1 is `m[1]`, group 2 is `m[2]`, and so on.

```js
const m = "2026-11-17".match(/(\d{4})-(\d{2})-(\d{2})/);
console.log(m[0]); // → "2026-11-17" (the whole match)
console.log(m[1]); // → "2026"
console.log(m[3]); // → "17"
```

In `replace`, use `$1`, `$2` to insert groups.

```js
console.log("Doe, John".replace(/(\w+), (\w+)/, "$2 $1")); // → "John Doe"
```

### Named groups

Give a group a name with `(?<name>...)`. Then read it from `.groups`.

```js
const date = /(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})/;
const { year, month, day } = "2026-11-17".match(date).groups;

console.log(day, month, year); // → 17 11 2026
```

Named groups make long patterns much easier to read.

## Practical examples

### A simple email check

```js
const emailish = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

console.log(emailish.test("sara@example.com")); // → true
console.log(emailish.test("sara@example"));     // → false
console.log(emailish.test("sara example.com")); // → false
```

It means: some non-space characters, an `@`, more characters, a dot, more characters.

> ⚠️ Watch out: Real email rules are very complex. Use a simple check like this for quick feedback, and confirm the address by sending an email.

### Keep only the digits of a phone number

```js
const phone = "(555) 123-4567";
console.log(phone.replace(/\D/g, "")); // → "5551234567"
```

### Collapse extra spaces

```js
const messy = "too    many   spaces";
console.log(messy.replace(/\s+/g, " ")); // → "too many spaces"
```

### Replace all spaces with dashes (a URL "slug")

```js
const title = "My First Blog Post";
console.log(title.toLowerCase().replace(/\s+/g, "-")); // → "my-first-blog-post"
```

## Escaping special characters

These characters have special meaning: `. * + ? ^ $ { } ( ) | [ ] \ /`. To match them literally, put a backslash before them.

```js
console.log(/\$\d+\.\d{2}/.test("Price: $19.99")); // → true
console.log(/1+1/.test("1+1"));    // → false  (+ means "one or more")
console.log(/1\+1/.test("1+1"));   // → true
```

When building a regex from user text, escape it first:

```js
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const search = "1+1";
const re = new RegExp(escapeRegex(search));
console.log(re.test("Is 1+1 two?")); // → true
```

> ⚠️ Watch out: A regex with the `g` flag remembers where it stopped (`lastIndex`). Calling `.test()` twice on the same `g` regex can give `true` then `false`. Don't use `g` with `test`.

## Try it yourself

1. Check if a string contains only letters (at least one).

<details>
<summary>Show solution</summary>

```js
const onlyLetters = /^[a-z]+$/i;
console.log(onlyLetters.test("Hello")); // → true
console.log(onlyLetters.test("Hi5"));   // → false
```
</details>

2. Find all hashtags in `"Loving #js and #regex today"`.

<details>
<summary>Show solution</summary>

```js
const tags = "Loving #js and #regex today".match(/#\w+/g);
console.log(tags); // → ["#js", "#regex"]
```
</details>

3. Turn `"17/11/2026"` into `"2026-11-17"` using named groups.

<details>
<summary>Show solution</summary>

```js
const result = "17/11/2026".replace(
  /(?<d>\d{2})\/(?<m>\d{2})\/(?<y>\d{4})/,
  "$<y>-$<m>-$<d>"
);
console.log(result); // → "2026-11-17"
```
</details>

## Quick check

<details>
<summary>What does the g flag do?</summary>

It finds all matches instead of stopping at the first one.
</details>

<details>
<summary>What does /^\d{3}$/ match?</summary>

A string that is exactly three digits, nothing before or after, like `"123"`.
</details>

<details>
<summary>How do you match a literal dot?</summary>

Escape it: `\.`. A plain `.` means "any character".
</details>

## Key takeaways

- A regex is a pattern for finding, checking and replacing text.
- Write it as `/pattern/flags` or `new RegExp("pattern", "flags")`.
- Use `test` to check, `match`/`matchAll` to find, `replace` and `split` to change.
- `\d \w \s`, `[ ]`, `+ * ? {n,m}`, `^ $` cover most everyday needs.
- Groups `( )` and named groups `(?<name>)` pull out parts of a match.
- Escape special characters with `\`, and keep regexes simple and tested.
