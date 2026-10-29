---
title: "A WhatsApp OTP Is Only Single Use If You Make It So"
summary: "Design one-time passcodes that can be consumed exactly once, even when two requests arrive in the same second: hashed codes, atomic consume, attempt limits, crash recovery and race-condition tests."
level: Advanced
tags: [system-design, security, authentication, otp, concurrency, atomicity, race-condition, postgresql, redis, idempotency]
---

## The problem in context

A user receives a 6-digit OTP on WhatsApp, enters it and is logged in. Five minutes later someone with the same code (an attacker who saw the message, or a retrying client) submits it and is logged in too. In a second variant, two requests with the same valid code reach two API servers in the same millisecond, both read "not used yet", and both succeed.

## What must be true

For one issued code, at most one verification may succeed, no matter how many requests, servers or retries are involved. A code must also stop working after its time window and after too many wrong guesses.

## Practical response

1. **Generate** the code with a cryptographically secure random generator, store only a **hash** of it, and record `expires_at`, `attempts` and an empty `consumed_at`.

2. **Make consuming the code one atomic database operation** that checks *unused*, *unexpired* and *matches* and marks it used in the same statement, so there is no gap between check and write.

3. **Create the login in the same step** (same transaction) whenever you can. If you cannot, record the consumption first and make the next step idempotent.

4. **Limit attempts.** A 6-digit code has only one million possibilities, so the attempt counter is the real security control.

### Walk through a failure and recovery

Two requests with the correct code arrive together. Both run the consume statement. The database locks the row for the first; the second waits, then re-evaluates the condition `consumed_at IS NULL`, finds it false and updates **zero rows**. One request logs in; the other gets `invalid or already used`. Now suppose the winner's server crashes after the consume committed but before it issued a session. The code is burned, so the user is not logged in. That is the correct, safe failure: the user requests a new code (within rate limits), and nobody gained access. If the session store is a separate system, you can store a login-attempt ID with the consumption so the *same* client can safely resume instead of starting over.

## How to prove it worked

Fire 50 concurrent verify requests with the same valid code and assert exactly one success and 49 rejections. Repeat after the expiry time and after the attempt limit. Kill the process between consume and session creation and assert the code cannot be reused. Check that no plain-text code appears in the database or logs.

### Check your understanding

Why is "SELECT the code, then UPDATE it if unused" unsafe, but a single `UPDATE ... WHERE consumed_at IS NULL` is safe? And what happens to a login whose server crashed after the consume succeeded?

---

## Concepts and implementation details

## An OTP is a number with a window

Nothing about a 6-digit number makes it single use. By itself it is just a value that is *valid for a time window*. "Single use" is a **fact you write down**: a row that says this code was consumed at this moment. If recording that fact and granting the login are not the same step, two requests can both see "unused" and both win.

```text
Request A: read code → unused          Request B: read code → unused
Request A: log user in                 Request B: log user in
Request A: mark used                   Request B: mark used
                      ↑ both succeeded
```

This is a classic **time-of-check to time-of-use (TOCTOU)** race. The fix is not faster code; it is removing the gap between *check* and *write*.

## The data model

```sql
CREATE TABLE otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL,
  purpose     text        NOT NULL,            -- 'login', 'reset_password', 'confirm_payment'
  code_hash   bytea       NOT NULL,            -- never the plain code
  expires_at  timestamptz NOT NULL,
  attempts    int         NOT NULL DEFAULT 0,
  consumed_at timestamptz,                     -- NULL means still usable
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Only one live code per user and purpose
CREATE UNIQUE INDEX one_live_otp
  ON otp_codes (user_id, purpose)
  WHERE consumed_at IS NULL;
```

The partial unique index means a new request cannot leave several valid codes lying around: you either invalidate the old one or replace it. The fewer live codes exist, the smaller the guessing surface.

## Generating and storing the code

```ts
import { randomInt, createHmac } from 'crypto';

function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0'); // CSPRNG, never Math.random()
}

function hashOtp(code: string, userId: string): Buffer {
  // HMAC with a server-side secret ("pepper") and the user id as context
  return createHmac('sha256', process.env.OTP_PEPPER!).update(`${userId}:${code}`).digest();
}
```

- **Use a secure random source.** `Math.random()` is predictable.
- **Hash the code.** A database leak must not reveal usable codes. A plain SHA-256 of a 6-digit number can be reversed in microseconds by trying all million values, which is why the hash is keyed with a secret pepper that is *not* stored in the database.
- **Bind it to context** (user, purpose) so a code for password reset cannot confirm a payment.

## The atomic consume

This single statement is the heart of the lesson:

```sql
UPDATE otp_codes
SET    consumed_at = now()
WHERE  user_id    = $1
  AND  purpose    = $2
  AND  code_hash  = $3
  AND  consumed_at IS NULL
  AND  expires_at > now()
RETURNING id;
```

- **One row returned:** you won. Proceed.
- **Zero rows returned:** the code was wrong, expired or already used. Respond the same way for every reason so the endpoint does not reveal which.

Why this is safe: the database takes a lock on the matching row. Under the default `READ COMMITTED` isolation, a second concurrent `UPDATE` waits for the first to commit, then re-checks the `WHERE` clause against the new row version. `consumed_at` is no longer `NULL`, so it matches nothing. Check and write are **one operation**, so there is no gap to race through.

The unsafe version separates them:

```sql
SELECT ... WHERE ... AND consumed_at IS NULL;   -- both requests see "unused"
-- application code decides it is fine
UPDATE otp_codes SET consumed_at = now() WHERE id = $1;   -- both succeed
```

### The insert-wins alternative

