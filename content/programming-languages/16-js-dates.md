---
title: JS Dates
summary: "Learn how to create, read, change, compare and format dates in JavaScript with the built-in Date object, and avoid the classic month-number trap."
level: Beginner
tags: [javascript, js-tutorial, dates, intl]
---

## The Date object

JavaScript stores dates and times with the built-in **`Date` object**. An object is a bundle of data plus actions (called **methods**) you can use on it.

Inside, every date is just one big number: the milliseconds since **1 January 1970, 00:00 UTC**. This number is called a **timestamp**.

```js
const now = new Date();
console.log(now);
// → 2026-11-17T09:30:12.345Z (your date and time will be different)
```

> 📝 Note: The exact text you see depends on your browser and your time zone. That is normal.

## Creating dates

There are four common ways to make a date.

### 1. The current date and time

```js
const now = new Date();
```

### 2. From a date string (ISO format)

The safest string format is **ISO 8601**: `YYYY-MM-DD`, with an optional time after a `T`.

```js
const a = new Date("2025-01-15");          // date only
const b = new Date("2025-01-15T10:30:00"); // date and local time
const c = new Date("2025-01-15T10:30:00Z"); // the Z means UTC
```

> ⚠️ Watch out: A date-only string like `"2025-01-15"` is read as **UTC midnight**. A string with a time but no `Z` is read as **your local time**. Avoid other formats like `"01/15/2025"` — browsers may read them differently.

### 3. From numbers (year, month, day, ...)

```js
const d = new Date(2025, 0, 15, 9, 5); // year, month, day, hours, minutes
console.log(d.toDateString());
// → "Wed Jan 15 2025"
```

> ⚠️ Watch out: **Months start at 0!** January is `0`, February is `1`, ... December is `11`. Days of the month start at `1` as usual. This is the most common date bug in JavaScript.

```js
new Date(2025, 1, 1).toDateString(); // → "Sat Feb 01 2025"  (1 = February!)
```

### 4. From a timestamp

```js
const start = new Date(0);
console.log(start.toISOString());
// → "1970-01-01T00:00:00.000Z"

console.log(Date.now()); // → 1763371812345 (milliseconds right now)
```

## Get methods

Use **get methods** to read one part of a date. All of them use your **local** time zone.

| Method | What it returns | Example for `new Date(2025, 0, 15, 9, 5)` |
| --- | --- | --- |
| `getFullYear()` | Year (4 digits) | `2025` |
| `getMonth()` | Month, **0–11** | `0` (January) |
| `getDate()` | Day of the month, 1–31 | `15` |
| `getDay()` | Day of the week, 0–6 (0 = Sunday) | `3` (Wednesday) |
| `getHours()` | Hours, 0–23 | `9` |
| `getMinutes()` | Minutes, 0–59 | `5` |
| `getSeconds()` | Seconds, 0–59 | `0` |
| `getMilliseconds()` | Milliseconds, 0–999 | `0` |
| `getTime()` | Timestamp in milliseconds | a big number |

```js
const d = new Date(2025, 0, 15);
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
console.log(days[d.getDay()]); // → "Wed"
```

> 💡 Tip: Every get method also has a UTC version, like `getUTCHours()`, if you need UTC instead of local time.

## Set methods

**Set methods** change one part of a date. They change the date object itself.

```js
const d = new Date(2025, 0, 15);
d.setFullYear(2026);
d.setMonth(5);   // June (0-based!)
d.setDate(1);
console.log(d.toDateString()); // → "Mon Jun 01 2026"
```

Dates "roll over" automatically when a value is too big.

```js
const d = new Date(2025, 0, 31); // Jan 31
d.setDate(d.getDate() + 1);
console.log(d.toDateString()); // → "Sat Feb 01 2025"
```

## Comparing dates

You can compare dates with `<` and `>`, because JavaScript turns them into timestamps.

```js
const a = new Date(2025, 0, 1);
const b = new Date(2025, 5, 1);
console.log(a < b); // → true
```

> ⚠️ Watch out: `===` checks if two variables point to the **same object**, not the same time. Compare timestamps instead.

```js
const x = new Date(2025, 0, 1);
const y = new Date(2025, 0, 1);
console.log(x === y);                     // → false
console.log(x.getTime() === y.getTime()); // → true
```

## Date math

### Add days

```js
function addDays(date, days) {
  const copy = new Date(date); // copy, so we don't change the original
  copy.setDate(copy.getDate() + days);
  return copy;
}

const due = addDays(new Date(2025, 0, 28), 7);
console.log(due.toDateString()); // → "Tue Feb 04 2025"
```

