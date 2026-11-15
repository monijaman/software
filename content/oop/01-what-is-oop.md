---
title: What Is Object-Oriented Programming?
summary: OOP organizes code around objects, small units that bundle data with the behavior that uses it. See how it differs from procedural code and meet the four pillars.
level: Beginner
tags: [oop, fundamentals, paradigms]
---

## The big idea

Think about a **TV remote**. You don't need to know how its circuit board works. You press **Volume +** and the volume goes up. The remote keeps its own state (battery level, current channel) and gives you a few buttons to use.

**Object-oriented programming (OOP)** builds software the same way. You split a program into **objects**. Each object:

- **holds its own data** (the *state*): a bank account knows its balance,
- **offers actions that use that data** (the *behavior*): you can `deposit()` or `withdraw()`,
- **hides the messy details** so the rest of the program only uses the "buttons".

> 💡 An object is **data + the functions that work on that data**, packed together.

## Procedural vs object-oriented

In **procedural** code, data and functions live separately. Any function can grab any data and change it.

In **object-oriented** code, each piece of data sits inside an object, next to the only functions allowed to change it.

![Procedural code keeps data and functions apart; OOP bundles them into objects](/img/oop/procedural-vs-oop.svg)

```ts
// Procedural: data and functions are separate
const account = { owner: "Ana", balance: 100 };

function withdraw(acc: { balance: number }, amount: number) {
  acc.balance -= amount; // nothing stops a negative balance
}

account.balance = -5000; // ...and anyone can do this anywhere
```

```ts
// Object-oriented: the data is protected by the object
class BankAccount {
  #balance = 0; // private: only code inside the class can touch it

  constructor(public readonly owner: string) {}

  deposit(amount: number) {
    if (amount <= 0) throw new Error("Amount must be positive");
    this.#balance += amount;
  }

  withdraw(amount: number) {
    if (amount > this.#balance) throw new Error("Insufficient funds");
    this.#balance -= amount;
  }

  get balance() {
    return this.#balance;
  }
}

const acc = new BankAccount("Ana");
acc.deposit(100);
acc.withdraw(30);
console.log(acc.balance); // 70
// acc.#balance = -5000;   ❌ syntax error: the balance is safe
```

The rule "the balance can never go below zero" now lives in **one place**, and the rest of the code cannot break it.

## The four pillars of OOP

Almost every OOP lesson, book and interview comes back to these four ideas:

![The four pillars: encapsulation, abstraction, inheritance and polymorphism](/img/oop/four-pillars.svg)

| Pillar | In one sentence | Real-life example |
| --- | --- | --- |
| **Encapsulation** | Keep data private and change it only through the object's methods | You can't reach into an ATM and grab cash; you use its buttons |
| **Abstraction** | Show only what matters and hide how it works | A car gives you a wheel and pedals, not the engine internals |
| **Inheritance** | Build a new class from an existing one and reuse its code | A sports car *is a* car, with extra features |
| **Polymorphism** | One call, many behaviors depending on the object | "Make a sound": a dog barks, a cat meows |

Each pillar gets its own lesson next.

## Why use OOP?

- **Models the real world.** `Order`, `Customer` and `Invoice` in code match the words people use at work.
- **Protects your data.** Rules live inside the object, so they can't be skipped.
- **Easier to change.** You can replace how an object works inside without touching the code that uses it.
- **Reuse.** Shared behavior can come from inheritance or, more often, from composition.
- **Team-friendly.** Different people can own different classes without stepping on each other.

## When OOP is *not* the best fit

OOP is a tool, not a religion. Modern languages mix styles:

- **Small scripts and data transforms** are often clearer as plain functions (`map`, `filter`, `reduce`).
- **Functional programming** shines when you want no shared mutable state, such as in data pipelines and React components.
- **Over-using classes** leads to deep hierarchies and "manager" classes that do nothing.

> ✅ A good rule: use classes when you have **data plus rules that must stay consistent**. Use plain functions when you're just transforming data.

## Languages and OOP

| Language | OOP style |
| --- | --- |
| Java, C# | Everything lives in classes |
| TypeScript / JavaScript | Classes on top of prototypes, freely mixed with functions |
| Python | Classes are everywhere, but optional |
| Go | No classes: structs + methods + interfaces |
| Rust | Structs + traits, no inheritance |

This course uses **TypeScript**, but the ideas carry over to every language above.

## Key takeaways

- An **object** bundles **state** (data) and **behavior** (methods).
- OOP protects data by letting only the object change it.
- The four pillars are **encapsulation, abstraction, inheritance and polymorphism**.
- Use OOP where data has rules to protect; use plain functions for simple data transformation.

## Try it yourself

Pick something from your daily life, like a coffee machine, a phone or a shopping cart. Write down:

1. What **data** it keeps (state).
2. What **buttons** it gives you (methods).
3. What it **hides** from you.

You've just designed your first class.
