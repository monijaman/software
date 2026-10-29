---
title: "500 Users Upload Documents at Once: Design the Background Job Pipeline"
summary: "Move slow document processing out of the HTTP request with object storage, a job table, a task queue and workers, then make it safe with retries, idempotency, concurrency limits and backpressure."
level: Advanced
tags: [system-design, background-jobs, queues, celery, fastapi, redis, postgresql, backpressure, idempotency, rag]
---

## The problem in context

An AI application lets users upload PDFs. For every file the backend must extract text, clean it, split it into chunks, generate embeddings, store vectors and update the processing status. One document takes a few seconds; another takes minutes. At 9:00 a.m., 500 users upload at the same time, and the first version of the API does all of that work inside the HTTP request.

## What must be true

The API must answer quickly no matter how slow processing is. Every accepted document must be processed exactly once in effect, even when workers crash or retry. Load beyond capacity must wait or be refused in a controlled way instead of taking the whole system down.

## Practical response

1. **Accept:** validate the request, store the file in object storage, and return `202 Accepted` with a `job_id`. Do no heavy work here.

2. **Record:** insert a row in the job table (`queued`) in the database before anything else can fail.

3. **Queue:** publish a small message containing only the `job_id`. The file and the state live elsewhere; the message is just a pointer.

4. **Process:** a worker claims the job, runs the pipeline, writes vectors and marks the job `succeeded`.

5. **Track:** the frontend polls `GET /jobs/{id}` (or listens on a real-time channel) and shows `queued → processing → succeeded / failed`.

6. **Fail safely:** retry transient errors with exponential backoff and jitter; send jobs that keep failing to a dead-letter state for a human to inspect.

### Walk through a failure and recovery

At 9:00, 500 jobs arrive. Each takes about 60 seconds of worker time, which is 30,000 worker-seconds of work. With 50 workers that drains in about 10 minutes, so users see `queued` for a while but the API stays fast. Halfway through, a worker is killed by the out-of-memory killer while holding a job. Because the message is acknowledged only after the work finishes, the broker redelivers it to another worker. That worker uses deterministic chunk IDs and upserts vectors, so reprocessing overwrites the half-written data instead of duplicating it. The embedding provider then starts returning `429`; retries back off with jitter, and a rate limit on the embedding step stops the workers from making things worse.

## How to prove it worked

Load-test with 500 simultaneous uploads and a worker killed mid-job. Require: API p99 stays low and independent of document size; every job reaches a terminal state; no duplicate vectors exist for any document; queue age returns to near zero after the burst; and when the queue is full, new uploads get a clear rejection instead of timeouts.

### Check your understanding

If 2,000 documents arrive, each needs 45 seconds of worker time, and you run 30 workers, about how long until the last one finishes? What would you show the user, and at what queue depth would you start refusing uploads?

---

## Concepts and implementation details

## Why the synchronous version fails

```text
Client → API: POST /documents   (request stays open...)
          extract → clean → chunk → embed → store → respond
```

Three things go wrong at once:

| Problem | What happens |
| --- | --- |
| **Request time is unbounded** | Proxies and browsers time out at 30 to 60 seconds, so the user sees an error while the work may still be running |
| **Capacity is tied to web workers** | 500 slow uploads occupy every API worker, so even a simple `GET /health` stops answering |
| **Failure loses the work** | A crash at step 5 leaves no record of what finished and no way to resume |

The core idea of a background job architecture is to **separate accepting work from doing work.** The first is fast and must always be available; the second is slow and can be scaled, paced and retried independently.

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

| Component | Owns | Why it is separate |
| --- | --- | --- |
| **Object storage** | The raw file | Large bytes do not belong in a queue message or a database row |
| **Job database** | The source of truth for status, attempts and errors | The queue can lose or duplicate messages; the database is what you trust and report |
| **Task queue** | Delivery of work to workers | Absorbs bursts so the API and workers do not have to run at the same speed |
| **Workers** | The slow pipeline | Scale and restart without touching the API |
| **Vector database** | The finished embeddings | Written only after a document is fully processed |

A common mistake is to treat the queue as the system of record. Keep the **database** as the truth and the queue as a delivery mechanism. If the queue is flushed, a sweeper can re-enqueue every job still marked `queued`.

## Step 1 and 2: accept, store and record

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

The order matters. If the process dies after storing the file but before inserting the job, you have an orphan file that a lifecycle rule can clean up. If it died after inserting the job but before enqueueing, a periodic sweeper finds old `queued` jobs and enqueues them. Both are recoverable; "enqueue first, record later" is not, because a worker could receive a job the database knows nothing about.

For very large files let the browser upload straight to object storage with a presigned URL and have a storage event create the job. The API then never handles the bytes at all.

## Step 3 and 4: the job as a state machine

```text
queued → processing → succeeded
              │
              ├──► queued   (retry after transient failure, attempts + 1)
              └──► failed   (retries exhausted, needs investigation)
```

A worker must **claim** a job before working on it. Do it with one conditional update so two workers can never both own the same job:

```sql
UPDATE jobs
SET status = 'processing', started_at = now(), attempts = attempts + 1
WHERE id = $1 AND status IN ('queued')
RETURNING id, object_key;
```

If it returns no row, another worker already has it, or it is finished, and this worker simply drops the message. This is the same atomic-check-and-set idea used for idempotent payments and single-use OTPs.

The worker itself:

