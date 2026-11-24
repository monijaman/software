---
title: "Releases, Observability and Production Safety"
summary: "Ship changes to a few users first, watch real customer outcomes, keep old and new code compatible with the database, and always have a way to turn the change off."
level: Advanced
tags: [system-design, deployment, canary, feature-flags, observability, tls, secrets]
---

## The story in one minute

You're releasing a new version of **checkout**. It renames an order column and changes how payments are sent. You have 20 servers, and they get updated a few at a time, so for a while **old and new code run side by side**.

Here is what goes wrong, step by step:

1. The release starts with a database change that **renames** the column `amount` to `total_cents`.
2. The 15 servers still running old code look for `amount`. It's gone. They start failing.
3. The 5 new servers work, but the new payment code sometimes sends a payment **twice**.
4. The dashboard shows HTTP success at **99.9%**, because the double payment still returns "200 OK."
5. The team tries to roll back to the old code. It can't run: the old column no longer exists.

The deploy "succeeded." The customers did not. This lesson is about releasing changes so you can **spot trouble early and back out safely**.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Canary** | Send the new version to a small slice of users first. | Taste-testing a new recipe on a few customers. |
| **Feature flag** | An on/off switch for new behavior, changeable without redeploying. | A light switch for the new feature. |
| **Rollback** | Go back to the previous version. | Undo. |
| **Expand and contract** | Change the database in safe steps: add new, move over, remove old later. | Build the new bridge before closing the old one. |
| **SLO** | Service Level Objective: a target like "99.9% of checkouts succeed." | A pizza place promising delivery in 30 minutes. |

## The fix in three rules

### Rule 1: Change the database in steps both versions can live with

❌ **Wrong:** rename `amount` to `total_cents` in one go.

✅ **Right (expand and contract):**

1. **Expand:** add `total_cents` as a new column. Old code ignores it.
2. Release code that **writes both** columns and can **read either**.
3. **Backfill:** fill `total_cents` for old rows, in small batches.
4. Switch reads to `total_cents`.
5. **Contract:** in a **later** release, once no old code is left, remove `amount`.

At every step, both the previous and current app versions still work.

### Rule 2: Build once, try it on a few, watch what customers feel

