---
title: Advanced TypeScript for Frontend
summary: Model real UI states safely with generics, discriminated unions, conditional types and runtime schema validation at API boundaries.
level: Advanced
tags: [frontend, typescript, generics, zod, type-safety, api]
---

## Model impossible states out of the UI

TypeScript is most useful when it prevents invalid combinations before the browser runs. A discriminated union gives each screen state the fields it is allowed to use.

```ts
type OrderScreen =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; order: Order };

function OrderPanel({ screen }: { screen: OrderScreen }) {
  switch (screen.status) {
    case "loading": return <Spinner />;
    case "error": return <ErrorMessage message={screen.message} />;
    case "ready": return <OrderDetails order={screen.order} />;
  }
}
```

There is no `screen.order` to accidentally render while loading. The `status` field narrows the type for each branch.

## Use generics for reusable contracts

Generics preserve information instead of falling back to `any`.

```ts
type ApiSuccess<T> = { ok: true; data: T };
type ApiFailure = { ok: false; error: { code: string; message: string } };
type ApiResult<T> = ApiSuccess<T> | ApiFailure;

async function request<T>(url: string): Promise<ApiResult<T>> {
  const response = await fetch(url);
  return response.json() as Promise<ApiResult<T>>;
}
```

Generics describe the expected shape, but an HTTP response remains untrusted at runtime. Validate it before it enters application state.

## Validate unknown data at the boundary

```ts
import { z } from "zod";

const orderSchema = z.object({
  id: z.string(),
  status: z.enum(["draft", "paid", "cancelled"]),
  totalCents: z.number().int().nonnegative(),
});
type Order = z.infer<typeof orderSchema>;

export async function getOrder(id: string): Promise<Order> {
  const json: unknown = await fetch(`/api/orders/${id}`).then((r) => r.json());
  return orderSchema.parse(json);
}
```

Use `unknown` for untrusted inputs. `any` disables the compiler exactly where a network or form boundary needs protection.

## Conditional types and utility types

Use advanced types to derive facts from a source of truth, not to make a simple component unreadable.

```ts
type ApiResponse<T> = T extends { id: infer Id }
  ? { item: T; id: Id }
  : never;

type OrderPreview = Pick<Order, "id" | "status">;
type OrderPatch = Partial<Pick<Order, "status">>;
```

`infer`, `Pick`, `Omit`, `Record`, `ReturnType` and conditional types can remove duplication. Stop when the type becomes harder to understand than the runtime code it protects.

## Key takeaways

- Use discriminated unions for loading, success and error states.
- Use generics to keep reusable APIs type-safe.
- Parse external data at runtime; TypeScript alone cannot validate an HTTP response.
- Prefer clear types over clever type-level programs.
