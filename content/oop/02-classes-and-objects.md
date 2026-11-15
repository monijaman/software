---
title: Classes and Objects
summary: A class is a blueprint and an object is a thing built from it. Learn constructors, properties, methods, this, and static members with simple examples.
level: Beginner
tags: [oop, classes, objects, constructor]
---

## The big idea

A **cookie cutter** is not a cookie. It's the *shape* you use to make as many cookies as you like. Each cookie can have its own topping, but they all share the same shape.

- The **class** is the cookie cutter: a blueprint that describes what something has and does.
- An **object** (also called an **instance**) is a real cookie made from it.

![One class is the blueprint; each object is a separate instance with its own data](/img/oop/class-vs-object.svg)

## Your first class

```ts
class Dog {
  // 1. Properties: the data each dog has
  name: string;
  age: number;

  // 2. Constructor: runs once when you create a dog with `new`
  constructor(name: string, age: number) {
    this.name = name;
    this.age = age;
  }

  // 3. Methods: what a dog can do
  bark() {
    return `${this.name} says woof!`;
  }

  haveBirthday() {
    this.age += 1;
  }
}

// Create objects (instances) with `new`
const rex = new Dog("Rex", 3);
const luna = new Dog("Luna", 1);

rex.bark();          // "Rex says woof!"
luna.haveBirthday();
luna.age;            // 2
rex.age;             // 3: each object has its own data
```

| Part | What it is | Example |
| --- | --- | --- |
| **Property** (field) | Data stored on each object | `name`, `age` |
| **Constructor** | Sets up a new object | `constructor(name, age)` |
| **Method** | A function that belongs to the object | `bark()` |
| **Instance** | One object made from the class | `rex`, `luna` |

## What is `this`?

Inside a method, **`this` means "the object this method was called on"**.

```ts
rex.bark();  // inside bark(), this === rex  → "Rex says woof!"
luna.bark(); // inside bark(), this === luna → "Luna says woof!"
```

That's how one `bark()` method works for every dog.

> ⚠️ **JavaScript gotcha:** if you pass a method around on its own, `this` gets lost.
>
> ```ts
> const fn = rex.bark;
> fn(); // ❌ TypeError: cannot read 'name' of undefined
>
> button.addEventListener("click", () => rex.bark()); // ✅ arrow keeps `this`
> ```

## A shorter constructor (TypeScript)

TypeScript lets you declare and assign properties right in the constructor:

```ts
class Dog {
  constructor(
    public name: string,
    public age: number,
  ) {}
}
```

This does exactly the same as the longer version above.

## Static members: belong to the class, not to objects

Sometimes data or a helper belongs to the **class itself**, not to any one object. Mark it `static`.

```ts
class Temperature {
  static readonly FREEZING_C = 0;

  static fromFahrenheit(f: number) {
    return new Temperature((f - 32) * (5 / 9));
  }

  constructor(public celsius: number) {}

  isFreezing() {
    return this.celsius <= Temperature.FREEZING_C;
  }
}

const t = Temperature.fromFahrenheit(212); // called on the class
t.celsius;      // 100
t.isFreezing(); // false
```

| | Instance member | Static member |
| --- | --- | --- |
| Belongs to | Each object | The class |
| Called as | `rex.bark()` | `Temperature.fromFahrenheit(212)` |
| Typical use | Behavior that uses the object's data | Constants, factory helpers, counters |

## Objects are references

A variable holds a **reference** (an address) to an object, not a copy of it.

```ts
const a = new Dog("Rex", 3);
const b = a;       // b points to the SAME dog
b.name = "Max";
a.name;            // "Max"

const c = new Dog("Max", 3);
a === c;           // false: same data, different objects
```

## Real-world example: a shopping cart

```ts
type CartItem = { name: string; price: number; qty: number };

class ShoppingCart {
  private items: CartItem[] = [];

  add(name: string, price: number, qty = 1) {
    const existing = this.items.find((i) => i.name === name);
    if (existing) existing.qty += qty;
    else this.items.push({ name, price, qty });
  }

  remove(name: string) {
    this.items = this.items.filter((i) => i.name !== name);
  }

  get total() {
    return this.items.reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  get count() {
    return this.items.reduce((sum, i) => sum + i.qty, 0);
  }
}

const cart = new ShoppingCart();
cart.add("Coffee", 4.5, 2);
cart.add("Bagel", 3);
cart.total; // 12
cart.count; // 3
```

The cart keeps its own list and gives you a few clear actions. Code outside never edits the list directly.

## Common mistakes

- **Forgetting `new`.** `Dog("Rex", 3)` throws an error; you need `new Dog("Rex", 3)`.
- **Too much work in the constructor.** Keep it to setting fields. Don't call APIs or databases there.
- **Classes with only data and no behavior.** A plain object or `type` is often enough.
- **Classes with only static methods.** That's just a module of functions; export functions instead.

## Key takeaways

- A **class** is a blueprint; an **object** is an instance built with `new`.
- **Properties** hold data, **methods** hold behavior, and the **constructor** sets things up.
- `this` refers to the object the method was called on.
- `static` members belong to the class, not to instances.
- Variables hold **references** to objects, not copies.

## Try it yourself

Write a `Counter` class with `increment()`, `decrement()`, `reset()` and a `value` getter. Create two counters and check that changing one doesn't affect the other.
