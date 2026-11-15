---
title: Polymorphism
summary: One method call, many behaviors. Learn how polymorphism lets you treat different objects the same way, replace long if/else chains, and add new types without changing old code.
level: Beginner
tags: [oop, polymorphism, overriding, interfaces, pillars]
---

## The big idea

Say **"speak!"** to a dog, a cat and a duck. You give the **same command**, but you get **three different answers**: woof, meow, quack.

**Polymorphism** (Greek for "many shapes") means you can call the **same method** on different objects, and **each object responds in its own way**. The calling code doesn't need to know which kind of object it has.

![The same area() call works on every shape, and each shape calculates it its own way](/img/oop/polymorphism.svg)

## Polymorphism in code

```ts
interface Shape {
  area(): number;
}

class Circle implements Shape {
  constructor(private radius: number) {}
  area() { return Math.PI * this.radius ** 2; }
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  area() { return this.width * this.height; }
}

class Triangle implements Shape {
  constructor(private base: number, private height: number) {}
  area() { return 0.5 * this.base * this.height; }
}

// This function works with ANY shape, now and in the future
function totalArea(shapes: Shape[]) {
  return shapes.reduce((sum, s) => sum + s.area(), 0);
}

totalArea([new Circle(1), new Rectangle(2, 3), new Triangle(4, 5)]); // ≈ 19.14
```

`totalArea` never asks *"are you a circle or a rectangle?"*. It just calls `area()` and trusts each shape to do the right thing.

## The big win: goodbye, giant `if/else`

Without polymorphism, every new type means editing a growing chain of conditions:

```ts
// ❌ Without polymorphism
function calculatePay(employee: { type: string; salary: number; hours?: number; rate?: number }) {
  if (employee.type === "fullTime") {
    return employee.salary / 12;
  } else if (employee.type === "partTime") {
    return employee.hours! * employee.rate!;
  } else if (employee.type === "contractor") {
    return employee.hours! * employee.rate! * 1.2;
  }
  // adding "intern" means editing this function… and every other switch like it
  throw new Error("Unknown type");
}
```

```ts
// ✅ With polymorphism
interface Employee {
  monthlyPay(): number;
}

class FullTime implements Employee {
  constructor(private salary: number) {}
  monthlyPay() { return this.salary / 12; }
}

class PartTime implements Employee {
  constructor(private hours: number, private rate: number) {}
  monthlyPay() { return this.hours * this.rate; }
}

class Contractor implements Employee {
  constructor(private hours: number, private rate: number) {}
  monthlyPay() { return this.hours * this.rate * 1.2; }
}

// Adding Intern = one NEW class. Payroll code never changes.
const payroll = (staff: Employee[]) => staff.reduce((sum, e) => sum + e.monthlyPay(), 0);
```

This is the **Open/Closed Principle** in action: open for new types, closed for edits to existing code.

## Two main kinds of polymorphism

| Kind | Also called | How it works | Example |
| --- | --- | --- | --- |
| **Runtime** (subtype) | Dynamic dispatch, overriding | The object's real class decides which method runs, while the program runs | `shape.area()` |
| **Compile-time** | Overloading, generics | The compiler picks the right version from the types | `format(date)` vs `format(number)`, `Box<T>` |

### Runtime polymorphism (overriding)

```ts
class Animal {
  speak() { return "..."; }
}
class Dog extends Animal {
  override speak() { return "Woof"; }
}
class Cat extends Animal {
  override speak() { return "Meow"; }
}

const animals: Animal[] = [new Dog(), new Cat(), new Animal()];
animals.map((a) => a.speak()); // ["Woof", "Meow", "..."]
```

The variable's type is `Animal`, but the **actual object** decides which `speak()` runs.

### Compile-time polymorphism (generics)

```ts
class Box<T> {
  constructor(private value: T) {}
  get() { return this.value; }
}

new Box(42).get();       // number
new Box("hello").get();  // string
```

One class, many types, checked by the compiler.

> 💡 **JavaScript doesn't support true method overloading** (two methods with the same name and different parameters). TypeScript lets you declare *overload signatures*, but there's still only one implementation underneath.

## Duck typing: polymorphism without inheritance

*"If it walks like a duck and quacks like a duck, it's a duck."*

TypeScript checks the **shape** of an object, not its class name. Anything with the right methods fits:

```ts
interface Logger {
  log(message: string): void;
}

const consoleLogger: Logger = { log: (m) => console.log(m) };

class FileLogger {
  log(message: string) { /* append to file */ }
}

function run(logger: Logger) {
  logger.log("Started");
}

run(consoleLogger);    // ✅ plain object
run(new FileLogger()); // ✅ never says "implements Logger", but fits the shape
```

## Real-world example: payment methods

```ts
interface PaymentMethod {
  pay(amount: number): string;
}

class CardPayment implements PaymentMethod {
  constructor(private last4: string) {}
  pay(amount: number) { return `Charged $${amount} to card ••••${this.last4}`; }
}

class PayPalPayment implements PaymentMethod {
  constructor(private email: string) {}
  pay(amount: number) { return `Sent $${amount} via PayPal (${this.email})`; }
}

class WalletPayment implements PaymentMethod {
  constructor(private balance: number) {}
  pay(amount: number) {
    if (amount > this.balance) throw new Error("Not enough wallet balance");
    this.balance -= amount;
    return `Paid $${amount} from wallet`;
  }
}

function checkout(total: number, method: PaymentMethod) {
  return method.pay(total); // works with every payment method
}
```

## Common mistakes

- **Checking types anyway.** `if (shape instanceof Circle)` inside polymorphic code usually means a method is missing from the interface.
- **Overrides that break the contract.** If `Shape.area()` returns a number, no subclass should throw or return `null`.
- **Forcing polymorphism on two cases.** For a simple yes/no choice, a plain `if` is fine.

## Key takeaways

- Polymorphism = **same call, different behavior** depending on the object.
- It replaces long `if/else` or `switch` chains on a "type" field.
- New types are added as **new classes**, without editing existing code.
- Runtime polymorphism uses overriding/interfaces; compile-time uses generics.
- TypeScript's structural typing allows **duck typing**: matching the shape is enough.

## Try it yourself

Find a `switch (type)` in your code that appears in more than one place. Replace it with an interface and one class per case. How many places did you have to change before, and how many now?
