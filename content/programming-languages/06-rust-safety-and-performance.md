---
title: "Rust: Safety and Performance"
summary: Ownership, borrowing, error handling and systems programming foundations.
level: Intermediate
tags: [languages, rust, ownership, performance]
---

# Rust: Safety and Performance

Rust aims for low-level performance while preventing many memory and data-race mistakes at compile time. Its ownership system means each value has one owner; borrowing lets code temporarily read or mutate without transferring ownership. `Option<T>` represents a value that may be absent and `Result<T, E>` represents success or an error.

```rust
fn first_name(names: &[String]) -> Option<&String> {
    names.first()
}
```

Start with Cargo, variables, functions, structs, enums, pattern matching, ownership, borrowing and error handling. Prefer returning `Result` and handling errors deliberately instead of panicking in normal application paths. The Theoretical Rust notes include a complete guide and interview questions with answers.
