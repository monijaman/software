---
title: "500 Users Upload Documents at Once: Design the Background Job Pipeline"
summary: "Take slow document processing out of the upload request: save the file, write down a job, put it in a queue, and let workers do the heavy work safely, with retries, no duplicates, and a clear 'we're full' when overloaded."
level: Advanced
tags: [system-design, background-jobs, queues, celery, fastapi, redis, postgresql, backpressure, idempotency, rag]
---

## The story in one minute

You run an **AI app** where users upload PDFs. For every file, the server must:

- pull the text out of the PDF,
- clean it up,
- cut it into small pieces (called *chunks*),
- turn each chunk into a list of numbers that captures its meaning (an *embedding*, made by an outside AI service),
- save those numbers in a special database for searching (a *vector database*),
- update the status.

A small PDF takes a few seconds. A big one takes minutes. The first version does **all of this inside the upload request**.

Here is what goes wrong at 9:00 a.m., when **500 users upload at once**:

1. Every upload request stays open for seconds or minutes.
2. All the API's workers are busy with PDFs. Even a simple health check stops answering.
3. Browsers and proxies give up after 30 to 60 seconds. Users see errors, even though work may still be running.
4. A server crashes halfway through a file. Nothing records what was done, so the work is lost.

This lesson is about separating **accepting** the work (fast) from **doing** the work (slow).

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Background job** | Work done later by a separate program, not while the user waits. | Dropping clothes at a dry cleaner. You get a ticket and leave. |
| **Object storage** | A place to keep big files (like S3). | A warehouse for boxes. |
| **Job table** | A database table with one row per job: its status, tries and errors. | The dry cleaner's logbook. |
| **Queue / broker** | A waiting line that hands work to workers (Redis or RabbitMQ). | The pile of tickets on the counter. |
| **Worker** | A program that takes jobs from the queue and does them. | The person in the back doing the cleaning. |
| **Acknowledge (ack)** | A worker telling the queue "done, you can delete this message". | Throwing the ticket away once the shirt is clean. |
| **Idempotent** | Doing it twice has the same result as doing it once. | Pressing a lift button twice. It still comes once. |
| **Backpressure** | Saying "we're full, come back later" instead of taking on too much. | "No more orders today, back tomorrow." |
| **Dead-letter** | A parking place for jobs that keep failing, for a human to check. | The "problem orders" shelf. |

## The fix in six steps

### Step 1: Accept fast