Another way to get the same guarantee is to let a **unique constraint** decide the winner:

```sql
CREATE TABLE otp_consumptions (
  otp_id      uuid PRIMARY KEY,         -- a code can be consumed only once
  consumed_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO otp_consumptions (otp_id) VALUES ($1);
-- first insert succeeds; the second fails with a unique violation
```

"One insert wins. The other gets a conflict." This is useful when the consumption must be recorded in a different store from the codes, or when you want an append-only audit trail. In either style, the winner is chosen by the database, not by application code that ran earlier.

### The same idea in Redis

If codes live in Redis, use an operation that reads and deletes in one step instead of `GET` followed by `DEL`:

```text
GETDEL otp:{userId}:{purpose}      # returns the value and removes it atomically
```

Compare the returned hash to the submitted one. If a wrong code consumed the key, you need to handle that deliberately (see attempts below), so for multi-field logic a short Lua script or a database is often cleaner.

## Do the login in the same transaction

When the sessions or the user's state live in the same database, make consuming the code and creating the login **one transaction**:

```sql
BEGIN;
  UPDATE otp_codes SET consumed_at = now() WHERE ... RETURNING id;   -- 0 rows → ROLLBACK
  INSERT INTO sessions (user_id, ...) VALUES (...);
COMMIT;
```

Now a crash anywhere before `COMMIT` rolls back both: the code is still unused and the user can try again within the window. A crash after `COMMIT` means the user is logged in. There is no state in between, which is the best answer to "what if it dies halfway?"

## When the login is in another system

Often the session lives elsewhere (a token service, Redis, another microservice), so one transaction is impossible. You then have two steps and must choose which failure to prefer:

| Order | If it crashes in between | Verdict |
| --- | --- | --- |
| Consume code, **then** create session | Code is burned, user not logged in | **Safe.** The user asks for a new code |
| Create session, **then** consume code | User logged in, code still usable | **Unsafe.** Two logins can win |

Always consume first. A burned code is an inconvenience; a reusable code is a security incident.

You can still reduce the pain. Record a `login_attempt_id` (supplied by the client, or created at the start of verification) alongside the consumption. If the same client retries with the same `login_attempt_id`, the server sees "already consumed *by this attempt*" and finishes issuing the session idempotently instead of forcing a new code. Without that proof, the only safe options are to wait out the window or issue a fresh code. Never reopen a consumed code on the basis of a guess that "the first login probably never finished."

## Wrong guesses and the attempt limit

A one-in-a-million guess is not safe if an attacker may try millions of times, so count failures. Do it in a **separate statement that is not rolled back** by the failure path:

```sql
UPDATE otp_codes
SET    attempts = attempts + 1
WHERE  user_id = $1 AND purpose = $2 AND consumed_at IS NULL
RETURNING attempts;
```

When `attempts` reaches the limit (commonly 3 to 5), invalidate the code and require a new one. Add limits around it, too:

| Limit | Typical rule |
| --- | --- |
| Attempts per code | 5, then the code is dead |
| Code requests per user / phone | e.g. 3 per 10 minutes |
| Requests per IP and per device | Rate limit and watch for spraying many accounts |
| Lifetime | 3 to 10 minutes for login codes |
| Cooldown on resend | 30 to 60 seconds |

Also remember that sending a WhatsApp or SMS message costs money. An unprotected "send code" endpoint can be abused to run up your bill or harass someone, so rate-limit sending as strictly as verifying.

## Other details that matter

- **Same response for every failure.** "Wrong code", "expired" and "already used" should look identical to an attacker, with similar timing.
- **Constant-time comparison** if you compare hashes in application code (`timingSafeEqual`), though comparing inside the SQL `WHERE` avoids the issue entirely.
- **Never log the code**, the request body or the WhatsApp message content.
- **Delete or archive old rows** after a few days. They are no longer useful and they hold security-relevant data.
- **Messaging channels are not secure.** Anyone who can read the phone's notifications or take over the number can read the OTP. For high-risk actions prefer app-based or hardware factors, and treat SMS or WhatsApp as the weaker option.
- **Idempotent requests are different.** If the *same* verify request is retried by the network, a second attempt with the same `request_id` can safely return the stored result. Do not confuse that with accepting a second, separate use of the code.

## Test the race, do not just reason about it

```ts
it('allows exactly one of 50 concurrent verifications', async () => {
  const { userId, code } = await issueOtp();
  const results = await Promise.all(
    Array.from({ length: 50 }, () => verifyOtp(userId, code)),
  );
  expect(results.filter((r) => r.ok)).toHaveLength(1);
  expect(results.filter((r) => !r.ok)).toHaveLength(49);
});
```

Add the same test against expiry, the attempt limit and a simulated crash between consume and session creation. If your test only calls verify once at a time, it proves nothing about concurrency.

## Common mistakes

- Reading the code, deciding in application code, then writing `used = true` as a second step.
- Setting "used" **after** creating the session, or in a background job.
- Storing the plain code, or hashing it with unsalted SHA-256.
- A six-digit code with no attempt limit.
- Several live codes per user, each a fresh guessing chance.
- Different error messages for "expired" and "wrong".
- Trusting a cache or read replica for the "unused" check. The consume must hit the primary or the single authoritative store.
- Re-opening a burned code because "the login probably failed."

## The L6 takeaway

The hard part of an OTP is not generating the number. It is making the *consume* atomic, so that one request wins and every other gets a clean conflict.

Write the used flag in the same step that makes the decision. Prefer a burned code over a reusable one when a crash leaves you unsure. Limit the attempts, because the code space is small. Then prove the guarantee with 50 requests in the same second instead of assuming it.
