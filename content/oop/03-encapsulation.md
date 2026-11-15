---
title: Encapsulation
summary: Keep an object's data private and let it change only through its own methods. Learn access modifiers, getters and setters, and how encapsulation protects business rules.
level: Beginner
tags: [oop, encapsulation, access-modifiers, pillars]
---

## The big idea

A **medicine capsule** wraps the powder inside a shell. You swallow the capsule; you never touch the powder.

An **ATM** works the same way. The cash is locked inside. You can't open the box and take money. You use the buttons (*withdraw*, *check balance*), and the machine checks your PIN and your balance before giving you anything.

**Encapsulation** means:

1. **Hide** the object's data (make it *private*).
2. **Expose** a small set of safe methods (the *public interface*).
3. Let those methods **enforce the rules**.

![The data is locked inside the object; the outside world can only press its public buttons](/img/oop/encapsulation.svg)

## The problem without encapsulation

```ts
class BankAccount {
  balance = 0; // public: anyone can change it
}

const acc = new BankAccount();
acc.balance = -1_000_000; // 😱 nothing stops this
acc.balance = "lots";     // in plain JavaScript, even this works
```

Every place in the codebase can break the rules. If there's a bug, you have to search the **whole project** to find who changed the balance.

## The fix: private data + public methods

```ts
class BankAccount {
  #balance = 0;                       // private
  #history: string[] = [];            // private

  deposit(amount: number) {
    if (amount <= 0) throw new Error("Deposit must be positive");
    this.#balance += amount;
    this.#history.push(`+${amount}`);
  }

  withdraw(amount: number) {
    if (amount <= 0) throw new Error("Withdrawal must be positive");
    if (amount > this.#balance) throw new Error("Insufficient funds");
    this.#balance -= amount;
    this.#history.push(`-${amount}`);
  }

  get balance() {                     // read-only from outside
    return this.#balance;
  }

  get history() {
    return [...this.#history];        // a copy, so callers can't edit ours
  }
}

const acc = new BankAccount();
acc.deposit(100);
acc.withdraw(40);
acc.balance;        // 60
acc.balance = 999;  // ❌ error: there is no setter
```

Now there are only **two doors** into the balance: `deposit` and `withdraw`. Both check the rules, so the balance can never become invalid.

## Access modifiers

| Modifier | Who can access it | TypeScript / JavaScript |
| --- | --- | --- |
| **public** (default) | Everyone | `name` |
| **private** | Only code inside this class | `#name` (real JS privacy) or `private name` (TS compile-time only) |
| **protected** | This class and its subclasses | `protected name` |
| **readonly** | Can be set once, then never changed | `readonly id` |

```ts
class User {
  readonly id: string;          // set once
  private passwordHash: string; // only inside User
  protected role = "member";    // User and subclasses
  public name: string;          // everyone

  constructor(id: string, name: string, passwordHash: string) {
    this.id = id;
    this.name = name;
    this.passwordHash = passwordHash;
  }
}
```

> 💡 **`#private` vs `private`:** TypeScript's `private` is checked only while compiling; at runtime the field is still visible. `#field` is enforced by JavaScript itself. Prefer `#` when real privacy matters.

## Getters and setters

A **getter** lets callers read a value like a property. A **setter** lets them assign one, but runs your validation first.

```ts
class Temperature {
  #celsius = 0;

  get celsius() {
    return this.#celsius;
  }

  set celsius(value: number) {
    if (value < -273.15) throw new Error("Below absolute zero!");
    this.#celsius = value;
  }

  get fahrenheit() {            // computed, not stored
    return this.#celsius * 9 / 5 + 32;
  }
}

const t = new Temperature();
t.celsius = 25;   // runs the setter
t.fahrenheit;     // 77
t.celsius = -500; // ❌ throws
```

> ⚠️ **Don't add a getter and setter for every field.** A public setter that accepts anything is no better than a public field. Prefer methods that describe **intent**: `account.withdraw(50)` instead of `account.setBalance(account.getBalance() - 50)`.

## "Tell, don't ask"

Encapsulated code **tells** objects what to do instead of **asking** for their data and doing the work itself.

```ts
// ❌ Ask: pull data out, make the decision outside
if (order.getStatus() === "paid" && order.getItems().length > 0) {
  order.setStatus("shipped");
}

// ✅ Tell: the order owns its own rules
order.ship(); // throws if it isn't paid or has no items
```

## Benefits

- **Rules live in one place.** The "balance can't go negative" rule is in `BankAccount`, nowhere else.
- **Safe to change internals.** Switch from a number to a `Money` type, or add a database, without touching callers.
- **Easier debugging.** Only a few methods can change the state.
- **Clear API.** New developers see a few public methods instead of every internal detail.

## Common mistakes

- **Returning internal arrays or objects directly.** Callers can then change them. Return a copy or a read-only view.
- **Getters and setters for everything.** That's just a public field with extra steps.
- **Making everything private by reflex**, then adding getters because tests need them. Test through the public behavior instead.

## Key takeaways

- Encapsulation = **private data + public methods that enforce the rules**.
- Use `#private` (or `private`), `protected` and `readonly` to control access.
- Expose intent (`withdraw`), not raw data (`setBalance`).
- "Tell, don't ask": let objects make decisions about their own data.

## Try it yourself

Write a `Thermostat` class whose target temperature can only be set between 10 °C and 30 °C. Add `increase()` and `decrease()` methods that move it by 0.5 and never go past the limits.
