---
title: Go Fundamentals
summary: "Go explained term by term: modules and packages, variables and zero values, strings and runes, arrays, slices and maps, functions, structs, pointers, methods and receivers, implicit interfaces, errors as values, defer/panic/recover, generics and tests, each with a plain-English definition, a diagram and a worked example."
level: Beginner
tags: [languages, go, golang, interfaces, errors, pointers, slices]
---

## The big idea

Go (often called **Golang**) was created at Google in 2009 to make **large teams productive on large codebases**. Its designers removed features rather than adding them:

- **25 keywords** (Java has over 50, C++ over 90).
- **One formatting style**, applied automatically by `gofmt`, so nobody argues about tabs or braces.
- **One loop keyword** (`for`), no classes, no inheritance, no exceptions.

The code is sometimes a little longer, but **anyone on the team can read anyone's code**.

Think of Go as a **flat-pack toolbox from one brand**: every screw fits every hole, the instructions are always in the same format, and there are no special adapters to learn.

![Go at a glance: small language, fast compiler, one static binary](/img/languages/go-overview.svg)

### Where Go shines

| Good fit | Why |
| --- | --- |
| Web APIs and microservices | Fast, low memory, excellent HTTP library built in |
| Command-line tools | Compiles to **one file** you can copy anywhere |
| Cloud infrastructure | Docker, Kubernetes, Terraform and Prometheus are all written in Go |
| Concurrent network programs | Goroutines and channels (next lesson) make concurrency cheap |

## Words you'll meet in this lesson

