---
title: JS Classes & this
summary: "Learn to build objects from classes with constructors, methods, getters, static members, private fields and inheritance, and finally understand what `this` points to."
level: Intermediate
tags: [javascript, js-tutorial, classes, this, oop]
---

## What is a class?

A **class** is a blueprint (a template) for making objects. You write the blueprint once, then create as many objects from it as you like.

Each object made from a class is called an **instance**.

```js
class Dog {
  constructor(name) {
    this.name = name;
  }

  bark() {
    return `${this.name} says woof!`;
  }
}

const rex = new Dog("Rex");
console.log(rex.bark()); // → "Rex says woof!"
```

## The constructor

The **constructor** is a special method that runs automatically when you create a new instance. It sets up the starting data.

Inside it, `this` means "the new object being built".

```js
class Book {
  constructor(title, pages) {
    this.title = title;
    this.pages = pages;
  }
}

const b = new Book("JS Basics", 120);
console.log(b.title, b.pages); // → "JS Basics" 120
```

## Creating objects with new

You must use the **`new`** keyword to create an instance.

```js
const a = new Book("A", 10); // ✅
const c = Book("C", 30);     // TypeError: Class constructor Book cannot be invoked without 'new'
```

## Methods

**Methods** are functions that belong to the class. All instances share the same methods.

```js
class Counter {
  constructor() {
    this.count = 0;
  }
  increment() {
    this.count++;
    return this.count;
  }
}

const c = new Counter();
c.increment();
console.log(c.increment()); // → 2
```

> 📝 Note: No commas between methods in a class, unlike in an object literal.

## Getters and setters

A **getter** (`get`) runs code when you read a property. A **setter** (`set`) runs code when you assign to it. From outside, they look like normal properties.

```js
class Temperature {
  constructor(celsius) {
    this.celsius = celsius;
  }
  get fahrenheit() {
    return this.celsius * 9 / 5 + 32;
  }
  set fahrenheit(f) {
    this.celsius = (f - 32) * 5 / 9;
  }
}

const t = new Temperature(25);
console.log(t.fahrenheit); // → 77
t.fahrenheit = 212;
console.log(t.celsius);    // → 100
```

## Static members

A **static** method or property belongs to the class itself, not to instances. Use it for helpers related to the class.

```js
class MathHelper {
  static PI = 3.14159;
  static square(n) {
    return n * n;
  }
}

console.log(MathHelper.square(4)); // → 16
console.log(MathHelper.PI);        // → 3.14159
```

## Private fields with #

A name that starts with **`#`** is **private**. Only code inside the class can read or change it.

```js
class BankAccount {
  #balance = 0;

  deposit(amount) {
    if (amount <= 0) throw new Error("Amount must be positive");
    this.#balance += amount;
  }
  get balance() {
    return this.#balance;
  }
}

const acc = new BankAccount();
acc.deposit(100);
console.log(acc.balance);   // → 100
// acc.#balance = 1e6;      // SyntaxError: Private field '#balance' must be declared in an enclosing class
```

> 💡 Tip: Private fields protect your data. Others must use your methods, so you can check the values (like "no negative deposits").

## Inheritance: extends and super

**`extends`** makes a new class based on another one. The new class (the **child**) gets everything from the old one (the **parent**) and can add more.

**`super`** calls the parent: `super(...)` runs the parent's constructor, `super.method()` runs a parent method.

```js
class Animal {
  constructor(name) {
    this.name = name;
  }
  speak() {
    return `${this.name} makes a sound.`;
  }
}

class Cat extends Animal {
  constructor(name, indoor) {
    super(name);          // must come before using this
    this.indoor = indoor;
  }
  speak() {
    return `${super.speak()} Meow!`;
  }
}

const kitty = new Cat("Mia", true);
console.log(kitty.speak()); // → "Mia makes a sound. Meow!"
```

> ⚠️ Watch out: In a child constructor, call `super()` **before** you use `this`, or you get a ReferenceError.

## instanceof

**`instanceof`** checks if an object was made from a class (or its parents).

```js
console.log(kitty instanceof Cat);    // → true
console.log(kitty instanceof Animal); // → true
console.log(kitty instanceof Array);  // → false
```

## Understanding this

**`this`** is a special word whose value depends on **how a function is called**, not where it is written.

