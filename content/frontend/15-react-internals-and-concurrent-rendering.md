---
title: React Internals & Concurrent Rendering
summary: Understand reconciliation, render versus commit, batching, Suspense and concurrent rendering so React performance fixes target the work users actually feel.
level: Advanced
tags: [frontend, react, reconciliation, fiber, suspense, concurrency, performance]
---

## Render is not commit

React first calculates what the UI should look like (**render**), then applies the required DOM changes (**commit**). Rendering can be restarted or interrupted in concurrent React; commit is the visible, synchronous update.

```mermaid
flowchart LR
    S[State update] --> R[Render: calculate tree]
    R --> D[Reconcile old and new tree]
    D --> C[Commit: update DOM]
    C --> E[Effects run]
```

This distinction explains why code in render must be pure. Rendering may happen more than once; network calls and other side effects belong in event handlers, effects, or server code.

## Reconciliation and keys

React compares the previous and next element trees. In a list, stable keys tell it which item is which.

```tsx
// Good: preserves each item's identity when order changes.
{orders.map((order) => <OrderRow key={order.id} order={order} />)}

// Risky: an index changes identity after an insert, removal or sort.
{orders.map((order, index) => <OrderRow key={index} order={order} />)}
```

Keys are not merely warnings: unstable keys can cause lost input state, remounts and incorrect UI.

## Why a component re-renders

A component renders when its own state changes, its parent renders, a consumed context changes, or its identity/key changes. A render is not automatically a problem. Profile first, then reduce only expensive or user-visible work.

```tsx
const filteredOrders = useMemo(
  () => orders.filter((order) => order.status === filter),
  [orders, filter],
);
```

`useMemo` helps only when the calculation is costly or its stable identity prevents a measured downstream render. It adds complexity and is not a default performance switch.

## Batching and transitions

React batches updates from one interaction. Mark non-urgent work as a transition so typing and clicks stay responsive while a large result set updates.

```tsx
const [query, setQuery] = useState("");
const [isPending, startTransition] = useTransition();

function onChange(value: string) {
  setQuery(value); // urgent: input must reflect typing
  startTransition(() => setSearchTerm(value)); // may yield to interaction
}
```

Transitions do not speed up an expensive calculation; they allow React to prioritize urgent work. Measure and fix the expensive path if it remains slow.

## Suspense and streaming

Suspense shows a fallback while a component's data or code is unavailable. With server rendering, independent sections can stream as they become ready instead of making the whole page wait.

```tsx
<Suspense fallback={<OrdersSkeleton />}>
  <Orders />
</Suspense>
```

Place boundaries around meaningful sections so a slow recommendation panel does not hide an already-available order summary. Provide loading, error and empty states for each independent boundary.

## Key takeaways

- Render calculates; commit changes the DOM; effects happen afterward.
- Stable keys preserve component identity in lists.
- Profile before memoizing or wrapping components in `memo`.
- Use transitions for non-urgent updates and Suspense for meaningful loading boundaries.