Check the file (size, type, user's limit), save it to **object storage**, and reply right away with **`202 Accepted`** (HTTP for "got it, I'll do it later") plus a `job_id`. No heavy work here.

### Step 2: Write it down

Insert a row in the **job table** with status `queued`, before anything else can go wrong.

### Step 3: Put a small ticket in the queue

The queue message holds **only the `job_id`**. The file lives in storage, and the status lives in the database. The message is just a pointer.

❌ **Wrong:** put the whole PDF or its text in the message.

✅ **Right:** put the `job_id` in the message. Workers look up everything else.

### Step 4: Process

A worker **claims** the job, runs the pipeline, saves the vectors, and marks the job `succeeded`.

### Step 5: Show progress

The frontend asks `GET /jobs/{id}` every few seconds (this is called *polling*), or listens on a live channel. It shows `queued → processing → succeeded / failed`.

### Step 6: Fail safely

- **Temporary errors** (network blip, "too many requests"): retry, waiting longer each time, with a random extra wait.
- **Permanent errors** (broken PDF): stop right away.
- **Keeps failing**: move to a dead-letter state for a human to look at.

## Walk through a failure

At 9:00, **500 jobs** arrive. Each needs about **60 seconds** of worker time.

```text
500 jobs × 60 s = 30,000 seconds of work
30,000 ÷ 50 workers = 600 seconds = about 10 minutes
```

Users see `queued` for a while, but **the API stays fast** the whole time.

Halfway through, one worker uses too much memory and the operating system kills it (the *out-of-memory killer*) while it's holding a job. What happens?

1. The worker only **acknowledges a message after the work is done**. It died first, so the queue never got the "done".
2. The queue gives the message to **another worker**.
3. That worker gives each chunk a **fixed ID** (based on job ID + chunk number) and **upserts** it (insert, or overwrite if it already exists). So redoing the job **overwrites** the half-written data instead of making duplicates.

Then the embedding service starts replying **`429 Too Many Requests`**. Retries wait longer each time, with random extra waits, and a shared **rate limit** (a cap on calls per second) stops the workers from hammering it harder.

## How to prove it works

Load-test with **500 uploads at once**, and **kill a worker mid-job** on purpose. Then check:

1. The API's slowest responses (*p99*, slower than 99% of requests) **stay low**, and don't depend on document size.
2. **Every job finishes** as `succeeded` or `failed`. None stay stuck.
3. **No document has duplicate vectors.**
4. The age of the oldest queued job **drops back to near zero** after the burst.
5. When the queue is full, new uploads get a **clear "try later"** instead of hanging until they time out.

### Check your understanding

2,000 documents arrive. Each needs 45 seconds of worker time. You run 30 workers. About how long until the last one finishes? What would you show the user? And if you promise "processed within 15 minutes", at what queue size would you start refusing uploads?

<details>
<summary>Show answer</summary>

**Time to finish:** 2,000 × 45 ÷ 30 = **3,000 seconds, about 50 minutes**.

**What to show:** an honest status, like "Queued, about N minutes to go", updated as the job moves to `processing` (with progress such as "120 of 340 chunks") and then `succeeded` or `failed`.

**When to refuse:** 30 workers ÷ 45 s = about **0.67 documents per second**. In 15 minutes (900 s) that's 0.67 × 900 = **about 600 documents**. So once more than ~600 jobs are waiting, a new upload can't meet the 15-minute promise. Past that, reply `429` or `503` with a `Retry-After` header, or clearly tell the user it will be slower. (Use the slow-end job time, p95, rather than the average, to be safer.)

</details>

---

## Going deeper

## Why doing it all in the request fails

```text
Client → API: POST /documents   (request stays open...)
          extract → clean → chunk → embed → store → respond
```

Three things go wrong at once:

| Problem | What happens |
| --- | --- |
| **No limit on request time** | Proxies and browsers give up after 30 to 60 seconds. The user sees an error, but the work may still be running. |
| **Capacity is tied to web workers** | 500 slow uploads use every API worker, so even `GET /health` stops answering. |
| **A crash loses the work** | A crash at step 5 leaves no record of what finished and no way to continue. |

The main idea: **separate accepting work from doing work.** Accepting is fast and must always work. Doing is slow, and can be scaled, paced and retried on its own.

## The architecture

```text
Client
  ↓  POST /documents
FastAPI  ──► Object storage   (the file)
  │      ──► Job database     (id, status, attempts, error)
  ↓
Task queue  (Redis or RabbitMQ)
  ↓
Background workers
  ↓             ↓
Vector database   Job database (status updates)
  ↑
Status API  ◄── Client polls GET /jobs/{id}
```

| Part | What it holds | Why it's separate |
| --- | --- | --- |
| **Object storage** | The raw file | Big files don't belong in a queue message or a database row. |
| **Job database** | The truth about status, tries and errors | The queue can lose or duplicate messages. The database is what you trust and show. |
| **Task queue** | Handing work to workers | Soaks up bursts, so the API and workers don't need to run at the same speed. |
| **Workers** | The slow pipeline | Can be scaled and restarted without touching the API. |
| **Vector database** | The finished embeddings | Written as each document is processed. |

A common mistake is to treat the queue as the record of what happened. Keep the **database as the truth** and the queue as just the delivery truck. If the queue is wiped, a **sweeper** (a small program that runs every few minutes) can re-queue every job still marked `queued`.

## Steps 1 and 2: accept, store and record

```python
@app.post("/documents", status_code=202)
async def upload(file: UploadFile, user: User = Depends(current_user)):
    validate(file)                                   # size, type, per-user quota
    key = f"uploads/{user.id}/{uuid4()}.pdf"
    await storage.put(key, file)                     # 1. store the bytes

    job = await db.insert_job(                       # 2. record the intent
        user_id=user.id, object_key=key, status="queued"
    )
    process_document.delay(str(job.id))              # 3. enqueue only the id
    return {"job_id": job.id, "status_url": f"/jobs/{job.id}"}
```

**The order matters.** Look at what happens if the server dies at each point:

| Dies after... | Leftover mess | Can we recover? |
| --- | --- | --- |
| Saving the file, before the job row | A file with no job | ✅ Yes. A storage cleanup rule deletes old orphan files. |
| The job row, before queueing | A `queued` job nobody is working on | ✅ Yes. The sweeper finds old `queued` jobs and queues them. |
| Queueing **first**, row later (wrong order) | A worker gets a job the database has never heard of | ❌ No clean way to handle it. |

For **very large files**, let the browser upload straight to object storage using a **presigned URL** (a temporary, signed link that allows one upload). A storage event then creates the job. The API never touches the file bytes at all.

## Steps 3 and 4: the job's life

Each job moves through a few fixed states (a *state machine*):

```text
queued → processing → succeeded
              │
              ├──► queued   (retry after a temporary failure, attempts + 1)
              └──► failed   (out of retries, or a permanent error)
```

### Claiming a job

A worker must **claim** a job before working on it. Do it in **one conditional update**, so two workers can never both own the same job.

The claim also sets a **lease**: "I own this job until this time." If the worker dies, the lease runs out, and someone else may take the job.

```sql
UPDATE jobs
SET status      = 'processing',
    started_at  = now(),
    attempts    = attempts + 1,
    lease_until = now() + interval '6 minutes'   -- longer than the task's time limit
WHERE id = $1
  AND (status = 'queued'
       OR (status = 'processing' AND lease_until < now()))   -- owner died, lease expired
RETURNING id, object_key;
```

If it returns **no row**, another worker has the job, or it's already finished. This worker simply drops the message. It's the same "check and change in one step" trick used for safe payments and single-use OTPs (see the next lesson).

> Why the lease matters: after a crash, the redelivered job is still marked `processing`. Without the lease check, the new worker would see "not queued" and drop it, and the job would be stuck forever. If the redelivered message arrives *before* the lease runs out, the claim returns nothing, and the sweeper picks the job up once the lease expires.

### The worker

```python
import random

@celery.task(
    bind=True,
    acks_late=True,                      # acknowledge AFTER the work is done
    reject_on_worker_lost=True,          # if the worker process is killed, put the message back
    max_retries=5,
    soft_time_limit=300,                 # ask the task to stop after 5 minutes
    time_limit=330,                      # force-kill it after 5.5 minutes
)
def process_document(self, job_id: str):
    job = claim_job(job_id)
    if job is None:
        return                                   # someone else owns it, or it's done

    try:
        text   = extract_text(storage.get(job.object_key))
        chunks = split(clean(text))
        done = 0
        for batch in batched(chunks, 64):
            vectors = embed(batch)               # rate-limited, may raise TransientError
            vector_db.upsert([
                (chunk_id(job.id, c.index), v, c.metadata)   # same ID every time
                for c, v in zip(batch, vectors)
            ])
            done += len(batch)
            update_progress(job.id, done=done, total=len(chunks))
        mark_succeeded(job.id)

    except PermanentError as e:                  # corrupt PDF, password-protected...
        mark_failed(job.id, str(e))              # don't retry what can never work

    except TransientError as e:                  # network blip, 429, 503...
        if self.request.retries >= self.max_retries:
            mark_failed(job.id, f"gave up after retries: {e}")
            raise
        release_job(job.id)                      # processing → queued, so the retry can claim it
        wait = random.uniform(0, min(600, 2 ** self.request.retries))   # backoff + jitter
        raise self.retry(exc=e, countdown=wait)
```

The few details that make the whole design work:

- **`acks_late`**: by default, Celery acknowledges a message **as soon as** a worker picks it up. If the worker then crashes, the message is gone forever. With late ack, a crash means the message gets delivered again.
- **`reject_on_worker_lost`**: if the worker process is killed outright (for example by the out-of-memory killer), Celery would otherwise still acknowledge the message. This setting puts it back in the queue instead.
- **"At least once" means duplicates can happen.** The queue promises to deliver each message *at least* once, so sometimes twice. The work must be idempotent. `chunk_id(job.id, index)` always gives the same ID for the same chunk, so a retry **overwrites** the same vectors instead of adding a second copy.
- **Sort your errors.** A network blip or `429` is temporary: retry. A broken file is permanent: retrying 5 times just wastes workers.
- **Back off with jitter.** Waits grow roughly 1 s, 2 s, 4 s, 8 s... (capped at 600 s), and each wait is randomized so retries don't all hit at the same moment.
- **Time limits** stop one nasty document from holding a worker forever.

## Step 5: tracking progress

```text
GET /jobs/8f2a...
{
  "status": "processing",
  "progress": { "done": 120, "total": 340 },
  "attempts": 1,
  "error": null
}
```

**Polling** every few seconds is simple and works through any proxy. **Server-sent events** or **WebSockets** (live connections where the server pushes updates) feel nicer, but you then have to manage those open connections. Choose them only when the product really needs instant updates.

Either way, the status always comes from the **job database**, never from asking a worker.

## Step 6: failures, retries and the dead-letter state

| Failure | Right response |
| --- | --- |
| Worker crashes mid-job | Late ack delivers it again; idempotent writes make that safe. |
| Embedding API returns `429` or `503` | Retry with growing, randomized waits; slow the whole fleet with a shared rate limit. |
| Corrupt or encrypted PDF | Mark `failed` right away, with a clear reason the user can read. |
| Same job retried 5 times | Mark `failed`, keep the error and the file, alert someone to investigate. |
| Message lost from the queue | The sweeper re-queues old `queued` jobs; the claim step makes duplicates harmless. |
| Stuck in `processing` too long | The sweeper sets it back to `queued` once its lease has expired. |

Treat a failed job as **part of the product**, not just a log line. Show the user what happened, and offer a "retry" button that starts a fresh attempt.

## More workers is not the same as scaling

More workers **move** the bottleneck; they don't remove it. With no limits, 200 workers all call the embedding API at once, hit its rate limit, and the whole pipeline turns into one big **retry storm** (retries causing more failures, causing more retries).

Add these controls on purpose:

| Control | What it protects |
| --- | --- |
| **Worker concurrency limit** (jobs per machine) | Memory and CPU on each machine. PDF parsing can be very heavy. |
| **Prefetch of 1** (`worker_prefetch_multiplier=1`) | Each worker grabs one job at a time, so jobs don't sit stuck behind one slow job on the same worker. |
| **Rate limit on outside calls** | The embedding service and vector database. |
| **Separate queues** (`small`, `large`, `reindex`) | A 500-page upload can't block one-page uploads. |
| **Per-user limits and fair turns** | One customer can't take every worker. |
| **Capped queue and admission control** | The system says "try later" instead of accepting work it can't finish. |

### Backpressure

Backpressure means the system **pushes back** when it's overloaded, instead of quietly piling up an endless backlog.

Pick the limit from **what you promised users**. Example:

- You promise "processed within 15 minutes" (900 seconds).
- Workers finish about **5 documents per second**.
- 5 × 900 = **4,500 jobs**. A queue deeper than that already breaks the promise.

Past that point, reply `429` or `503` with a `Retry-After` header, or tell the user plainly that processing is delayed. **An honest long wait beats a short wait that's a lie.**

The number to watch is **queue age** (how long the oldest message has been waiting), not just how many are waiting. Ten tiny jobs and ten huge jobs look the same by count. Autoscale workers based on queue age, with a **hard maximum**, so a spike can't turn into a giant cloud bill.

## Capacity in one line

```text
drain time ≈ (jobs × average seconds per job) ÷ number of workers
```

For 500 jobs at 60 seconds with 50 workers: 500 × 60 ÷ 50 = **600 seconds**.

Two cautions:

- When making a promise to users, use the **p95** job time (95% of jobs are faster than this), not the average.
- The outside service's rate limit may cap how many workers are actually useful, well below what your servers could run.

## What to monitor

| Metric | Why it matters |
| --- | --- |
| Queue size and **oldest message age** | Are we keeping up? |
| Job time (p50, p95, p99) by document size | Spot slow documents and things getting slower over time. |
| Success, retry and permanent-failure rates | Is a service we depend on getting sick? |
| Dead-letter count | Work that needs a human. |
| Worker memory and restarts | PDF parsing is a classic cause of out-of-memory crashes. |
| Time from upload to `succeeded` | The number the user actually feels. |

## Common mistakes

- Doing "just the first step" inside the request, and the rest in the background. The slow part is rarely the one you guessed.
- Putting the file or full text in the queue message instead of an ID.
- Acknowledging the message before the work succeeds.
- Retrying every error the same way, including ones that can never succeed.
- Writes that aren't idempotent, so a retry creates duplicate vectors and double-counts.
- Unlimited queue, unlimited retries and unlimited workers: three ways to fail at once.
- Using the queue as the only record of what happened.

## The big takeaway

Background processing isn't just "move code to another process". It's giving each part a **different promise**:

- the **API** promises a fast answer,
- the **database** promises an honest status,
- the **queue** promises delivery at least once,
- the **workers** promise to finish safely, however many times they're asked.

Accept quickly, record durably, process idempotently, and push back when you're full. Then prove it with 500 uploads and a worker you kill on purpose.

## Quick recap

- 📥 **Accept fast:** save the file, write a `queued` job row, queue only the ID, reply `202`.
- 🗂️ **Database is the truth:** the queue just delivers; a sweeper fixes lost or stuck jobs.
- 🔁 **Safe to redo:** ack late, claim atomically with a lease, use fixed chunk IDs and upserts.
- 🧯 **Sort errors:** retry temporary ones with backoff and jitter; fail permanent ones right away.
- 🚦 **Push back:** cap the queue based on your promise, and watch queue age.