| How the function is called | What `this` is | Example |
| --- | --- | --- |
| As a method: `obj.method()` | The object before the dot | `user.greet()` → `user` |
| Plain call: `fn()` | `undefined` in strict mode (classes, modules) | `const f = user.greet; f()` |
| Arrow function | Borrowed from the surrounding code | `() => this.name` |
| With `new` | The new object | `new Dog("Rex")` |
| Event handler (`function`) | The element that has the listener | `button.addEventListener(...)` |
| After `.bind(obj)` | Always `obj` | `user.greet.bind(user)` |

### Losing this

Taking a method out of its object breaks the link to `this`.

```js
class User {
  constructor(name) {
    this.name = name;
  }
  greet() {
    return `Hi, I'm ${this.name}`;
  }
}

const u = new User("Ana");
console.log(u.greet()); // → "Hi, I'm Ana"

const greet = u.greet;
greet(); // TypeError: Cannot read properties of undefined (reading 'name')
```

### Fix 1: bind

```js
const bound = u.greet.bind(u);
console.log(bound()); // → "Hi, I'm Ana"
```

### Fix 2: arrow functions

Arrow functions do not have their own `this`. They use the `this` from where they were written. This makes them great for callbacks.

```js
class Timer {
  constructor() {
    this.seconds = 0;
  }
  start() {
    setInterval(() => {
      this.seconds++; // `this` is still the Timer
    }, 1000);
  }
}
```

> ⚠️ Watch out: In an event listener written with `function`, `this` is the element. With an arrow function, `this` comes from outside. When unsure, use `event.currentTarget` to get the element instead.

## Classes are built on prototypes

Under the hood, classes are a nicer way to write JavaScript's older **prototype** system. Every object has a hidden link to a **prototype** object, and methods are stored there. When you call `rex.bark()`, JavaScript doesn't find `bark` on `rex` itself, so it follows the link to `Dog.prototype` and finds it there. That is why all instances share one copy of each method.

```js
console.log(Object.getPrototypeOf(rex) === Dog.prototype); // → true
```

## Try it yourself

**1.** Create a `Rectangle` class with `width` and `height`, and a getter `area`.

<details>
<summary>Show solution</summary>

```js
class Rectangle {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }
  get area() {
    return this.width * this.height;
  }
}

console.log(new Rectangle(3, 4).area); // → 12
```
</details>

**2.** Make a `Square` class that extends `Rectangle` and only needs one `size` argument.

<details>
<summary>Show solution</summary>

```js
class Square extends Rectangle {
  constructor(size) {
    super(size, size);
  }
}

const sq = new Square(5);
console.log(sq.area);                 // → 25
console.log(sq instanceof Rectangle); // → true
```
</details>

**3.** Build a `Stack` class with a private `#items` array and methods `push(item)`, `pop()` and a getter `size`.

<details>
<summary>Show solution</summary>

```js
class Stack {
  #items = [];
  push(item) {
    this.#items.push(item);
  }
  pop() {
    return this.#items.pop();
  }
  get size() {
    return this.#items.length;
  }
}

const s = new Stack();
s.push("a");
s.push("b");
console.log(s.pop());  // → "b"
console.log(s.size);   // → 1
```
</details>

## Quick check

<details>
<summary>What does <code>super(name)</code> do inside a child constructor?</summary>

It runs the parent class's constructor with `name`. It must be called before using `this`.
</details>

<details>
<summary>Why does <code>const f = obj.method; f();</code> often break?</summary>

`this` depends on how the function is called. A plain call `f()` has no object before the dot, so `this` is `undefined`. Use `bind` or an arrow function.
</details>

<details>
<summary>What is the difference between a static method and a normal method?</summary>

A static method is called on the class (`MathHelper.square(4)`). A normal method is called on an instance (`c.increment()`).
</details>

## Key takeaways

- A class is a blueprint; create instances with `new`.
- The `constructor` sets up each new object; methods are shared by all instances.
- Use `get`/`set` for computed properties, `static` for class-level helpers, and `#` for private data.
- `extends` creates a child class; `super` calls the parent.
- `this` depends on **how** a function is called; arrow functions and `bind` keep it stable.
- Classes are a friendlier syntax on top of JavaScript prototypes.
