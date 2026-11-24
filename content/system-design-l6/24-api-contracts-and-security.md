---
title: "API Contracts, Gateways and Security"
summary: "Write down clearly what your API accepts and returns, change it without breaking old apps, and check on every request that the caller is allowed to touch that exact thing."
level: Advanced
tags: [system-design, api, gateway, auth, oauth, jwt, security]
---

## The story in one minute

Your mobile app lets a customer see **their own invoices**. The app calls:

```text
GET /invoices/1001
```

Here is what goes wrong, step by step:

1. Alice logs in. She gets a valid login token. All good.
2. She opens invoice **1001**, which is hers.
3. Out of curiosity she changes the URL to `/invoices/1002`.
4. The **gateway** (the front door of your system) checks her token: "valid, Alice is logged in." It lets the request through.
5. The invoice service just loads invoice 1002 and returns it. But invoice 1002 belongs to **a different company**.

Alice was **logged in**, but she was not **allowed** to see that invoice. Nobody checked the second part. This lesson is about checking both, and about keeping your API stable and safe.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **API contract** | A written promise: "send me this, I'll answer with that." | A restaurant menu with fixed dishes and prices. |
| **Authentication** (authn) | Proving **who** you are. | Showing your ID card at the hotel desk. |
| **Authorization** (authz) | Deciding what you are **allowed** to do. | Your key card opens room 204, not every room. |
| **Gateway** | One front door that every request passes through first. | The building's reception desk. |
| **Idempotency key** | A request ID so that sending the same request twice only does it once. | A ticket number: showing it twice doesn't get you two coats. |

## The fix in three rules

### Rule 1: Write the contract down before you build

For each endpoint, decide in advance: which fields come in, what's valid, what comes back, what errors look like, how paging works, and how the API will change over time.

❌ **Wrong:** rename the field `total` to `amount` in a new release. Every old app that reads `total` breaks.

✅ **Right:** **add** `amount` as a new field, keep `total` working for a while, and remove it only in a new **version** once old apps are gone. Changing by *adding* is safe. Changing by *renaming or removing* breaks people.

### Rule 2: "Logged in" is not the same as "allowed"

- The **gateway** checks the token: is this a real, unexpired login? (authentication)
- The **service that owns the data** checks: does this invoice belong to this user's company? (authorization)

❌ **Wrong:**

```sql
SELECT * FROM invoices WHERE id = 1002;
```

✅ **Right:** make the ownership part of the query itself:

```sql
SELECT * FROM invoices WHERE id = 1002 AND tenant_id = :caller_tenant;
```

(A **tenant** is one customer company in a shared system.) If the row isn't theirs, the query simply finds nothing.

### Rule 3: Make changes safe to repeat, and limit abuse

- For actions that **change** things (create an order, pay), accept an **idempotency key**. If the same key arrives twice, return the first result instead of doing it again. If the same key arrives with a **different** request body, reject it: that's a client bug or an attack.
- Put **rate limits** per user or API key (e.g. "100 requests per minute").
- **Never log** passwords, tokens or sensitive data like card numbers.

## Walk through a failure

Back to Alice and invoice 1002.

- ❌ **Fix that doesn't work:** "Let's check the token again inside the invoice service." The token is still valid. Alice is still Alice. She still gets the invoice.
- ✅ **Real fix:** the invoice service checks **ownership** of that specific invoice (the `tenant_id` query above, or a permission check like "can Alice read invoice 1002?").

What should Alice see? Usually a **404 Not Found**, not a 403. Why? A 403 ("forbidden") tells her "invoice 1002 exists, you just can't see it." That leaks information. A 404 reveals nothing.

## How to prove it works

1. **Cross-tenant test:** log in as company A, try to read and change company B's records. Every attempt must fail.
2. **Old-client test:** run last version's app against the new API. It must still work.
3. **Repeat test:** send the same "create order" request twice with the same idempotency key. Only **one** order must exist.
4. **Watch denials:** count how often permission checks say "no." A sudden spike may mean someone is probing your IDs.

### Check your understanding

An admin removes Bob's access to the billing page at 10:00. Bob's login token was issued at 9:55 and expires at 10:55. What happens if the services only check the token?

<details>
<summary>Show answer</summary>

Bob keeps access until **10:55**, almost an hour after it was removed. The token is just a signed note saying "this is Bob, he's a billing user" as of 9:55. Nobody re-checks it.

Ways to fix it:

- Keep tokens **short-lived** (e.g. 5 to 15 minutes) and refresh them, so removed permissions take effect quickly.
- For sensitive actions, check the **current** permission in the database instead of trusting what the token says.
- Keep a **revocation list** (a list of cancelled tokens or users) that services check.

</details>

---

## Going deeper

![API boundary: a gateway applies authentication, authorization, rate limits and routing before services enforce resource-level policy](/img/system-design-l6/api-security.svg)

## What goes in a contract

Think of the contract as the instructions printed on a vending machine. Anyone who reads it knows exactly what to put in and what comes out.

For `POST /orders`, write down:

| Part | Example |
| --- | --- |
| Request fields | `items`, `address_id`, `payment_method_id` |
| Validation | at least 1 item, quantity 1 to 99 |
| Response | order ID and status (`PENDING`, `CONFIRMED`) |
| Idempotency | header `Idempotency-Key`, kept for 24 hours |
| Error format | always `{ "code": ..., "message": ... }` |
| Pagination | for lists, use a **cursor** (a bookmark that says "continue from here") |
| Versioning | e.g. `/v1/orders`, old version supported for 12 months |

**Format:** JSON is the common choice (easy to read). **Protobuf** is a smaller, strictly typed binary format, used with **gRPC** (a fast service-to-service call system).

## Error codes a client can act on

A good API tells the client what kind of problem happened, so it knows what to do next:

| Code | Meaning | What the client should do |
| --- | --- | --- |
| `400` | Your input is wrong. | Fix it. Don't retry as is. |
| `401` | We don't know who you are (no valid login). | Log in again. |
| `403` | We know who you are, but you can't do this. | Don't retry. |
| `404` | Not found (or you're not allowed to know it exists). | Don't retry. |
| `409` | Conflict, e.g. the order changed since you read it. | Re-read, then try again. |
| `429` / `503` / timeout | Too busy, or temporary trouble. | Retry later, with a wait. |

## Sessions vs tokens

Two common ways to remember that someone logged in:

- **Session:** the server keeps a record ("session 8f3a = Alice"). The browser just holds the session ID. To log someone out, delete the record. Easy to cancel.
- **Signed token** (like a **JWT**, JSON Web Token): the server hands the client a signed note listing facts ("user = Alice, role = billing, expires 10:55"). Any service can check the signature without asking a database. Fast, but hard to cancel before it expires.

So tokens need: a short **expiry**, regular **rotation** of the signing keys, and a **revocation** plan (see the quiz above).

## OAuth, SSO and RBAC in one line each

- **OAuth:** lets you give an app limited access to your data elsewhere **without giving it your password**. (Like "Allow this app to read your calendar.")
- **SSO** (Single Sign-On): log in once with one company account, use many apps.
- **RBAC** (Role-Based Access Control): give people **roles** (e.g. "billing admin") and give roles permissions, instead of setting permissions person by person.

## The gateway is a front desk, not the only lock

The gateway is a great place for shared rules: check tokens, apply rate limits, route to the right service, use **TLS** (encryption on the wire, the "s" in https). But it doesn't know who owns invoice 1002. Only the invoice service knows that. So the **object-level check** ("may this person touch *this* object?") must live in the service that owns the data.

Think of a hotel: reception checks your ID, but your key card still only opens **your** room.

## Practical security checklist

- **Validate input** and use **parameterized queries** (the database gets the data separately from the SQL, so input like `'; DROP TABLE` can't become a command).
- **Rate-limit** by a mix of user, API key and IP address, and be stricter on expensive endpoints (like search or export).
- Keep **secrets** (passwords, API keys) in a **secret manager**, rotate them, and never log them.
- Write **audit logs** for sensitive reads and changes: who did it, what, when, and the request ID.
- Use **short-lived credentials** and give each service **least privilege** (only the access it truly needs).

## Protect the most valuable action first

You can't fix everything at once. **Threat modeling** means asking "what would an attacker most want to do, and how?" Start with the action that hurts most if abused. An attacker changing where a bank payment goes is far worse than someone setting a silly profile nickname. Lock down the first one first.

## Quick recap

- 📜 **Contract:** write down inputs, outputs, errors and versions; change by adding, not renaming.
- 🪪 **Authentication** asks "who are you?"; 🔑 **authorization** asks "may you touch *this* thing?" Check both.
- 🏨 **Gateway** is the front desk; the owning service still checks ownership of each object.
- 🔁 **Idempotency keys** make retries safe; rate limits and no-secrets-in-logs keep it safe.
- ⏳ **Tokens** keep working until they expire, so keep them short or check live permissions.
