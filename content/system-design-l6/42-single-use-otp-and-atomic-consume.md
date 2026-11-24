---
title: "A WhatsApp OTP Is Only Single Use If You Make It So"
summary: "Make a one-time code really work only once, even when two requests arrive in the same second: store a hash, check and mark it used in one step, limit wrong guesses, handle crashes, and test the race."
level: Advanced
tags: [system-design, security, authentication, otp, concurrency, atomicity, race-condition, postgresql, redis, idempotency]
---

## The story in one minute

A user gets a **6-digit code on WhatsApp** (an *OTP*, one-time passcode), types it in, and logs in. Good.

Here is what goes wrong, step by step:

1. Five minutes later, someone else sends the **same code**. Maybe an attacker who saw the message, maybe a client retrying.
2. The server checks: "Is this code right? Yes." It logs them in **too**.
3. Worse version: two requests with the same code reach **two different servers in the same millisecond**.
4. Both servers read "not used yet". Both log the user in.

The code was called "one-time", but it worked **twice**. This lesson is about making "once" really mean once.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **OTP** | A short code that should work once, for a few minutes. | A cloakroom ticket. |
| **Consume** | Use up the code and mark it used. | Handing in the ticket and getting your coat. |
| **Atomic** | Happens as one single step. Nothing can sneak in between. | A turnstile: you push and pass in one motion. |
| **Race condition** | Two things happen at the same time and both "win" when only one should. | Two people grabbing the last seat at the same moment. |
| **Hash** | A one-way scramble of a value. You can check a guess against it, but not reverse it. | A fingerprint: it matches the person but isn't the person. |
| **Transaction** | A group of database steps that all succeed, or all get undone. | A bank transfer: money leaves one account *and* arrives in the other, or neither. |

## The fix in four rules

### Rule 1: Store a fingerprint, not the code

Generate the code with a **secure random** generator. Store only a **hash** of it, plus `expires_at`, an `attempts` counter, and an empty `consumed_at`.

❌ **Wrong:** save `482913` in the database. Anyone who sees the database can use it.

✅ **Right:** save a keyed hash of it. A database leak reveals nothing usable.

### Rule 2: Check and mark "used" in one step

Make the check (*right code? not used? not expired?*) and the write (*mark used*) **one database statement**.

❌ **Wrong:** read the row, decide in app code, then write `used = true`. There's a gap in between.

✅ **Right:** `UPDATE ... WHERE consumed_at IS NULL ...`. The database picks exactly one winner.

### Rule 3: Log in at the same time, or use the code up first

If you can, create the login (the *session*) **in the same transaction** as consuming the code. If you can't, **consume the code first**, then create the session in a way that's safe to repeat.

### Rule 4: Limit wrong guesses

A 6-digit code has only **1,000,000** possible values. With unlimited tries, an attacker will find it. The **attempt counter** is the real security control.

## Walk through a failure

**Two correct requests arrive together.** Both run the consume statement.

1. The database **locks** the row for the first request (a lock is a "wait, I'm using this" sign).
2. The second request **waits**.
3. The first one sets `consumed_at` and finishes.
4. The second one wakes up and **re-checks** `consumed_at IS NULL`. It's now false, so it updates **zero rows**.
5. One request logs in. The other gets "invalid or already used".

**Now the winner's server crashes** after the consume was saved, but before it created the session.

- The code is used up ("burned"), and the user is **not** logged in.
- That's the **correct, safe** failure. Nobody got in. The user asks for a new code (within rate limits).
- If sessions live in a separate system, you can save a **login-attempt ID** with the consumption. Then the *same* client can safely finish its login instead of starting over.

## How to prove it works

1. Fire **50 verify requests at the same time** with the same correct code. Exactly **1** succeeds and **49** are rejected.
2. Repeat **after the code expires**: all are rejected.
3. Repeat **after the attempt limit** is reached: all are rejected, even with the right code.
4. **Kill the process** between consume and session creation. The code can't be used again.
5. Search the database and logs: **no plain-text code** appears anywhere.

### Check your understanding

Why is "SELECT the code, then UPDATE it if unused" unsafe, while a single `UPDATE ... WHERE consumed_at IS NULL` is safe? And what happens to a login whose server crashed right after the consume succeeded?

<details>
<summary>Show answer</summary>

**SELECT then UPDATE** has a gap. Two requests can both SELECT and both see "unused" before either one writes. Then both UPDATE, and both log in.

**A single UPDATE** has no gap. The database locks the row while it checks and writes. The second request waits, re-checks the condition, finds `consumed_at` already set, and changes **zero rows**, so it loses.

**After a crash** following the consume, the code is burned and the user isn't logged in. That's safe: they request a new code. (Or, if you saved a login-attempt ID, the same client can retry with it and finish the login.) You must **never** "un-burn" the code on a guess that the login probably failed.

</details>

---

## Going deeper

