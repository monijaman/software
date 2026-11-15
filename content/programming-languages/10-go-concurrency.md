---
title: "Go Concurrency: Goroutines, Channels and Context"
summary: "Go concurrency explained term by term: concurrency vs parallelism, goroutines and the GMP scheduler, WaitGroup, unbuffered and buffered channels, closing and ranging, select and timeouts, data races and the race detector, Mutex, RWMutex, atomics and Once, worker pools, pipelines, fan-out/fan-in, semaphores, errgroup, and cancellation with context."
level: Intermediate
tags: [languages, go, golang, concurrency, goroutines, channels, context]
---

## The big idea

Imagine a restaurant kitchen. Orders arrive all the time: some dishes need ten minutes in the oven, some need chopping, some just need plating. A good kitchen doesn't make one dish at a time from start to finish. While the lasagne is in the oven, someone chops salad.

That's what **concurrency** is about: keeping work moving while some tasks are **waiting**: for the network, the database, a file, or a timer. A web server spends most of its time waiting, so doing other work during those waits is where the big performance gains are.

Go was designed for this. It gives you three simple tools:

- **Goroutines:** extremely cheap "helpers" that run functions concurrently.
- **Channels:** pipes that goroutines use to pass data and signals to each other safely.
- **Context:** a way to tell a whole group of goroutines "stop, we no longer need this".

> 💬 Go's guiding proverb: *"Don't communicate by sharing memory; share memory by communicating."* Instead of many goroutines grabbing the same variable, pass the data through a channel so only one goroutine owns it at a time.

## Words you'll meet in this lesson

| Term | Plain-English meaning |
| --- | --- |
| **Concurrency** | Structuring a program as tasks that can make progress independently |
| **Parallelism** | Actually running several tasks at the same instant on several CPU cores |
| **Goroutine** | A function running concurrently, managed by Go (not the OS) |
| **Scheduler** | The part of the Go runtime that decides which goroutine runs on which thread |
| **Blocking** | Waiting: a goroutine stops until something happens (data arrives, a lock frees) |
| **Channel** | A typed pipe for sending values between goroutines |
| **Buffered channel** | A channel with a small queue inside it |
| **Deadlock** | Every goroutine is waiting for another, so nothing can ever continue |
| **Data race** | Two goroutines touch the same variable at once, and at least one writes |
| **Mutex** | A lock: only one goroutine at a time may enter the protected section |
| **Worker pool** | A fixed number of goroutines that process jobs from a shared queue |
| **Context** | A value that carries a cancellation signal and deadline through a request |
| **Goroutine leak** | A goroutine that is stuck forever and never finishes, wasting memory |

## Concurrency vs parallelism

![Concurrency is one cook switching between dishes while each waits; parallelism is several cooks working at the same moment](/img/languages/concurrency-vs-parallelism.svg)

- **Concurrency** is about **structure**: *dealing with* many things at once. One cook can be concurrent by switching between dishes while each one waits in the oven.
- **Parallelism** is about **execution**: *doing* many things at once. That needs several cooks (CPU cores).

A concurrent Go program runs in parallel automatically when the machine has several cores. On one core it's still concurrent: goroutines take turns, and while one waits for the network, another runs.

| Workload | What helps |
| --- | --- |
| **I/O-bound**: calling APIs, querying databases, reading files | Concurrency: thousands of goroutines can wait at the same time |
| **CPU-bound**: image resizing, hashing, compression | Parallelism: about one goroutine per CPU core keeps them all busy |

## Goroutines

A **goroutine** is a function that runs **concurrently** with the code that started it. You start one by putting `go` in front of a function call:

```go
func sendEmail(to string) {
	time.Sleep(500 * time.Millisecond)   // pretend this talks to a mail server
	fmt.Println("email sent to", to)
}

func main() {
	go sendEmail("ana@example.com")      // starts and returns IMMEDIATELY
	fmt.Println("main keeps going")
	time.Sleep(time.Second)              // ❌ demo only: wait so we see the output
}
```

```text
main keeps going
email sent to ana@example.com
```

Two important facts:

1. `go f()` **does not wait**. The line after it runs straight away.
2. When `main` returns, **the program exits and every goroutine is killed**, finished or not. That's why the demo sleeps. Real code uses a `WaitGroup` or channels instead (below).

### Why goroutines are so cheap

| | Goroutine | OS thread |
| --- | --- | --- |
| Starting memory | About **2 KB**, grows and shrinks as needed | 1–8 MB, fixed |
| Created and scheduled by | The Go runtime | The operating system kernel |
| Cost to switch between them | Very small (no trip into the kernel) | Larger |
| Realistic number in one program | **Hundreds of thousands** | A few thousand |

Starting a goroutine per incoming HTTP request (which Go's `net/http` server does for you) is completely normal.

### The scheduler: G, M and P

You don't need to manage threads, but knowing the model explains Go's behavior.

![Many goroutines (G) run on a few OS threads (M) through processors (P, one per core)](/img/languages/go-scheduler.svg)

| Letter | Stands for | What it is |
| --- | --- | --- |
| **G** | Goroutine | Your function plus its small stack |
| **M** | Machine | A real operating-system thread |
| **P** | Processor | A "permit to run Go code", with its own **run queue** of waiting goroutines. There is one P per CPU core (`GOMAXPROCS`) |

How it works, in short:

1. Each **P** holds a queue of ready goroutines and runs them on its **M** (thread), one at a time.
2. When a goroutine **blocks** (waiting on a channel, a lock, a timer or network I/O), the scheduler parks it and runs the next one. The thread is not wasted.
3. When a goroutine makes a slow **system call** (such as a file read), the P can move to another thread so other goroutines keep running.
4. An idle P **steals** work from a busy P's queue (*work stealing*), keeping every core busy.
5. Long-running goroutines are **preempted** (paused) about every 10 ms, so one busy loop can't hog a core.

`runtime.NumCPU()` tells you the number of cores, and `runtime.NumGoroutine()` how many goroutines exist, which is handy for spotting leaks.

## Waiting for goroutines: `sync.WaitGroup`

A **WaitGroup** is a counter of unfinished work, like a teacher counting students back onto the bus:

| Method | Meaning |
| --- | --- |
| `wg.Add(n)` | "n more tasks are starting" |
| `wg.Done()` | "one task finished" (subtracts 1) |
| `wg.Wait()` | "block until the counter is back to zero" |

```go
func main() {
	urls := []string{"https://a.example", "https://b.example", "https://c.example"}

	var wg sync.WaitGroup
	for _, url := range urls {
		wg.Add(1)                    // ✅ Add BEFORE starting the goroutine
		go func() {
			defer wg.Done()          // ✅ Done runs even if fetch panics or returns early
			status := fetch(url)     // Go 1.22+: each iteration gets its own `url`
			fmt.Println(url, status)
		}()
	}
	wg.Wait()                        // all three fetches run at the same time
	fmt.Println("all done")
}
```

If each fetch takes 1 second, the whole program takes about **1 second**, not 3.

> ⚠️ **Old Go versions (before 1.22)** shared one loop variable across all iterations, so every goroutine could print the *last* URL. If you maintain older code, pass the value in: `go func(u string) { … }(url)`.

> 💡 Go 1.25 adds `wg.Go(func() { … })`, which does the `Add(1)` and `defer Done()` for you.

## Channels ⭐

A **channel** is a typed pipe. One goroutine **sends** a value in, another **receives** it out. Channels both **move data** and **synchronize**: a goroutine waiting on a channel simply pauses until it can continue.

```go
ch := make(chan string)   // a channel that carries strings

go func() {
	ch <- "hello"         // SEND: arrow points INTO the channel
}()

msg := <-ch               // RECEIVE: arrow points OUT of the channel
fmt.Println(msg)          // hello
```

### Unbuffered vs buffered

![An unbuffered channel is a hand-to-hand handoff where both sides wait for each other; a buffered channel is a small shelf the sender can fill until it is full](/img/languages/go-channels.svg)

**Unbuffered** (`make(chan T)`): like **handing a parcel to someone in person**. The sender waits until a receiver takes it, and the receiver waits until a sender arrives. Both continue only when the handoff happens, which makes it a perfect **synchronization point**.

**Buffered** (`make(chan T, 3)`): like a **shelf with 3 slots**. The sender can drop items and leave, until the shelf is full. The receiver takes items while there are any.

```go
jobs := make(chan int, 3)
jobs <- 1           // doesn't block
jobs <- 2           // doesn't block
jobs <- 3           // doesn't block: buffer is now full
// jobs <- 4        // would BLOCK until someone receives
fmt.Println(len(jobs), cap(jobs)) // 3 3
```

| | Unbuffered | Buffered (capacity n) |
| --- | --- | --- |
| A send waits until… | a receiver takes the value | there is a free slot |
| A receive waits until… | a sender sends | there is at least one value |
| Main use | Guaranteed handoff, signaling "this happened" | Absorbing short bursts, limiting concurrency |

> 💡 A buffer is not a fix for a slow consumer. If the receiver is permanently slower, the buffer just fills up and the sender blocks anyway. Choose small buffers for a clear reason.

### Channel direction

Function signatures can say whether a function may only send or only receive. The compiler enforces it:

| Type | Meaning |
| --- | --- |
| `chan T` | Send and receive |
| `chan<- T` | **Send-only** (arrow points into `chan`) |
| `<-chan T` | **Receive-only** (arrow points out of `chan`) |

### Closing and ranging

`close(ch)` means **"no more values will ever be sent"**. Receivers can still drain whatever is left.

```go
func produce(out chan<- int) {
	defer close(out)          // ✅ only the SENDER closes, when it's finished
	for i := range 5 {
		out <- i
	}
}

func main() {
	ch := make(chan int)
	go produce(ch)

	for n := range ch {       // receives until the channel is closed AND empty
		fmt.Print(n, " ")     // 0 1 2 3 4
	}

	v, ok := <-ch             // after close: zero value and ok == false
	fmt.Println(v, ok)        // 0 false
}
```

Rules worth memorizing:

- **Only the sender closes**, and only once. The receiver can't know whether more values are coming.
- You don't *have* to close a channel. Close it only to tell receivers "we're done", for example to end a `for range`.
- The **comma-ok** form `v, ok := <-ch` tells you whether you got a real value (`ok == true`) or the channel is closed.

| Operation | On a `nil` channel | On an open channel | On a closed channel |
| --- | --- | --- | --- |
| Send `ch <- v` | Blocks forever | Waits or succeeds | **Panic** |
| Receive `<-ch` | Blocks forever | Waits or succeeds | Zero value immediately, `ok == false` |
| `close(ch)` | **Panic** | Succeeds | **Panic** |

### Deadlock

A **deadlock** is when every goroutine is waiting for something that can never happen. Go detects the simplest case and crashes with a clear message:

```go
func main() {
	ch := make(chan int)
	ch <- 1               // waits for a receiver… there is none
	fmt.Println(<-ch)
}
```

```text
fatal error: all goroutines are asleep - deadlock!
```

Fix: receive in another goroutine, or use a buffered channel. More subtle deadlocks (two goroutines each holding a lock the other wants) are **not** always detected, and the program just hangs.

### `select`: waiting on several channels at once

`select` is like a `switch` for channel operations. It waits until **one** of its cases can proceed, then runs that case.

```go
select {
case msg := <-messages:
	fmt.Println("got message:", msg)
case err := <-errs:
	return err
case <-time.After(2 * time.Second):     // a channel that receives after 2 s
	return errors.New("timed out")
case <-ctx.Done():                      // the caller cancelled
	return ctx.Err()
}
```

- If **several** cases are ready, `select` picks one **at random**, so no channel is starved.
- A **`default`** case runs immediately if nothing else is ready. That turns `select` into a **non-blocking** check:

```go
select {
case job := <-jobs:
	handle(job)
default:
	fmt.Println("no job right now, doing something else")
}
```

**Tickers** deliver a value at a regular interval, which is handy for periodic work:

```go
ticker := time.NewTicker(30 * time.Second)
defer ticker.Stop()

for {
	select {
	case <-ticker.C:
		refreshCache()
	case <-ctx.Done():
		return               // stop when the app shuts down
	}
}
```

## Data races and shared memory

### What is a data race?

A **data race** happens when two goroutines access the same variable at the same time and **at least one of them writes**. The result depends on timing, so it's random and hard to reproduce.

![Two goroutines both read 5, both add 1, both write 6: one increment is lost](/img/languages/go-race-condition.svg)

`count++` looks like one step, but it's really three: **read** the value, **add** 1, **write** it back. If two goroutines interleave those steps, an update is lost:

```go
count := 0
var wg sync.WaitGroup
for range 1000 {
	wg.Add(1)
	go func() {
		defer wg.Done()
		count++                 // ❌ data race
	}()
}
wg.Wait()
fmt.Println(count)              // often 950-something, different every run
```

### The race detector

Go has a built-in tool that catches races while your program or tests run:

```bash
go run -race main.go
go test -race ./...     # put this in CI
```

```text
WARNING: DATA RACE
Write at 0x00c000014090 by goroutine 8:
  main.main.func1()  main.go:12 +0x44
Previous write at 0x00c000014090 by goroutine 7:
  main.main.func1()  main.go:12 +0x44
```

It only finds races in code that actually runs, so it works best with good tests.

### `sync.Mutex`: one at a time

A **mutex** (*mutual exclusion*) is like the **key to a single bathroom**: whoever holds it goes in, everyone else waits in line.

```go
type SafeCounter struct {
	mu sync.Mutex
	m  map[string]int
}

func (c *SafeCounter) Inc(key string) {
	c.mu.Lock()           // wait for the key
	defer c.mu.Unlock()   // ✅ always give it back, even on early return or panic
	c.m[key]++
}

func (c *SafeCounter) Get(key string) int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.m[key]
}
```

- The code between `Lock` and `Unlock` is the **critical section**. Keep it short, and never do slow I/O while holding a lock.
- A struct containing a mutex must **not be copied**: use pointer receivers. `go vet` warns you.
- Go's built-in `map` is **not safe** for concurrent writes. The runtime may crash with `fatal error: concurrent map writes`, so protect maps with a mutex.

### `sync.RWMutex`: many readers or one writer

When reads are far more common than writes (such as a config or cache), an **RWMutex** lets **many readers in together**, but a writer gets exclusive access:

```go
type Cache struct {
	mu   sync.RWMutex
	data map[string]string
}

func (c *Cache) Get(k string) (string, bool) {
	c.mu.RLock()            // shared lock: other readers may enter too
	defer c.mu.RUnlock()
	v, ok := c.data[k]
	return v, ok
}

func (c *Cache) Set(k, v string) {
	c.mu.Lock()             // exclusive lock: waits for all readers to leave
	defer c.mu.Unlock()
	c.data[k] = v
}
```

### `sync/atomic`: lock-free counters and flags

For a **single number or flag**, atomic operations are simpler and faster than a mutex. They do read-modify-write as one indivisible step:

```go
var requests atomic.Int64

// in many goroutines:
requests.Add(1)

// anywhere:
fmt.Println(requests.Load())

var ready atomic.Bool
ready.Store(true)
```

### `sync.Once`: do something exactly once

```go
var (
	once   sync.Once
	config *Config
)

func GetConfig() *Config {
	once.Do(func() {           // runs only the first time, even if 100 goroutines call it
		config = loadConfigFromDisk()
	})
	return config
}
```

### Which tool when?

| You want to… | Use |
| --- | --- |
| Pass data from one goroutine to another, or hand over ownership | **Channel** |
| Signal "done" or "stop" to many goroutines | **Close a channel**, or `ctx.Done()` |
| Protect a shared struct or map | **`sync.Mutex`** |
| Mostly-read shared data | **`sync.RWMutex`** |
| A single counter or flag | **`sync/atomic`** |
| Lazy one-time initialization | **`sync.Once`** |
| Wait for a group of goroutines | **`sync.WaitGroup`** or **errgroup** |

> 💡 **Channels or mutex?** Both are idiomatic. Use channels to *coordinate* (pipelines, handing off work, signals). Use a mutex to *guard state* (a cache, a counter, a map). If a channel version feels contorted, a mutex is probably clearer.

## Concurrency patterns

### Worker pool: a fixed team working through a queue

Starting one goroutine per job is fine for 100 jobs, but not for 1,000,000 database writes: you'd overwhelm the database. A **worker pool** starts a **fixed number** of goroutines that pull jobs from a shared channel, like a **call center with 5 agents** answering a queue of callers.

![Jobs enter one channel; three workers take jobs as they become free and send results to a results channel that a collector reads](/img/languages/go-worker-pool.svg)

```go
type Job struct{ ID int }
type Result struct {
	JobID int
	Value string
}

func worker(id int, jobs <-chan Job, results chan<- Result) {
	for job := range jobs {                      // takes jobs until the channel is closed
		time.Sleep(100 * time.Millisecond)       // pretend to work
		results <- Result{JobID: job.ID, Value: fmt.Sprintf("done by worker %d", id)}
	}
}

func main() {
	jobs := make(chan Job)
	results := make(chan Result)

	// 1. Start a fixed number of workers
	var wg sync.WaitGroup
	for w := 1; w <= 3; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			worker(w, jobs, results)
		}()
	}

	// 2. Send the jobs, then close the channel so workers know to stop
	go func() {
		defer close(jobs)
		for i := 1; i <= 9; i++ {
			jobs <- Job{ID: i}
		}
	}()

	// 3. Close results once every worker has finished
	go func() {
		wg.Wait()
		close(results)
	}()

	// 4. Collect
	for r := range results {
		fmt.Println(r.JobID, r.Value)
	}
}
```

Nine jobs of 100 ms each, done by 3 workers, take about **300 ms**. The **three closes** are what make it shut down cleanly: closing `jobs` ends the workers' loops, and closing `results` (after `wg.Wait()`) ends the collector's loop.

### Pipeline: an assembly line of stages

A **pipeline** is a chain of stages connected by channels. Each stage is a goroutine that receives values, does one job, and sends results on. Like a car factory: frame → engine → paint → inspection.

```go
// Stage 1: produce numbers
func generate(nums ...int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for _, n := range nums {
			out <- n
		}
	}()
	return out
}

// Stage 2: square them
func square(in <-chan int) <-chan int {
	out := make(chan int)
	go func() {
		defer close(out)
		for n := range in {
			out <- n * n
		}
	}()
	return out
}

func main() {
	for v := range square(generate(1, 2, 3, 4)) {
		fmt.Print(v, " ") // 1 4 9 16
	}
}
```

Each stage **owns and closes its own output channel**, so the closing ripples down the line and every loop ends naturally.

### Fan-out and fan-in

- **Fan-out:** several goroutines read from the **same** channel to share slow work (like opening more checkout lanes).
- **Fan-in:** merge several channels **into one** (like several lanes merging onto a motorway).

```go
func merge(inputs ...<-chan int) <-chan int {
	out := make(chan int)
	var wg sync.WaitGroup
	for _, in := range inputs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for v := range in {
				out <- v
			}
		}()
	}
	go func() { wg.Wait(); close(out) }()
	return out
}

src := generate(1, 2, 3, 4, 5, 6)
// fan-out: three square stages share the same input
results := merge(square(src), square(src), square(src)) // fan-in
for v := range results {
	fmt.Println(v) // 1, 4, 9, 16, 25, 36 in any order
}
```

> ⚠️ Fan-out loses ordering: results come back in whatever order the workers finish. If order matters, attach an index to each item and sort at the end.

### Semaphore: "at most N at a time"

A buffered channel makes a simple **semaphore**, like a car park with 10 spaces:

```go
sem := make(chan struct{}, 10)   // 10 permits; struct{} uses zero bytes

var wg sync.WaitGroup
for _, f := range files {
	wg.Add(1)
	sem <- struct{}{}             // take a permit (waits if all 10 are in use)
	go func() {
		defer wg.Done()
		defer func() { <-sem }()  // give the permit back
		upload(f)
	}()
}
wg.Wait()
```

### errgroup: WaitGroup plus errors plus cancellation

The `golang.org/x/sync/errgroup` package is the go-to tool for "run these tasks concurrently, return the first error, and cancel the rest":

```go
import "golang.org/x/sync/errgroup"

func fetchAll(ctx context.Context, urls []string) error {
	g, ctx := errgroup.WithContext(ctx)   // ctx is cancelled when any task fails
	g.SetLimit(5)                         // at most 5 at a time (built-in semaphore)

	for _, url := range urls {
		g.Go(func() error {
			return fetch(ctx, url)        // return an error to stop the group
		})
	}
	return g.Wait()                       // waits for all; returns the FIRST error
}
```

## Cancellation with `context` ⭐

### The problem

A user opens a dashboard. Your handler starts three goroutines: one queries the database, one calls a payments API, one loads recommendations. The user **closes the tab** after one second. Without cancellation, all three keep working for nothing, holding database connections and making API calls.

### What a context is

A **`context.Context`** is a value you pass through every function in a request. It carries:

- a **cancellation signal**: "stop, nobody needs this any more",
- an optional **deadline**: "stop at 10:00:02 at the latest",
- a few **request-scoped values**, such as a request ID for logging.

Contexts form a **tree**. Cancelling a parent automatically cancels **all of its children**, like switching off a room's main breaker and every light in it going out.

![The request context is the root; timeouts and cancels create children, and cancelling a parent stops every goroutine and query below it](/img/languages/go-context-tree.svg)

### Creating contexts

| Function | Creates a context that is cancelled when… |
| --- | --- |
| `context.Background()` | Never: the empty root, used in `main` and tests |
| `context.WithCancel(parent)` | You call the returned `cancel()`, or the parent is cancelled |
| `context.WithTimeout(parent, 2*time.Second)` | 2 seconds pass, `cancel()` is called, or the parent is cancelled |
| `context.WithDeadline(parent, t)` | Time `t` is reached (same idea, an absolute time) |
| `context.WithValue(parent, key, val)` | Never by itself: just attaches a value |

In an HTTP handler, `r.Context()` is already cancelled automatically when the client disconnects.

### Using a context

```go
func (s *Service) GetDashboard(ctx context.Context, userID string) (*Dashboard, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel() // ✅ ALWAYS call cancel, or the timer's resources leak

	// Most libraries accept a ctx and stop by themselves when it's cancelled:
	rows, err := s.db.QueryContext(ctx, "SELECT … WHERE user_id = $1", userID)
	if err != nil {
		return nil, err // context.DeadlineExceeded after 2 s
	}
	defer rows.Close()

	req, _ := http.NewRequestWithContext(ctx, "GET", s.paymentsURL+"/"+userID, nil)
	resp, err := s.http.Do(req) // aborted if ctx is cancelled
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	// …
	return &Dashboard{}, nil
}
```

Inside **your own** goroutines, check `ctx.Done()` in a `select`:

```go
func watch(ctx context.Context, events <-chan Event) error {
	for {
		select {
		case e := <-events:
			handle(e)
		case <-ctx.Done():          // closed when the context is cancelled
			return ctx.Err()        // context.Canceled or context.DeadlineExceeded
		}
	}
}
```

| Method | Meaning |
| --- | --- |
| `ctx.Done()` | A channel that is **closed** on cancellation (closed channels are always ready, so `select` fires) |
| `ctx.Err()` | `nil` while active; `context.Canceled` or `context.DeadlineExceeded` afterwards |
| `ctx.Deadline()` | When it will expire, if it has a deadline |
| `ctx.Value(key)` | A request-scoped value |

### Running calls in parallel with a shared deadline

```go
func (s *Service) Dashboard(ctx context.Context, userID string) (*Dashboard, error) {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	g, ctx := errgroup.WithContext(ctx)
	var orders []Order
	var profile *Profile

	g.Go(func() (err error) { orders, err = s.orders.List(ctx, userID); return })
	g.Go(func() (err error) { profile, err = s.users.Get(ctx, userID); return })

	if err := g.Wait(); err != nil { // if one fails, ctx cancels the other
		return nil, err
	}
	return &Dashboard{Orders: orders, Profile: profile}, nil
}
```

Both calls run **at the same time**, so the total time is the slower of the two, not the sum.

### Context rules

- Pass it as the **first parameter**, named `ctx`: `func Do(ctx context.Context, …)`.
- **Never store** a context in a struct; pass it along each call.
- **Always `defer cancel()`** right after `WithCancel`, `WithTimeout` or `WithDeadline`.
- Use `WithValue` only for **request-scoped metadata** (request ID, trace ID, authenticated user), never for optional function parameters.
- Never pass a `nil` context. Use `context.TODO()` if you're not sure yet.

## Goroutine leaks

A **goroutine leak** is a goroutine that is stuck forever: usually blocked on a channel nobody will ever use again. Each one holds memory, and in a server that leaks one per request, memory grows until the process crashes.

```go
// ❌ Leaks when the timeout wins: nobody ever receives from ch
func fetchWithTimeout(url string) (string, error) {
	ch := make(chan string)
	go func() {
		ch <- slowFetch(url)        // blocks forever if no one is listening
	}()
	select {
	case body := <-ch:
		return body, nil
	case <-time.After(time.Second):
		return "", errors.New("timeout") // the goroutine above is now stuck
	}
}
```

```go
// ✅ Fix 1: a buffer of 1, so the send always succeeds even if nobody receives
ch := make(chan string, 1)

// ✅ Fix 2 (better): pass a context so the work itself stops
func fetchWithTimeout(ctx context.Context, url string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, time.Second)
	defer cancel()
	return fetch(ctx, url) // fetch stops when ctx is cancelled
}
```

**Rule:** every goroutine you start must have a **clear way to finish**: its input channel gets closed, its context is cancelled, or its send can't block.

## Common pitfalls

| Bug | Example | Fix |
| --- | --- | --- |
| **Program exits early** | `main` returns before goroutines finish | `WaitGroup`, errgroup or channels |
| **Goroutine leak** | Blocked forever sending to a channel nobody reads | `select` on `ctx.Done()`, buffered result channel |
| **Deadlock** | Unbuffered send with no receiver; locks taken in different orders | Receiver in another goroutine; consistent lock order |
| **Data race** | Two goroutines do `count++` or write a map | Mutex, atomic or channel; `go test -race` |
| **`wg.Add` inside the goroutine** | `Wait` may return before `Add` runs | Call `Add` before `go` |
| **Send on a closed channel** | Panic | Only the sender closes, exactly once |
| **Copying a mutex** | Passing a struct with a `Mutex` by value | Pointer receivers; `go vet` catches it |
| **Forgetting `cancel()`** | Timers and goroutines linger | `defer cancel()` immediately |
| **Unbounded goroutines** | One per row for a million rows | Worker pool, semaphore, or `errgroup.SetLimit` |
| **`time.Sleep` to wait** | Flaky, slow tests | Proper synchronization |

## Key takeaways

- **Concurrency** is structure (handling many waiting tasks); **parallelism** is execution on many cores. Go does both.
- **Goroutines** cost about 2 KB; the **GMP scheduler** runs them on a few OS threads and switches whenever one blocks.
- **WaitGroup** waits for a group; **unbuffered channels** are handoffs, **buffered channels** are small queues; **only the sender closes**.
- **`select`** waits on several channels, with timeouts, cancellation and non-blocking `default`.
- A **data race** is concurrent access with a write: fix it with a **mutex**, **atomic** or **channel**, and run **`-race`** in CI.
- **Worker pools**, **pipelines**, **fan-out/fan-in**, **semaphores** and **errgroup** keep concurrency bounded and tidy.
- Pass **`context.Context`** everywhere, `defer cancel()`, and give **every goroutine an exit path** to avoid leaks.

## Try it yourself

Write a **concurrent link checker**:

1. Read a list of 50 URLs.
2. Check them with a **worker pool of 5** goroutines, each doing an HTTP `HEAD` request with `http.NewRequestWithContext`.
3. Give the whole run a **10-second timeout** with `context.WithTimeout`.
4. Count successes with an `atomic.Int64` and collect failures through a results channel.
5. Run it with `go run -race .` and confirm there are no data races.