| Term | Plain-English meaning |
| --- | --- |
| **Module** | Your whole project, described by a `go.mod` file |
| **Package** | One folder of `.go` files that belong together |
| **Exported** | Visible to other packages: the name starts with a **Capital** letter |
| **Zero value** | The value a variable has before you assign anything (`0`, `""`, `false`, `nil`) |
| **Slice** | A resizable list that is really a *window* onto an array |
| **Map** | A key → value lookup table (like a dictionary or JS object) |
| **Struct** | A custom type that groups named fields, like a record |
| **Pointer** | A variable that holds the **address** of another value, not the value itself |
| **Method** | A function attached to a type |
| **Receiver** | The value a method is called on (Go's version of `this`) |
| **Interface** | A list of methods; any type that has them fits automatically |
| **error** | A normal return value that describes what went wrong |
| **defer** | "Run this when the function finishes", used for cleanup |
| **Generics** | Functions and types that work with many types, checked by the compiler |

## Modules, packages and imports

![A module contains packages; each package is a folder of files, and capitalised names are visible outside the package](/img/languages/go-project-structure.svg)

### Module

A **module** is your project. The `go.mod` file at the top records the module's name (usually its repository path), the Go version, and the libraries it depends on.

```bash
go mod init github.com/you/shop     # creates go.mod
```

```text
module github.com/you/shop

go 1.23

require github.com/gin-gonic/gin v1.10.0
```

`go.sum` sits next to it and stores a checksum for every dependency, so nobody can secretly swap a library's code. Commit both files.

### Package

A **package** is a folder of `.go` files. Every file starts with `package <name>`, and all files in the folder share the same name and can see each other's private names.

```text
shop/
├── go.mod
├── cmd/api/main.go        # package main: the program starts here
└── internal/              # "internal" = only this module may import it
    ├── orders/            # package orders
    │   ├── orders.go
    │   └── orders_test.go # tests live beside the code
    └── store/             # package store
```

- **`package main`** is special: it becomes a runnable program, and its `func main()` is where execution starts.
- Every other package is a **library** that `main` (or other packages) can import.

```go
package main

import (
	"fmt"                                    // standard library
	"github.com/you/shop/internal/orders"    // your own package, by module path
)

func main() {
	total := orders.Total([]int{1200, 850})  // calling an exported function
	fmt.Println("Total:", total)             // Total: 2050
}
```

### Exported vs unexported: the capital letter rule ⭐

Go has no `public` or `private` keywords. **The first letter decides:**

| Name | Visible from other packages? |
| --- | --- |
| `Order`, `Total()`, `MaxItems` | ✅ Yes: **exported** |
| `order`, `total()`, `maxItems` | ❌ No: only inside its own package |

This applies to types, functions, variables, constants, **and struct fields**.

### Everyday commands

| Command | What it does |
| --- | --- |
| `go run .` | Compile and run the package in this folder |
| `go build -o shop ./cmd/api` | Produce one executable file called `shop` |
| `go test ./...` | Run every test in every package (`./...` means "this folder and below") |
| `go get github.com/gin-gonic/gin` | Add or upgrade a dependency |
| `go mod tidy` | Add missing and remove unused dependencies |
| `gofmt -w .` / `go vet ./...` | Format the code / find suspicious code |

> 💡 `go build` produces a **static binary**: a single file containing your program and everything it needs. No Go installation is required on the server; copy the file and run it.

## Variables, constants and types

### Declaring variables

```go
var count int            // declared, not assigned → 0 (its zero value)
var name string = "Ana"  // declared with a type and a value
city := "Lisbon"         // short declaration: Go infers the type (string)

a, b := 1, 2             // several at once
a, b = b, a              // swap: a=2, b=1
```

| Form | Where you can use it | Typical use |
| --- | --- | --- |
| `var x int` | Anywhere | You want the zero value, or a package-level variable |
| `var x = 5` / `var x int = 5` | Anywhere | Explicit type, package level |
| `x := 5` | **Only inside functions** | Most local variables |

> ⚠️ `:=` *declares* a new variable; `=` *assigns* to an existing one. Go refuses to compile if you declare a variable and never use it, which catches many typos.

### Constants and `iota`

A **constant** is fixed when the program is compiled and can never change.

```go
const maxRetries = 3
const Pi = 3.14159

type Status int

const (
	Pending  Status = iota // 0: iota counts up inside a const block
	Paid                   // 1
	Shipped                // 2
	Cancelled              // 3
)
```

`iota` is a counter that starts at 0 in each `const` block, which makes it handy for enums.

### Basic types

| Type | Holds | Example |
| --- | --- | --- |
| `int`, `int64`, `int32` | Whole numbers (`int` is 64-bit on modern machines) | `42` |
| `uint8` / `byte` | 0 to 255 | `'A'` (65) |
| `float64` | Decimal numbers | `9.99` |
| `bool` | `true` / `false` | `true` |
| `string` | Read-only text (UTF-8 bytes) | `"héllo"` |
| `rune` | One Unicode character (an `int32`) | `'é'` |

Go **never converts types automatically**, even between number types:

```go
var i int = 10
var f float64 = 2.5
// total := i + f          ❌ compile error: mismatched types
total := float64(i) + f    // ✅ explicit conversion → 12.5
```

### Zero values ⭐

Every variable in Go starts with a **zero value**. There is no such thing as an uninitialised or random value.

| Type | Zero value |
| --- | --- |
| Numbers | `0` |
| `string` | `""` (empty string) |
| `bool` | `false` |
| Pointer, slice, map, channel, function, interface | `nil` ("nothing") |
| Struct | Every field set to its own zero value |

Good Go types are designed to be **useful at their zero value**. `var mu sync.Mutex` is an unlocked mutex ready to use, and `var buf bytes.Buffer` is an empty buffer you can write to immediately, with no constructor needed.

### Strings, bytes and runes

A `string` is a read-only sequence of **bytes**, encoded as UTF-8. English letters take 1 byte, but `é` takes 2 and many emoji take 4.

```go
s := "héllo"
fmt.Println(len(s))          // 6: bytes, not characters!

for i, r := range s {        // range over a string gives runes
	fmt.Println(i, string(r)) // 0 h, 1 é, 3 l, 4 l, 5 o  (é used bytes 1 and 2)
}

fmt.Println(utf8.RuneCountInString(s)) // 5 characters
```

Strings can't be changed in place. To build one piece by piece efficiently, use `strings.Builder`:

```go
var sb strings.Builder
for i := range 3 {
	fmt.Fprintf(&sb, "line %d\n", i)
}
result := sb.String()
```

## Control flow

### `for`: the only loop

```go
for i := 0; i < 3; i++ { }               // classic: init; condition; post
for n < 100 { n *= 2 }                    // like "while"
for { if done() { break } }               // forever, until break
for i := range 5 { }                      // Go 1.22+: i = 0..4
for i, v := range []string{"a", "b"} {   // index and value
	fmt.Println(i, v)                     // 0 a, 1 b
}
for _, v := range items { }               // _ ignores the index
```

The `_` (blank identifier) means "I don't need this value".

### `if` with a short statement

```go
if err := save(order); err != nil {   // err only exists inside this if/else
	return err
}
```

This pattern keeps temporary variables out of the rest of the function.

### `switch`

```go
switch day {
case "sat", "sun":
	fmt.Println("weekend")
default:
	fmt.Println("weekday")
}

switch {                     // no value: works like a clean if/else chain
case score >= 90:
	grade = "A"
case score >= 75:
	grade = "B"
default:
	grade = "C"
}
```

Unlike C or JavaScript, a Go `case` **does not fall through** to the next one, so you never need `break`.

## Arrays, slices and maps ⭐

### Arrays: fixed size

An **array** has a length that is part of its type. `[3]int` and `[4]int` are different types. You rarely use arrays directly; they are the storage underneath slices.

```go
var scores [3]int        // [0 0 0]
scores[0] = 90
```

### Slices: Go's everyday list

A **slice** is a small descriptor (a *header*) with three parts:

- a **pointer** to an element in an underlying array,
- a **length** (`len`): how many elements you can use,
- a **capacity** (`cap`): how much room there is before Go must allocate a bigger array.

![A slice header points into a shared array; append writes in place while there is capacity, then copies everything to a new, bigger array](/img/languages/go-slice-internals.svg)

```go
nums := []int{10, 20, 30}         // len 3, cap 3
fmt.Println(len(nums), cap(nums)) // 3 3

nums = append(nums, 40)           // no room → Go allocates a bigger array and copies
fmt.Println(len(nums), cap(nums)) // 4 6  (capacity roughly doubles for small slices)
```

> ⚠️ **Always assign the result of `append`:** `nums = append(nums, x)`. `append` may return a slice pointing to a *new* array, and the old variable would still point to the old one.

**Slicing shares memory.** `nums[1:3]` means "from index 1 up to, but not including, index 3":

```go
part := nums[1:3]       // [20 30]: a new header, SAME underlying array
part[0] = 99
fmt.Println(nums)       // [10 99 30 40]: nums changed too!

safe := slices.Clone(part) // an independent copy
safe[0] = 1             // nums is unaffected
```

**Preallocate** when you know roughly how many items you'll add, to avoid repeated copying:

```go
ids := make([]string, 0, len(users)) // len 0, cap = number of users
for _, u := range users {
	ids = append(ids, u.ID)          // never reallocates
}
```

| `nil` slice vs empty slice | `var s []int` | `s := []int{}` |
| --- | --- | --- |
| `len(s)` | 0 | 0 |
| `s == nil` | `true` | `false` |
| `append` works? | ✅ | ✅ |
| JSON encoding | `null` | `[]` |

### Maps: key → value

```go
ages := map[string]int{"ana": 30, "bo": 25}   // literal
ages["cy"] = 41                               // add or update

age := ages["zed"]               // missing key → zero value (0), no error!
age, ok := ages["zed"]           // "comma ok": ok is false if the key is missing
if !ok {
	fmt.Println("no such person")
}

delete(ages, "bo")
fmt.Println(len(ages))           // 2

for name, age := range ages {    // order is deliberately random each run
	fmt.Println(name, age)
}
```

> ⚠️ A `nil` map can be **read** but not **written**: `var m map[string]int; m["a"] = 1` panics. Create maps with `make(map[string]int)` or a literal. Maps are also **not safe for concurrent writes** (see the concurrency lesson).

## Functions

A function can return **several values**. The last one is usually an `error`:

```go
func divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, errors.New("division by zero")
	}
	return a / b, nil // nil error = success
}

result, err := divide(10, 2)
if err != nil {
	log.Fatal(err)
}
fmt.Println(result) // 5
```

**Variadic functions** accept any number of arguments:

```go
func sum(nums ...int) int {   // nums is a []int inside the function
	total := 0
	for _, n := range nums {
		total += n
	}
	return total
}

sum(1, 2, 3)          // 6
values := []int{4, 5}
sum(values...)        // 9: spread a slice into the arguments
```

**Functions are values.** You can store them in variables and pass them around. A **closure** is a function that remembers variables from where it was created:

```go
func makeCounter() func() int {
	n := 0                     // lives on after makeCounter returns
	return func() int {
		n++
		return n
	}
}

next := makeCounter()
next() // 1
next() // 2
```

> 💡 Go passes **everything by value**: the function gets a copy. For a struct, that's a copy of all its fields. For a slice or map, it's a copy of the small header, which still points to the same underlying data. That's why a function can change a slice's elements but not its length as seen by the caller.

## Structs

A **struct** groups related fields into one type, like a row in a table.

```go
type User struct {
	ID        string
	Name      string
	Email     string
	Age       int
	CreatedAt time.Time
	admin     bool // lowercase: not visible outside this package
}

u := User{ID: "u1", Name: "Ana", Email: "ana@example.com"} // named fields (preferred)
u.Name = "Ana Silva"                                        // access with a dot
var empty User                                              // every field at its zero value
```

**Struct tags** are small labels that libraries read, for example to name JSON fields:

```go
type Product struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Price int64  `json:"price_cents"`
	Notes string `json:"notes,omitempty"` // omitted from JSON when empty
}

data, _ := json.Marshal(Product{ID: 7, Name: "Mug", Price: 1299})
fmt.Println(string(data)) // {"id":7,"name":"Mug","price_cents":1299}
```

## Pointers ⭐

A **pointer** holds the **memory address** of a value: not the house, but the house's street address. With the address, you can go and change the original.

![Passing a value gives the function a photocopy; passing a pointer gives it the address of the original, so changes are visible to the caller](/img/languages/go-pointers.svg)

| Symbol | Read it as | Example |
| --- | --- | --- |
| `*T` (in a type) | "pointer to a T" | `var p *int` |
| `&x` | "the address of x" | `p = &x` |
| `*p` (in an expression) | "the value at that address" | `*p = 20` |

```go
x := 10
p := &x          // p holds the address of x
fmt.Println(*p)  // 10: read through the pointer
*p = 20          // write through the pointer
fmt.Println(x)   // 20: x itself changed
```

Why it matters:

```go
func birthdayCopy(u User)     { u.Age++ } // changes a copy, which is thrown away
func birthdayPtr(u *User)     { u.Age++ } // changes the original

ana := User{Name: "Ana", Age: 30}
birthdayCopy(ana)
fmt.Println(ana.Age) // 30
birthdayPtr(&ana)
fmt.Println(ana.Age) // 31
```

Notice `u.Age` works on a pointer too: Go automatically follows the pointer for field access, so you don't write `(*u).Age`.

Things Go does **not** have: pointer arithmetic (`p++` to walk memory), or manual `free`. The **garbage collector** frees memory when nothing points to it, so it's safe to return a pointer to a local variable:

```go
func NewUser(name string) *User {
	return &User{Name: name} // fine in Go: the value survives the function
}
```

A pointer that points nowhere is `nil`. Using it causes the most common Go crash:

```go
var u *User
fmt.Println(u.Name) // 💥 panic: invalid memory address or nil pointer dereference
```

## Methods and receivers

A **method** is a function attached to a type. The **receiver** is written in parentheses before the method name; it's Go's version of `this` or `self`.

```go
type Account struct {
	Owner   string
	Balance int64 // cents: never use float for money
}

// Value receiver: gets a COPY of the account. Good for reading.
func (a Account) CanAfford(amount int64) bool {
	return a.Balance >= amount
}

// Pointer receiver: gets the ADDRESS. Needed to change the account.
func (a *Account) Withdraw(amount int64) error {
	if !a.CanAfford(amount) {
		return ErrInsufficientFunds
	}
	a.Balance -= amount
	return nil
}

acc := Account{Owner: "Ana", Balance: 10_000}
acc.Withdraw(2_500)        // Go takes &acc automatically
fmt.Println(acc.Balance)   // 7500
```

| Use a **pointer receiver** `(a *T)` when… | Use a **value receiver** `(a T)` when… |
| --- | --- |
| The method changes the struct | The method only reads |
| The struct is large (copying is wasteful) | The type is small, like `Point` or `Money` |
| The struct contains a `sync.Mutex` (must never be copied) | You want the value to behave like an immutable number |

> 💡 **Be consistent:** if any method of a type needs a pointer receiver, give all of its methods pointer receivers.

### Constructors

Go has no constructors. By convention you write a function called `NewX` that returns a ready-to-use value:

```go
func NewAccount(owner string) (*Account, error) {
	if owner == "" {
		return nil, errors.New("owner is required")
	}
	return &Account{Owner: owner}, nil
}
```

### Embedding: composition instead of inheritance

Go has no `extends`. Instead you **embed** one struct inside another, and its fields and methods are *promoted* to the outer type:

```go
type Timestamps struct {
	CreatedAt, UpdatedAt time.Time
}

func (t *Timestamps) Touch() { t.UpdatedAt = time.Now() }

type Order struct {
	Timestamps        // embedded: no field name
	ID    string
	Total int64
}

o := Order{ID: "o1"}
o.Touch()                 // promoted method
fmt.Println(o.UpdatedAt)  // promoted field
```

This is **"has-a"** composition: an `Order` *has* timestamps. It is not *a kind of* `Timestamps`.

## Interfaces: satisfied automatically ⭐

An **interface** is a list of method signatures, a description of *behavior*. In Go there's **no `implements` keyword**: if a type has all the methods, it satisfies the interface automatically. This is called **implicit** (or structural) satisfaction.

![Any type with a Notify method fits the Notifier interface, so OrderService can use email, SMS or a test fake without knowing which](/img/languages/go-interfaces.svg)

```go
type Notifier interface {
	Notify(to, msg string) error
}

type EmailNotifier struct{ From string }
func (e EmailNotifier) Notify(to, msg string) error {
	fmt.Printf("email from %s to %s: %s\n", e.From, to, msg)
	return nil
}

type SMSNotifier struct{ APIKey string }
func (s SMSNotifier) Notify(to, msg string) error {
	fmt.Printf("sms to %s: %s\n", to, msg)
	return nil
}

type OrderService struct {
	notifier Notifier           // depends on behavior, not on a concrete type
}

func (s *OrderService) Place(customer string) error {
	// …save the order…
	return s.notifier.Notify(customer, "Thanks for your order!")
}

svc := &OrderService{notifier: EmailNotifier{From: "shop@example.com"}}
svc.Place("ana@example.com")
```

Neither notifier mentions `Notifier`, but both fit. In tests you can pass a fake that just records messages.

**Idiomatic interface rules:**

- **Keep them small.** The famous `io.Reader` has one method: `Read(p []byte) (n int, err error)`. Anything that can be read from (files, network connections, HTTP bodies, strings) fits it.
- **Define the interface where it's used**, in the package that *needs* the behavior, not beside the implementation.
- **"Accept interfaces, return structs."** Functions take the smallest interface they need and return concrete types.

### `any`, type assertions and type switches

`any` (an alias for `interface{}`) is the interface with **no methods**, so every type satisfies it. Use it sparingly, because you lose type safety.

```go
var v any = 42

n, ok := v.(int)        // type assertion: "is it an int?" → 42, true
s, ok := v.(string)     // → "", false (no panic thanks to the comma-ok form)

switch x := v.(type) {  // type switch
case int:
	fmt.Println("int", x+1)
case string:
	fmt.Println("string", strings.ToUpper(x))
default:
	fmt.Println("something else")
}
```

> ⚠️ **The nil interface trap:** an interface value is `nil` only if it holds *no type and no value*. A `nil` pointer stored in an interface makes the interface **non-nil**. Return a literal `nil` for "no error", never a typed nil pointer.

## Errors are values

Go has **no exceptions** for normal failures. A function that can fail returns an `error` as its last value, and the caller checks it **immediately**.

`error` is just a tiny built-in interface:

```go
type error interface {
	Error() string
}
```

### Creating errors

```go
// 1. A simple message
err := errors.New("email is required")

// 2. A formatted message
err = fmt.Errorf("order %s: quantity must be positive", id)

// 3. A sentinel: a named error value callers can compare against
var ErrNotFound = errors.New("not found")

// 4. A custom error type that carries extra data
type ValidationError struct {
	Field string
	Issue string
}

func (e *ValidationError) Error() string {
	return e.Field + ": " + e.Issue
}
```

### Wrapping: adding context without losing the cause

Each layer adds context with `%w`, which **wraps** the original error inside the new one:

![Each layer wraps the error with its own context; errors.Is walks down the chain to find the original sentinel](/img/languages/go-error-wrapping.svg)

```go
// store layer
func (s *Store) FindUser(id string) (*User, error) {
	u, ok := s.users[id]
	if !ok {
		return nil, fmt.Errorf("find user: %w", ErrNotFound) // wrap the sentinel
	}
	return u, nil
}

// service layer
func (svc *Service) Checkout(userID string) error {
	u, err := svc.store.FindUser(userID)
	if err != nil {
		return fmt.Errorf("checkout for user %s: %w", userID, err) // wrap
	}
	_ = u
	return nil
}

// handler layer
err := svc.Checkout("42")
fmt.Println(err)                   // checkout for user 42: find user: not found
if errors.Is(err, ErrNotFound) {   // looks through every wrapped layer
	http.Error(w, "user not found", http.StatusNotFound)
	return
}

var ve *ValidationError
if errors.As(err, &ve) {           // finds a specific error TYPE in the chain
	fmt.Println("bad field:", ve.Field)
}
```

| Function | Question it answers |
| --- | --- |
| `errors.Is(err, ErrNotFound)` | "Is this error, or anything it wraps, **equal to** that value?" |
| `errors.As(err, &target)` | "Is this error, or anything it wraps, **of that type**? If so, give it to me" |
| `fmt.Errorf("…: %w", err)` | "Wrap this error with more context" (`%v` would *not* keep the chain) |

> 💡 Compare errors with `errors.Is`, **not** `==` or by checking the message text. `err == ErrNotFound` fails as soon as someone wraps the error.

### defer: cleanup that always runs

`defer` schedules a call to run **when the surrounding function returns**, whether it returns normally or early because of an error.

```go
func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()          // will run at the end, whatever happens below

	out, err := os.Create(dst)
	if err != nil {
		return err            // in.Close() still runs here
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}
```

- Several defers run in **reverse order** (last in, first out), like a stack of plates.
- Arguments are evaluated **when `defer` runs**, not when the deferred call executes.
- Classic pairs: `Open` → `defer Close`, `Lock` → `defer Unlock`, `Begin` → `defer Rollback`.

### panic and recover

A **panic** stops normal execution and unwinds the stack, running deferred calls on the way. If nothing recovers, the program crashes with a stack trace.

```go
func mustParsePort(s string) int {
	p, err := strconv.Atoi(s)
	if err != nil {
		panic("invalid port: " + s) // a programmer or config bug at startup
	}
	return p
}
```

**`recover`**, called inside a deferred function, stops a panic. Web frameworks use it so one bad request doesn't crash the whole server:

```go
func safeHandler(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic: %v", rec)
				http.Error(w, "internal error", http.StatusInternalServerError)
			}
		}()
		h(w, r)
	}
}
```

| Use an `error` for… | Use `panic` for… |
| --- | --- |
| Anything that can reasonably happen: not found, invalid input, timeout, network failure | Bugs that "can't happen": impossible states, broken invariants, bad config at startup |

## Generics

**Generics** (Go 1.18+) let you write one function or type that works with many types, while the compiler still checks everything. The types go in **square brackets** and are called **type parameters**.

```go
// T and U are type parameters; "any" is their constraint (no restriction)
func Map[T, U any](items []T, fn func(T) U) []U {
	out := make([]U, 0, len(items))
	for _, item := range items {
		out = append(out, fn(item))
	}
	return out
}

names := Map(users, func(u User) string { return u.Name }) // T=User, U=string inferred
```

A **constraint** limits which types are allowed:

```go
type Number interface {
	~int | ~int64 | ~float64 // ~ means "or any type whose underlying type is this"
}

func Sum[T Number](xs []T) T {
	var total T
	for _, x := range xs {
		total += x
	}
	return total
}

Sum([]int{1, 2, 3})        // 6
Sum([]float64{1.5, 2.5})   // 4
```

A generic **type**:

```go
type Stack[T any] struct {
	items []T
}

func (s *Stack[T]) Push(v T) { s.items = append(s.items, v) }

func (s *Stack[T]) Pop() (T, bool) {
	var zero T
	if len(s.items) == 0 {
		return zero, false
	}
	v := s.items[len(s.items)-1]
	s.items = s.items[:len(s.items)-1]
	return v, true
}
```

> 💡 Use generics for **containers and helpers** (the standard `slices` and `maps` packages are generic: `slices.Contains`, `slices.Sort`, `maps.Keys`). Use **interfaces** when you care about **behavior**.

## Testing

Tests live in files ending in `_test.go`, in functions named `TestXxx(t *testing.T)`. Go's favorite style is the **table-driven test**: a list of cases run through the same code.

```go
func TestDivide(t *testing.T) {
	tests := []struct {
		name    string
		a, b    float64
		want    float64
		wantErr bool
	}{
		{"normal", 10, 2, 5, false},
		{"negative", -9, 3, -3, false},
		{"by zero", 1, 0, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {  // each case is a named sub-test
			got, err := divide(tt.a, tt.b)
			if (err != nil) != tt.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tt.wantErr)
			}
			if got != tt.want {
				t.Errorf("got %v, want %v", got, tt.want)
			}
		})
	}
}
```

```bash
go test ./...                 # all packages
go test -run TestDivide -v    # one test, verbose
go test -cover ./...          # with coverage
go test -race ./...           # detect data races (see the next lesson)
```

| Call | Effect |
| --- | --- |
| `t.Errorf` | Report a failure, **keep going** |
| `t.Fatalf` | Report a failure, **stop this test** |
| `t.Run` | Run a named sub-test |
| `t.Helper()` | Mark a helper so failures point at the caller's line |

## Common beginner mistakes

| Mistake | What happens | Fix |
| --- | --- | --- |
| `append(s, x)` without assigning | The new item seems to vanish | `s = append(s, x)` |
| Writing to a `nil` map | Panic | `make(map[K]V)` first |
| Calling a method on a `nil` pointer | Panic: nil pointer dereference | Check for `nil`; return errors instead of nil values |
| Ignoring errors with `_` | Silent failures | Handle or return every error |
| Comparing errors with `==` | Breaks once errors are wrapped | `errors.Is` / `errors.As` |
| Modifying a sub-slice | The original slice changes too | `slices.Clone` when you need a copy |
| `len("héllo")` expecting 5 | Returns 6 (bytes) | `utf8.RuneCountInString` |
| Value receiver on a method that should modify | Changes are lost | Use a pointer receiver |

## Key takeaways

- A **module** (`go.mod`) contains **packages** (folders); **Capitalised** names are exported.
- Every variable has a **zero value**; `:=` declares, `=` assigns, and conversions are always explicit.
- A **slice** is a header (pointer, len, cap) onto an array: reassign `append`, and remember sub-slices share memory.
- **Maps** need `make` before writing; use comma-ok to detect missing keys.
- **Pointers** (`&x`, `*p`) let functions change the original; **pointer receivers** let methods do the same.
- **Interfaces** are satisfied implicitly; keep them small and define them where they're used.
- **Errors are values:** check them immediately, wrap with `%w`, inspect with `errors.Is`/`errors.As`; `defer` for cleanup, `panic` only for bugs.
- **Generics** for containers and helpers; interfaces for behavior; table-driven tests for everything.

## Try it yourself

Build a tiny in-memory **bank** package:

1. An `Account` struct with an unexported `balance` field and a `NewAccount(owner string)` constructor.
2. `Deposit` and `Withdraw` methods with pointer receivers, returning a sentinel `ErrInsufficientFunds`.
3. A `Bank` that stores accounts in a `map[string]*Account` and returns a wrapped `ErrNotFound` for unknown IDs.
4. A table-driven test that checks `errors.Is(err, ErrInsufficientFunds)` and `errors.Is(err, ErrNotFound)`.
