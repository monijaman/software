---
title: Python for Automation and APIs
summary: Python fundamentals, environments and web frameworks.
level: Beginner
tags: [languages, python, fastapi, django]
---

# Python for Automation and APIs

Python prioritizes readability: indentation defines blocks, functions are written with `def`, and package environments isolate dependencies. Start with values, lists/dictionaries, loops, functions, exceptions, files and tests. Use a virtual environment so one project’s packages do not change another’s.

```python
def total(prices: list[float]) -> float:
    return sum(prices)

if __name__ == "__main__":
    print(total([12.5, 7.5]))
```

Use FastAPI when you want typed API endpoints and automatic OpenAPI documentation; Django provides an all-in-one web framework with ORM and admin. Keep business logic independent of the web framework so it is easy to test. The language notes include beginner exercises, libraries, Django and FastAPI.