### Difference in days

Subtracting two dates gives the difference in **milliseconds**. Divide to get days.

```js
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const start = new Date(2025, 0, 1);
const end = new Date(2025, 11, 25);

const days = Math.round((end - start) / MS_PER_DAY);
console.log(days); // → 358
```

> 💡 Tip: Use `Math.round`. Daylight saving time can make one day 23 or 25 hours long, so the raw result may be slightly off a whole number.

## Formatting dates

### toLocaleDateString

`toLocaleDateString()` formats a date the way people in a given **locale** (language + region) expect.

```js
const d = new Date(2025, 0, 15);
d.toLocaleDateString("en-US"); // → "1/15/2025"
d.toLocaleDateString("en-GB"); // → "15/01/2025"
d.toLocaleDateString("de-DE"); // → "15.1.2025"

d.toLocaleDateString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});
// → "Wednesday, January 15, 2025"
```

### Intl.DateTimeFormat

If you format many dates, create a formatter once with **`Intl.DateTimeFormat`** and reuse it.

```js
const fmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
console.log(fmt.format(new Date(2025, 0, 15, 9, 5)));
// → "Jan 15, 2025, 9:05 AM"
```

### ISO strings

`toISOString()` always gives UTC in ISO format. It is perfect for saving dates or sending them to a server.

```js
const d = new Date(Date.UTC(2025, 0, 15, 10, 30));
console.log(d.toISOString()); // → "2025-01-15T10:30:00.000Z"
```

## Time zones

A `Date` holds one exact moment. How it **looks** depends on the time zone you show it in.

```js
const d = new Date("2025-01-15T12:00:00Z");
d.toLocaleString("en-US", { timeZone: "America/New_York" }); // → "1/15/2025, 7:00:00 AM"
d.toLocaleString("en-US", { timeZone: "Asia/Tokyo" });       // → "1/15/2025, 9:00:00 PM"
```

> 📝 Note: A good habit: **store** dates in UTC (ISO strings or timestamps), and only **show** them in local time.

## The newer Temporal API

`Date` has many rough edges (0-based months, objects that change in place, weak time zone support). JavaScript now has a newer API called **`Temporal`** that fixes these problems.

```js
// Only works where Temporal is supported
const today = Temporal.Now.plainDateISO();
console.log(today.add({ days: 7 }).toString()); // → "2026-11-24" (if today is 2026-11-17)
```

Temporal is arriving in modern browsers now, so check support before using it. `Date` will still be everywhere for years, so it is worth knowing well.

## Try it yourself

**1.** Create a date for 25 December 2025 using numbers, and print it with `toDateString()`.

<details>
<summary>Show solution</summary>

```js
const xmas = new Date(2025, 11, 25); // 11 = December
console.log(xmas.toDateString()); // → "Thu Dec 25 2025"
```
</details>

**2.** Print today's day name (like "Monday") using `toLocaleDateString`.

<details>
<summary>Show solution</summary>

```js
const dayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
console.log(dayName);
```
</details>

**3.** Write a function `daysUntil(date)` that returns how many whole days are left until `date`.

<details>
<summary>Show solution</summary>

```js
function daysUntil(date) {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.ceil((date - new Date()) / MS_PER_DAY);
}

console.log(daysUntil(new Date(2026, 11, 31)));
```
</details>

## Quick check

<details>
<summary>What does <code>new Date(2025, 3, 10).getMonth()</code> return, and which month is it?</summary>

It returns `3`, which is **April**, because months start at 0.
</details>

<details>
<summary>Why is <code>dateA === dateB</code> false even when both hold the same time?</summary>

`===` compares object identity. They are two different objects. Use `dateA.getTime() === dateB.getTime()`.
</details>

<details>
<summary>Which method gives a UTC string that is good for saving to a server?</summary>

`toISOString()`, for example `"2025-01-15T10:30:00.000Z"`.
</details>

## Key takeaways

- A `Date` is a timestamp: milliseconds since 1 January 1970 UTC.
- Months are **0-based** (January = 0), but days of the month start at 1.
- Use get/set methods to read and change parts; set methods roll over automatically.
- Compare with `<`, `>` or `getTime()`, never with `===`.
- Format with `toLocaleDateString` or `Intl.DateTimeFormat`; save with `toISOString()`.
- `Temporal` is the newer, cleaner date API arriving in modern browsers.