- Build one **immutable artifact** (a package that never changes after it's built, e.g. a container image). The exact thing you tested is the exact thing you ship.
- Release it as a **canary** to, say, 5% of traffic.
- Only expand if **customer-level** numbers stay healthy: successful checkouts, latency, error rate, and **business rules** (one payment per order, totals add up).

### Rule 3: Always have an off switch

- Put new behavior behind a **feature flag**, so you can turn it off in seconds without a redeploy.
- Write down **what can't be undone** (data changes, emails sent, payments made) and how you'd recover from each.
- Handle **secrets** (passwords, API keys) carefully: rotate them, validate config at startup, never print their values in logs.

## Walk through a failure

The canary (5% of traffic) shows **duplicate payment attempts** rising, while HTTP success looks fine.

1. A **business metric** ("payment attempts per order") triggers the alarm, not HTTP errors.
2. **Stop** the rollout. The other 95% never get the bad code.
3. **Flip the feature flag** off. The new payment path is disabled in seconds.
4. **Find and refund** the duplicate payments (rollback doesn't undo payments already made).

This only works because the database change was compatible. If the old column had been dropped, rolling back the code would have broken everything.

## How to prove it works

1. **Practice rollback** in a test environment with old and new versions running at once.
2. **Test the migration** against both versions: old code on new schema, new code on old schema.
3. Measure **customer failures**, **time to detect**, **time to recover**, and **business rule violations**.
4. "Deployment finished" is not the goal. "Customers could still check out" is.

### Check your understanding

Can yesterday's application run against today's database schema? Why does that question matter?

<details>
<summary>Show answer</summary>

It **must** be able to, if you want a safe release. Two reasons:

1. **During the rollout**, old servers keep running against the new schema until they're replaced.
2. **If you roll back**, yesterday's code runs again against today's schema.

If today's change **removed or renamed** something yesterday's code uses, both of those break. That's why you **add** first and only **remove** in a later release, once you're sure no old code (and no need to roll back) remains.

</details>

---

## Going deeper

![Safe release: CI validates an immutable artifact, controlled rollout observes SLOs, and a rollback path limits blast radius](/img/system-design-l6/release-operations.svg)

## Release tools at a glance

| Tool | What it does | Everyday picture |
| --- | --- | --- |
| **Rolling rollout** | Replace servers a few at a time. | Changing tires one at a time. |
| **Blue-green** | Run two full copies (blue = old, green = new), then switch all traffic at once. | Moving into a new house, keeping the old one until you're sure. |
| **Canary** | A small group of users gets the new version first. | Test-tasting. |
| **Feature flag** | Turn behavior on/off without redeploying. | A light switch. |
| **Schema migration** | Change the database so old and new code both work. | Building the new bridge before closing the old one. |

## Safe release sequence

1. **Build once** and test that exact artifact.
2. **Deploy to a small cohort** (e.g. 1%, then 5%).
3. **Compare** its errors, latency and business success to the old version side by side.
4. **Expand** (25%, 50%, 100%) only while those signals stay within an agreed limit, e.g. "checkout success within 0.2% of the old version."
5. **Stop and reverse** automatically if a limit is crossed.

Feature flags are powerful but pile up. Each flag needs an **owner** and a **removal date**, or you end up with hundreds of forgotten switches.

## The database rule, once more

Expand first, contract later:

1. Add a compatible field or table.
2. Release readers that understand both forms.
3. Backfill safely in small batches.
4. Switch writers to the new form.
5. Remove the old structure only when all old code is gone.

**Never** ship an irreversible migration and an untested app change together. If something goes wrong, you can't tell which caused it, and you can't undo either.

## Observability: seeing what's happening

Three kinds of signals, tied together with a **request ID** so you can follow one request everywhere:

- **Logs:** detailed notes about individual events ("order 55 payment failed: card declined").
- **Metrics:** numbers over time ("checkout success rate: 99.7%").
- **Traces:** the path of one request through every service, with how long each step took.

**Alert on SLO burn, not noise.** An **error budget** is how much failure your SLO allows. If the SLO is 99.9% success over 30 days, you may fail 0.1% of requests. **Burn rate** is how fast you're using that allowance. Alert when you're burning it fast (e.g. at this rate, the whole month's budget is gone in 2 days), not every time one request fails.

## Production safety basics

- **TLS** encrypts traffic between machines (the "s" in https).
- **Encrypt sensitive data at rest** (on disk), so a stolen disk is useless.
- **Rotate secrets** regularly, and keep them in a secret manager.
- **Least-privilege RBAC** (role-based access control): each person and service gets only the access it needs.
- **Audit** sensitive actions: who did what, and when.

## Before, during, after

| Before release | During | After |
| --- | --- | --- |
| Name a rollback owner and the exact trigger ("if checkout success drops 0.5%, roll back") | Watch SLOs, logs and **saturation** (how full CPU, memory, connections are) | Check a real user flow end to end, and clean up old flags |

## Rollback isn't always "deploy old code"

Code can go back. Some things can't:

- **Data migrations** that changed or deleted data.
- **External side effects:** emails sent, payments charged, messages published to partners.

Each of these needs its **own recovery plan**, written before the release, e.g. "a script to find and refund duplicate charges."

## Quick recap

- 🐤 **Canary first:** a small slice of users, watched closely.
- 📊 **Watch customer outcomes** (successful checkouts, one payment per order), not just "HTTP 200."
- 🌉 **Expand, then contract:** old and new code must both work with the database.
- 🔘 **Feature flags** give an instant off switch; give each one an owner and a removal date.
- ↩️ **Plan recovery** for what rollback can't undo.