```python
@celery.task(
    bind=True,
    acks_late=True,                      # acknowledge AFTER success
    autoretry_for=(TransientError,),
    retry_backoff=True,                  # 1s, 2s, 4s, 8s ...
    retry_backoff_max=600,
    retry_jitter=True,                   # randomise so retries do not stampede
    max_retries=5,
    soft_time_limit=300,
    time_limit=330,
)
def process_document(self, job_id: str):
    job = claim_job(job_id)
    if job is None:
        return                                   # already owned or done

    try:
        text   = extract_text(storage.get(job.object_key))
        chunks = split(clean(text))
        for batch in batched(chunks, 64):
            vectors = embed(batch)               # rate-limited, may raise TransientError
            vector_db.upsert([
                (chunk_id(job.id, c.index), v, c.metadata)   # deterministic ID
                for c, v in zip(batch, vectors)
            ])
            update_progress(job.id, done=c.index + 1, total=len(chunks))
        mark_succeeded(job.id)
    except PermanentError as e:                  # corrupt PDF, password protected...
        mark_failed(job.id, str(e))              # do not retry what cannot succeed
```

Several details here carry the whole design:

- **`acks_late`**: with the default early acknowledgement, a worker that crashes mid-job loses the message forever. Late acknowledgement turns a crash into a redelivery.
- **At-least-once means duplicates are possible**, so the work must be **idempotent**. `chunk_id(job.id, index)` is deterministic, so a retry overwrites the same vectors instead of adding another copy.
- **Classify errors.** A network blip or `429` is transient: retry. A corrupted file is permanent: retrying 5 times only wastes capacity.
- **Time limits** stop one pathological document from holding a worker forever.

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

Polling every few seconds is simple and works through any proxy. Server-sent events or WebSockets feel nicer but add connection management; choose them when the product needs instant updates. Either way the data comes from the job database, never from asking the worker.

## Step 6: failures, retries and the dead-letter state

| Failure | Right response |
| --- | --- |
| Worker crashes mid-job | Late ack redelivers; idempotent writes make it safe |
| Embedding API returns `429` or `503` | Retry with exponential backoff and jitter; slow the whole fleet with a shared rate limit |
| Corrupt or encrypted PDF | Mark `failed` immediately with a clear user-facing reason |
| Same job retried 5 times | Mark `failed`, keep the error and the file, alert for investigation |
| Message lost from the queue | A sweeper re-enqueues old `queued` jobs; the claim step makes duplicates harmless |
| Stuck in `processing` for too long | A sweeper resets it to `queued` if its lease expired |

Treat a permanently failed job as a product, not a log line: show the user what happened and offer a retry button that creates a fresh attempt.

## Adding workers is not the same as scaling

More workers move the bottleneck; they do not remove it. Without limits, 200 workers all call the embedding API, hit its rate limit, and turn the whole pipeline into one big retry storm. Add these controls deliberately:

| Control | What it protects |
| --- | --- |
| **Worker concurrency limit** | Memory and CPU on each machine (PDF parsing can be very heavy) |
| **Prefetch of 1** (`worker_prefetch_multiplier=1`) | One slow job no longer hides behind a dozen prefetched ones |
| **Rate limit on external calls** | The embedding provider and vector database |
| **Separate queues** (`small`, `large`, `reindex`) | A 500-page upload cannot starve one-page uploads |
| **Per-user quota and fair scheduling** | One tenant cannot occupy every worker |
| **Bounded queue and admission control** | The system says "try later" instead of accepting work it cannot finish |

### Backpressure

Backpressure means the system pushes back when it is overloaded instead of silently collecting an unbounded backlog. Pick a limit from your promise to users. If you promise processing within 15 minutes and workers handle about 5 documents a second, a queue deeper than roughly 4,500 jobs already breaks that promise. Past that point, return `429` or `503` with a `Retry-After` header, or tell the user plainly that processing is delayed. A long, honest queue is better than a short, lying one.

The signal to watch is **queue age** (how long the oldest message has waited), not just queue length. Autoscale workers on queue age, with a hard maximum so a spike cannot become a cloud bill.

## Capacity in one line

```text
drain time ≈ (jobs × average seconds per job) ÷ number of workers
```

For 500 jobs at 60 seconds with 50 workers: 500 × 60 ÷ 50 = 600 seconds. Use the p95 job time, not the average, when you make a promise to users, and remember that the external rate limit may cap the real number of useful workers well below what your servers could run.

## What to monitor

| Metric | Why it matters |
| --- | --- |
| Queue depth and **oldest message age** | Are we keeping up? |
| Job duration (p50, p95, p99) by size class | Detect slow documents and regressions |
| Success, retry and permanent-failure rates | Is a dependency degrading? |
| Dead-letter count | Work that needs a human |
| Worker memory and restarts | PDF parsing is a classic out-of-memory source |
| Time from upload to `succeeded` | The number the user actually feels |

## Common mistakes

- Doing "just the first step" inside the request, then the rest in the background. The slow part is rarely the part you guessed.
- Putting the file or the full text in the queue message instead of an ID.
- Acknowledging the message before the work succeeds.
- Retrying everything the same way, including errors that can never succeed.
- Non-idempotent writes, so a retry creates duplicate vectors and double-counts results.
- Unlimited queue, unlimited retries and unlimited workers, which is three ways to fail at once.
- Using the queue as the only record of what happened.

## The L6 takeaway

Background processing is not about moving code to another process. It is about giving each part of the system a different promise: the API promises a fast answer, the database promises an honest status, the queue promises delivery at least once, and the workers promise to finish the job safely however many times they are asked.

Accept quickly, record durably, process idempotently, and push back when you are full. Then prove it with 500 uploads and a worker you kill on purpose.
