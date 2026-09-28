---
title: Stacks & Queues
summary: Stacks are last-in-first-out, queues are first-in-first-out. Two simple structures behind undo buttons, browser history, task scheduling and many interview problems.
level: Beginner
tags: [dsa, stack, queue, deque]
---

## The big idea

![A stack of plates (last in, first out) and a queue at a ticket counter (first in, first out)](/img/dsa/stack-queue.svg)

- **Stack (LIFO — Last In, First Out):** a pile of plates. You add to the top and take from the top.
- **Queue (FIFO — First In, First Out):** a line at a coffee shop. First to arrive, first to be served.

## Stack

| Operation | Meaning | JS | Cost |
| --- | --- | --- | --- |
| `push(x)` | put on top | `arr.push(x)` | O(1) |
| `pop()` | take from top | `arr.pop()` | O(1) |
| `peek()` | look at top | `arr.at(-1)` | O(1) |
| `isEmpty()` | | `arr.length === 0` | O(1) |

```js
const stack = [];
stack.push("a"); // ["a"]
stack.push("b"); // ["a", "b"]
stack.pop();     // "b" → ["a"]
```

### Where stacks appear

```mermaid
flowchart LR
    S((Stack)) --> U["↩️ Undo / redo"]
    S --> B["⬅️ Browser back button"]
    S --> C["📞 Function call stack"]
    S --> P["🧮 Parsing brackets & expressions"]
    S --> D["🌲 Depth-first search"]
```

### The call stack

Every time a function calls another, JavaScript pushes a **frame** onto the call stack. When a function returns, its frame is popped.

```js
function a() { b(); }
function b() { c(); }
function c() { console.trace(); }
a();
```

```mermaid
flowchart TB
    subgraph CallStack["Call stack (top is running)"]
      direction TB
      c["c() ⬅ running"] --- b["b()"] --- a["a()"] --- g["global"]
    end
```

Infinite recursion keeps pushing frames until: **"RangeError: Maximum call stack size exceeded"**. That's a *stack overflow*.

### Classic problem: valid parentheses ⭐

`"({[]})"` ✅ · `"([)]"` ❌ · `"(("` ❌

```js
function isValid(s) {
  const pairs = { ")": "(", "]": "[", "}": "{" };
  const stack = [];
  for (const ch of s) {
    if ("([{".includes(ch)) stack.push(ch);            // opener → push
    else if (stack.pop() !== pairs[ch]) return false;  // closer must match the top
  }
  return stack.length === 0; // nothing left open
}
```

```mermaid
flowchart LR
    a["read ( → push<br/>stack: ("] --> b["read { → push<br/>stack: ( {"] --> c["read } → pop { ✅<br/>stack: ("] --> d["read ) → pop ( ✅<br/>stack: empty"] --> e["empty → valid ✅"]
```

### Monotonic stack: "next greater element"

For each number, find the next number to the right that is bigger. Brute force is O(n²); a stack does it in O(n).

```js
function nextGreater(nums) {
  const result = new Array(nums.length).fill(-1);
  const stack = []; // indexes still waiting for a bigger number
  for (let i = 0; i < nums.length; i++) {
    while (stack.length && nums[i] > nums[stack.at(-1)]) {
      result[stack.pop()] = nums[i];
    }
    stack.push(i);
  }
  return result;
}
nextGreater([2, 1, 5, 3, 6]); // [5, 5, 6, 6, -1]
```

Used for "daily temperatures", "stock span" and "largest rectangle in histogram".

## Queue

| Operation | Meaning | Cost (proper queue) |
| --- | --- | --- |
| `enqueue(x)` | join the back | O(1) |
| `dequeue()` | leave the front | O(1) |
| `peek()` | look at the front | O(1) |

> ⚠️ **JavaScript trap:** `arr.shift()` is **O(n)** because every element moves. Fine for small arrays; slow for big queues.

### An O(1) queue

```js
class Queue {
  #items = new Map();
  #head = 0;
  #tail = 0;

  enqueue(value) { this.#items.set(this.#tail++, value); }
  dequeue() {
    if (this.#head === this.#tail) return undefined;
    const value = this.#items.get(this.#head);
    this.#items.delete(this.#head++);
    return value;
  }
  get size() { return this.#tail - this.#head; }
}
```

### Where queues appear

```mermaid
flowchart LR
    Q((Queue)) --> P["🖨️ Print jobs"]
    Q --> E["⚙️ Event loop task queue"]
    Q --> B["📨 Message brokers<br/>RabbitMQ, SQS, Kafka"]
    Q --> R["🚦 Rate limiting & buffering"]
    Q --> BFS["🌊 Breadth-first search"]
```

### Queue flavours

| Type | Rule | Example |
| --- | --- | --- |
| **Queue** | First in, first out | Ticket line |
| **Deque** (double-ended) | Add/remove at both ends | Sliding window maximum |
| **Priority queue** | Highest priority out first | ER triage, Dijkstra (see *Heaps*) |
| **Circular buffer** | Fixed size, wraps around | Audio buffers, recent logs |

## Stack vs Queue in search

The **only** difference between depth-first and breadth-first search is the container:

```mermaid
flowchart LR
    subgraph DFS["Stack → DFS: go deep first"]
      d1[A] --> d2[B] --> d3[D]
    end
    subgraph BFS["Queue → BFS: level by level"]
      b1[A] --> b2[B] & b3[C]
    end
```

You'll see this in the *Graphs* lesson.

## Key takeaways

- **Stack = LIFO** (plates). `push`/`pop` on a JS array are O(1).
- **Queue = FIFO** (a line). Avoid `shift()` on large arrays; use a proper queue.
- Stacks: undo, call stack, bracket matching, DFS, monotonic-stack problems.
- Queues: task scheduling, message brokers, the event loop, BFS.
