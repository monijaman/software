---
title: Abstraction
summary: Show what an object does and hide how it does it. Learn how abstraction keeps code simple to use, and how interfaces and abstract classes express it.
level: Beginner
tags: [oop, abstraction, interfaces, pillars]
---

## The big idea

To drive a car you need a **steering wheel, two pedals and a gear stick**. You don't need to know about fuel injection, spark timing or the gearbox. All that complexity is hidden behind a simple *dashboard*.

**Abstraction** means giving people a simple way to use something while hiding the complicated parts.

![The driver sees a simple dashboard; the engine's complexity stays hidden underneath](/img/oop/abstraction.svg)

## Abstraction vs encapsulation

These two are often confused because they work together:

| | Encapsulation | Abstraction |
| --- | --- | --- |
| Question | *How do I protect the data?* | *What should the user of this object see?* |
| Focus | Hiding **data** (private fields) | Hiding **complexity** (how the work is done) |
| Car example | The engine is sealed so you can't break it | You only need wheel + pedals to drive |
| Code tool | `#private`, `readonly` | Simple methods, interfaces, abstract classes |

> 💡 Encapsulation is **the lock**. Abstraction is **the simple dashboard**.

## Abstraction in code

Here is an email sender. The caller only needs one method:

```ts
class EmailService {
  send(to: string, subject: string, body: string) {
    const message = this.#buildMime(to, subject, body);
    const connection = this.#connectToSmtp();
    this.#retry(() => connection.write(message), 3);
    connection.close();
  }

  // Hidden details: callers never see or call these
  #buildMime(to: string, subject: string, body: string) { /* headers, encoding… */ return ""; }
  #connectToSmtp() { /* host, port, TLS, login… */ return { write(_: string) {}, close() {} }; }
  #retry(fn: () => void, times: number) { /* backoff… */ fn(); }
}

// The caller's view: one simple line
new EmailService().send("ana@example.com", "Welcome!", "Thanks for signing up.");
```

The caller doesn't know about MIME, SMTP, TLS or retries. If you switch from SMTP to an email API later, **no caller has to change**.

## Interfaces: abstraction as a contract

An **interface** describes *what* something can do, with no code for *how*.

```ts
interface PaymentGateway {
  charge(amountCents: number, cardToken: string): Promise<string>; // returns a payment ID
  refund(paymentId: string): Promise<void>;
}
```

Any class that promises to follow the contract can be used:

```ts
class StripeGateway implements PaymentGateway {
  async charge(amountCents: number, cardToken: string) {
    // call Stripe's API…
    return "pi_123";
  }
  async refund(paymentId: string) { /* … */ }
}

class FakeGateway implements PaymentGateway {
  async charge() { return "fake_1"; } // for tests, no real money
  async refund() {}
}
```

Your checkout code depends only on the **abstraction**:

```ts
class Checkout {
  constructor(private payments: PaymentGateway) {}

  async pay(orderTotal: number, cardToken: string) {
    return this.payments.charge(orderTotal, cardToken);
  }
}

new Checkout(new StripeGateway()); // production
new Checkout(new FakeGateway());   // tests
```

`Checkout` doesn't know or care which payment provider is behind the interface. That's abstraction paying off.

## Abstract classes: a partly built blueprint

An **abstract class** can't be created with `new`. It gives subclasses some shared code and leaves some methods for them to fill in.

```ts
abstract class Report {
  // Shared steps: the same for every report
  generate() {
    const data = this.fetchData();
    return `${this.title()}\n${"-".repeat(20)}\n${this.format(data)}`;
  }

  // Each report type must fill these in
  protected abstract title(): string;
  protected abstract fetchData(): number[];
  protected abstract format(data: number[]): string;
}

class SalesReport extends Report {
  protected title() { return "Monthly sales"; }
  protected fetchData() { return [120, 340, 90]; }
  protected format(data: number[]) { return data.map((d) => `$${d}`).join("\n"); }
}

new SalesReport().generate();
// new Report(); ❌ Cannot create an instance of an abstract class
```

(Interfaces vs abstract classes get a full lesson later.)

## Good abstractions vs leaky ones

A **leaky abstraction** forces callers to know about the hidden details anyway.

```ts
// ❌ Leaky: the caller must know it's SQL underneath
userRepo.find("SELECT * FROM users WHERE email = ?", [email]);

// ✅ Good: describes what you want, hides how
userRepo.findByEmail(email);
```

| A good abstraction… | A leaky abstraction… |
| --- | --- |
| Uses words from the problem (`findByEmail`, `ship`) | Uses words from the implementation (`runSql`, `setFlag3`) |
| Has a few clear methods | Exposes lots of options and internals |
| Lets you swap the implementation | Ties callers to one technology |

## Common mistakes

- **Abstracting too early.** An interface with only one implementation "just in case" adds files without adding value. Wait until a second implementation or a test needs it.
- **Too many layers.** `UserManagerServiceFactoryProvider` hides nothing useful and slows everyone down.
- **Leaking details** through names, parameters or error types.

## Key takeaways

- Abstraction = **show what it does, hide how it does it**.
- Encapsulation protects data; abstraction hides complexity. They work together.
- **Interfaces** define a contract; **abstract classes** share partial code.
- Depend on abstractions so you can swap implementations, such as a real or fake payment gateway.

## Try it yourself

Design a `Storage` interface with `save(key, value)` and `load(key)`. Write two implementations: `MemoryStorage` (uses a `Map`) and `LocalStorage` (uses the browser's `localStorage`). Write code that works with either one.