## An OTP is just a number with a time window

Nothing about a 6-digit number makes it single use. On its own, it's just a value that's **valid for a few minutes**. "Single use" is a **fact you write down**: a row that says "this code was used at this moment".

If writing that fact and granting the login aren't the same step, two requests can both see "unused" and both win:

```text
Request A: read code → unused          Request B: read code → unused
Request A: log user in                 Request B: log user in
Request A: mark used                   Request B: mark used
                      ↑ both succeeded
```

This is a classic **time-of-check to time-of-use (TOCTOU)** race: the world changes between when you **check** and when you **act**. Faster code doesn't fix it. Removing the gap between check and write does.

Think of two cashiers selling the last concert ticket. Both look at the screen, both see "1 left", both sell it. The fix isn't faster cashiers. It's a system where "sell" and "mark sold" happen together.

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

The last part is a **partial unique index**: "among rows that aren't used yet, each (user, purpose) pair may appear only once". So you can't leave several valid codes lying around. When a user asks for a new code, you must first mark the old one used (invalidate it) or replace it.

Why care? Every live code is another chance for a lucky guess. Fewer live codes, fewer chances.

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

- **Use a secure random source.** `randomInt` from `crypto` uses a *CSPRNG* (cryptographically secure random number generator). `Math.random()` can be predicted.
- **Hash the code, with a secret key.** A plain SHA-256 of a 6-digit number is useless: an attacker who steals the database just hashes all 1,000,000 possibilities in well under a second and finds the match. That's why we use an **HMAC**, a hash mixed with a secret key (called a *pepper*) that lives in the server's config, **not** in the database. Without the pepper, the stolen hashes can't be checked.
- **Tie it to its context** (user and purpose). A code sent for a password reset must not work to confirm a payment.

## The atomic consume

This one statement is the heart of the lesson:

```sql
UPDATE otp_codes
SET    consumed_at = now()
WHERE  user_id    = $1
  AND  purpose    = $2
  AND  code_hash  = $3
  AND  consumed_at IS NULL     -- not used yet
  AND  expires_at > now()      -- not expired
  AND  attempts   < 5          -- not locked out by wrong guesses
RETURNING id;
```

- **One row back:** you won. Go ahead and log in.
- **Zero rows back:** the code was wrong, expired, locked, or already used. Give the **same answer** for every reason, so an attacker can't tell which.

**Why it's safe:** the database locks the matching row while it updates. In PostgreSQL's default mode (`READ COMMITTED`), a second `UPDATE` on the same row **waits** for the first to finish, then **re-checks** the `WHERE` conditions against the new version of the row. `consumed_at` is no longer `NULL`, so nothing matches. Check and write are **one operation**, so there's no gap to slip through.

The unsafe version splits them:

```sql
SELECT ... WHERE ... AND consumed_at IS NULL;   -- both requests see "unused"
-- application code decides it is fine
UPDATE otp_codes SET consumed_at = now() WHERE id = $1;   -- both succeed
```

### Another way: let the first insert win

You can get the same guarantee with a **unique constraint** (a rule that a value can appear only once):

```sql
CREATE TABLE otp_consumptions (
  otp_id      uuid PRIMARY KEY,         -- a code can be consumed only once
  consumed_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO otp_consumptions (otp_id) VALUES ($1);
-- first insert succeeds; the second fails with a unique violation
```

"One insert wins. The other gets a conflict." This is handy when:

- the "used" record must live in a different place from the codes, or
- you want a history that only ever grows (an *append-only audit trail*).

Either way, **the database picks the winner**, not app code that looked at the data a moment earlier.

### The same idea in Redis

If codes live in **Redis** (a fast in-memory store), use a command that **reads and deletes in one step**, instead of `GET` followed by `DEL`:

```text
GETDEL otp:{userId}:{purpose}      # returns the value and removes it atomically
```

Then compare the returned hash with the submitted one.

One catch: `GETDEL` deletes the code even when the guess was **wrong**. If you want "5 tries, then dead" instead, you need more logic, so a short **Lua script** (which Redis runs as one atomic step) or a database is often cleaner.

## Do the login in the same transaction

When sessions live in the **same database**, make "consume the code" and "create the login" **one transaction**:

```sql
BEGIN;
  UPDATE otp_codes SET consumed_at = now() WHERE ... RETURNING id;   -- 0 rows → ROLLBACK
  INSERT INTO sessions (user_id, ...) VALUES (...);
COMMIT;
```

Now there are only two possible outcomes:

| Crash happens... | Result |
| --- | --- |
| Before `COMMIT` | Both steps are undone. The code is still unused. The user tries again within the time window. |
| After `COMMIT` | The user is logged in. |

There's no half-done state in between. That's the best possible answer to "what if it dies halfway?"

## When the login lives in another system

Often the session lives somewhere else: a token service, Redis, another microservice. Then one transaction is impossible. You have two separate steps, and you must pick **which failure you'd rather have**:

| Order | If it crashes in between | Verdict |
| --- | --- | --- |
| Consume code, **then** create session | Code is burned, user not logged in | ✅ **Safe.** The user asks for a new code. |
| Create session, **then** consume code | User logged in, code still usable | ❌ **Unsafe.** A second login can also win. |

**Always consume first.** A burned code is annoying. A reusable code is a security incident.

You can make the safe failure less annoying:

1. At the start of verification, create a `login_attempt_id` (or let the client send one).
2. Save it together with the consumption.
3. If the **same client** retries with the **same** `login_attempt_id`, the server sees "already consumed, *by this very attempt*" and just finishes creating the session. Doing that twice is harmless (it's *idempotent*).

Without that proof, the only safe choices are: wait for the window to end, or send a fresh code. **Never** re-open a used code because "the first login probably didn't finish."

## Wrong guesses and the attempt limit

A one-in-a-million guess isn't safe if an attacker can try a million times. So **count wrong guesses**.

Do it in a **separate statement** that isn't undone (rolled back) when the verify fails:

```sql
UPDATE otp_codes
SET    attempts = attempts + 1
WHERE  user_id = $1 AND purpose = $2 AND consumed_at IS NULL
RETURNING attempts;
```

When `attempts` reaches the limit (usually 3 to 5), the code is dead: the consume statement above already refuses it (`attempts < 5`), and you can also mark it used so a new code can be issued. Then require a new code.

Quick math on why this works: with 5 tries per code, the chance of guessing right is 5 in 1,000,000 (0.0005%). With no limit, it's 100%.

Put more limits around it:

| Limit | Typical rule |
| --- | --- |
| Attempts per code | 5, then the code is dead |
| Code requests per user / phone | e.g. 3 per 10 minutes |
| Requests per IP and per device | Rate limit, and watch for one source trying many accounts |
| Lifetime | 3 to 10 minutes for login codes |
| Wait before resending | 30 to 60 seconds |

Also: **sending** a WhatsApp or SMS message costs money. An unprotected "send code" button can be abused to run up your bill, or to spam someone's phone. Rate-limit **sending** as strictly as **verifying**.

## Other details that matter

- **Same response for every failure.** "Wrong code", "expired" and "already used" should look identical to an attacker, and take about the same time.
- **Constant-time comparison** if you compare hashes in app code (use `timingSafeEqual`). A normal comparison stops at the first different byte, and that tiny time difference can leak information. Comparing inside the SQL `WHERE` avoids the issue.
- **Never log the code**, the request body, or the WhatsApp message text.
- **Delete or archive old rows** after a few days. They're no longer useful, and they hold security-sensitive data.
- **Messaging apps aren't fully secure.** Anyone who can see the phone's notifications, or who takes over the phone number, can read the code. For high-risk actions, prefer an authenticator app or a hardware key, and treat SMS or WhatsApp as the weaker option.
- **Retrying the same request is different.** If the network re-sends the *same* verify request (same `request_id`), returning the saved result is fine. Don't confuse that with accepting a second, **separate** use of the code.

## Test the race, don't just reason about it

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

`Promise.all` fires all 50 requests at once, which is exactly the situation that breaks a check-then-write design. Add the same kind of test for expiry, the attempt limit, and a simulated crash between consume and session creation. If your tests only ever call verify one at a time, they prove nothing about races.

## Common mistakes

- Reading the code, deciding in app code, then writing `used = true` as a second step.
- Marking "used" **after** creating the session, or in a background job.
- Storing the plain code, or hashing it with plain SHA-256 (a million guesses takes no time; use a keyed HMAC with a secret pepper).
- A 6-digit code with no attempt limit.
- Several live codes per user, each one an extra chance to guess.
- Different error messages for "expired" and "wrong".
- Trusting a cache or a *read replica* (a read-only copy of the database that may be slightly behind) for the "unused" check. The consume must hit the main database or the one true store.
- Re-opening a burned code because "the login probably failed."

## The big takeaway

The hard part of an OTP isn't making the number. It's making the **consume atomic**, so one request wins and every other one gets a clean "no".

Write the "used" mark in the same step that makes the decision. When a crash leaves you unsure, prefer a burned code over a reusable one. Limit attempts, because the code space is small. Then prove it with 50 requests in the same second, instead of assuming it works.

## Quick recap

- 🔐 **Store a keyed hash,** never the plain code; generate it with a secure random source.
- ⚛️ **One statement decides:** `UPDATE ... WHERE consumed_at IS NULL AND not expired` returns 1 row for the single winner.
- 🔥 **Consume first:** a burned code after a crash is safe; a reusable one is not.
- 🚫 **Limit guesses and sends:** about 5 tries per code, plus rate limits on sending.
- 🧪 **Test the race:** 50 requests at once, exactly 1 success.
