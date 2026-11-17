---
title: Python Fundamentals
summary: "Python from the ground up: virtual environments, types and mutability, lists/tuples/dicts/sets, comprehensions, functions with *args and **kwargs, classes and dataclasses, exceptions, context managers, generators, type hints and the GIL."
level: Beginner
tags: [languages, python, virtualenv, dataclasses, generators]
---

## The big idea

Python was designed to be **read like plain English**. Indentation *is* the structure, there are few symbols, and there is usually "one obvious way to do it". That's why it's the first language for many people, and the glue language for automation, data science and AI.

Picture a well-organised **kitchen drawer**: every tool has a clear name and place. Python's built-in types (`list`, `dict`, `set`, `tuple`) are those tools; learn them well and most programs become short.

![Python's core collections and when to use each](/img/languages/python-collections.svg)

## Setup: one virtual environment per project

A **virtual environment** is a private folder of packages for one project, so project A's Django 4 doesn't fight project B's Django 5.

```bash
python -m venv .venv
source .venv/bin/activate        # macOS / Linux
.venv\Scripts\Activate.ps1       # Windows PowerShell

python -m pip install requests
python -m pip freeze > requirements.txt
```

> 💡 Modern tools such as **uv** or **Poetry** manage the virtual environment, dependencies and a lock file for you: `uv init`, `uv add requests`, `uv run main.py`.

## Values, types and mutability

Everything in Python is an **object**; variables are **name tags** attached to objects.

| Type | Example | Mutable? |
| --- | --- | --- |
| `int`, `float`, `bool` | `42`, `3.14`, `True` | ❌ |
| `str` | `"hello"` | ❌ |
| `tuple` | `(1, 2)` | ❌ |
| `list` | `[1, 2, 3]` | ✅ |
| `dict` | `{"a": 1}` | ✅ |
| `set` | `{1, 2}` | ✅ |
| `None` | "no value" | — |

```python
a = [1, 2]
b = a          # two name tags on the SAME list
b.append(3)
print(a)       # [1, 2, 3]

c = a.copy()   # a new list (shallow copy); use copy.deepcopy for nested data

x = None
x is None      # ✅ `is` checks identity — use it for None
[1] == [1]     # True  — same value
[1] is [1]     # False — different objects
```

## Strings and control flow

```python
name, score = "Ana", 91.456
print(f"{name} scored {score:.1f}%")      # f-strings: Ana scored 91.5%

if score >= 90:
    grade = "A"
elif score >= 75:
    grade = "B"
else:
    grade = "C"

for i, item in enumerate(["tea", "milk"], start=1):
    print(i, item)

for a, b in zip(["x", "y"], [1, 2]):       # iterate two lists together
    print(a, b)

match command.split():                     # structural pattern matching (3.10+)
    case ["go", direction]:
        move(direction)
    case ["quit" | "exit"]:
        stop()
    case _:
        print("Unknown command")
```

## Collections ⭐

```python
fruits = ["apple", "banana"]      # list: ordered, changeable
fruits.append("cherry")
fruits[0], fruits[-1], fruits[1:3] # first, last, slice

point = (3, 4)                    # tuple: fixed record, can be a dict key
x, y = point                      # unpacking

user = {"name": "Ana", "age": 30} # dict: key → value, O(1) lookup
user.get("email", "n/a")          # safe read with a default
for key, value in user.items():
    print(key, value)

tags = {"python", "api", "python"} # set: unique values → {"python", "api"}
tags & {"api", "web"}              # intersection → {"api"}
```

| Need | Use | Lookup cost |
| --- | --- | --- |
| Ordered items you add to | `list` | `x in list` is O(n) |
| Fixed group of values | `tuple` | — |
| Look up by key | `dict` | O(1) |
| Uniqueness / membership tests | `set` | `x in set` is O(1) |
| Counting | `collections.Counter` | — |
| Default values for missing keys | `collections.defaultdict` | — |

### Comprehensions

```python
squares = [n * n for n in range(10)]                     # list
evens = [n for n in numbers if n % 2 == 0]               # with a filter
by_id = {u["id"]: u for u in users}                      # dict
domains = {email.split("@")[1] for email in emails}      # set
total = sum(order["total"] for order in orders)          # generator: no list built
```

## Functions

```python
def greet(name: str, greeting: str = "Hello") -> str:
    """Return a greeting. (This is a docstring.)"""
    return f"{greeting}, {name}!"

greet("Ana")                        # positional
greet(greeting="Hi", name="Bo")     # keyword

def log(message, *args, **kwargs):  # *args = extra positional (tuple), **kwargs = extra keyword (dict)
    print(message, args, kwargs)

log("saved", 1, 2, user="ana")      # saved (1, 2) {'user': 'ana'}
```

> ⚠️ **The mutable default trap.** Defaults are created **once**, when the function is defined.
>
> ```python
> def add_item(item, bucket=[]):      # ❌ the same list is reused on every call
>     bucket.append(item); return bucket
>
> def add_item(item, bucket=None):    # ✅
>     bucket = [] if bucket is None else bucket
>     bucket.append(item); return bucket
> ```

### Decorators

A decorator is a function that wraps another function.

```python
import functools, time

def timed(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            print(f"{fn.__name__} took {time.perf_counter() - start:.3f}s")
    return wrapper

@timed
def slow_sum(n):
    return sum(range(n))
```

## Classes and dataclasses

```python
from dataclasses import dataclass, field

@dataclass
class Product:
    name: str
    price: float
    tags: list[str] = field(default_factory=list)   # safe mutable default

    @property
    def price_with_tax(self) -> float:
        return round(self.price * 1.2, 2)

p = Product("Mug", 10.0)
print(p)                 # Product(name='Mug', price=10.0, tags=[]) — free __repr__
p == Product("Mug", 10)  # True — free __eq__
```

`@dataclass` writes `__init__`, `__repr__` and `__eq__` for you. Use `@dataclass(frozen=True)` for immutable values. For a normal class, `self` is the instance, `__init__` is the constructor, and "dunder" methods (`__len__`, `__str__`, `__iter__`) let your objects work with built-in functions.

## Errors and context managers

```python
class InsufficientFunds(Exception):
    pass

def withdraw(balance: float, amount: float) -> float:
    if amount > balance:
        raise InsufficientFunds(f"Balance {balance} is less than {amount}")
    return balance - amount

try:
    withdraw(10, 50)
except InsufficientFunds as err:
    print("Declined:", err)
except (ValueError, TypeError):
    print("Bad input")
else:
    print("Success")          # only if no exception
finally:
    print("Always runs")
```

A **context manager** (`with`) guarantees cleanup even when an error happens:

```python
from pathlib import Path

with open("report.txt", "w", encoding="utf-8") as f:   # file closed automatically
    f.write("done\n")

text = Path("report.txt").read_text(encoding="utf-8")  # pathlib: modern file paths
```

## Iterators and generators

A **generator** produces values one at a time with `yield`, so it can process huge data with little memory.

```python
def read_errors(path):
    with open(path, encoding="utf-8") as f:
        for line in f:                 # the file is read lazily, line by line
            if "ERROR" in line:
                yield line.rstrip()

for error in read_errors("app.log"):   # works for a 10 GB file
    print(error)
```

## Modules and the entry point

```python
# shop/pricing.py
def apply_discount(price: float, percent: float) -> float:
    return price * (1 - percent / 100)

# main.py
from shop.pricing import apply_discount

def main() -> None:
    print(apply_discount(100, 15))

if __name__ == "__main__":   # run only when executed directly, not when imported
    main()
```

## Type hints

Python ignores hints at runtime, but tools (**mypy**, **pyright**, your editor) use them to catch bugs.

```python
from typing import Literal, TypedDict

Status = Literal["pending", "paid", "shipped"]

class OrderRow(TypedDict):
    id: int
    status: Status
    total: float

def unpaid(orders: list[OrderRow]) -> list[int]:
    return [o["id"] for o in orders if o["status"] == "pending"]

def find(user_id: int) -> dict | None: ...
```

## Concurrency and the GIL

CPython has a **Global Interpreter Lock**: only one thread runs Python bytecode at a time.

| Work type | Best tool | Why |
| --- | --- | --- |
| I/O-bound (HTTP, DB, files) | `asyncio` or threads | Threads release the GIL while waiting |
| CPU-bound (math, image processing) | `multiprocessing` / `ProcessPoolExecutor` | Separate processes, separate GILs |
| Heavy numeric work | NumPy, pandas | The hot loops run in C, outside the GIL |

```python
import asyncio, httpx

async def fetch_all(urls: list[str]) -> list[int]:
    async with httpx.AsyncClient(timeout=5) as client:
        responses = await asyncio.gather(*(client.get(u) for u in urls))
        return [r.status_code for r in responses]

print(asyncio.run(fetch_all(["https://example.com"] * 5)))
```

> 📘 Python 3.13 added an experimental **free-threaded** build without the GIL. It's promising, but most production code still assumes the GIL.

## Testing with pytest

```python
# test_pricing.py
import pytest
from shop.pricing import apply_discount

def test_discount():
    assert apply_discount(100, 15) == 85

@pytest.mark.parametrize("price, percent, expected", [(50, 10, 45), (10, 0, 10)])
def test_discount_cases(price, percent, expected):
    assert apply_discount(price, percent) == pytest.approx(expected)
```

## Libraries worth knowing first

| Area | Libraries |
| --- | --- |
| Standard library | `pathlib`, `json`, `datetime`, `collections`, `itertools`, `logging`, `argparse` |
| HTTP clients | `httpx`, `requests` |
| Web / APIs | FastAPI, Django, Flask, Pydantic |
| Databases | SQLAlchemy, psycopg, Alembic |
| Data | pandas, NumPy, Polars, Matplotlib |
| Quality | pytest, Ruff, mypy |

## Key takeaways

- One **virtual environment** per project; pin dependencies.
- Variables are name tags: know which types are **mutable**, and never use a mutable default argument.
- Master `list`, `tuple`, `dict`, `set` and **comprehensions**; they replace most loops.
- Use `@dataclass`, exceptions with `try/except/else/finally`, and `with` for anything that needs cleanup.
- Generators process large data lazily; `asyncio` for I/O, processes for CPU-heavy work (because of the GIL).
