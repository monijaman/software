---
title: "Multi-Region and Disaster Recovery"
summary: "Decide what must survive losing a whole region, how much data you can afford to lose, and how to prove you can really recover."
level: Advanced
tags: [system-design, multi-region, disaster-recovery, rpo, rto, failover]
---

## The story in one minute

Your order system runs in **Region A** (say, a data center in Virginia). A copy runs in **Region B** (Oregon) as a backup. Data is copied from A to B, but the copy is about **20 seconds behind**.

Then Region A goes completely dark. Here is what goes wrong:

1. The orders placed in A's **last 20 seconds** never made it to B. They're gone, even though customers saw "Order confirmed".
2. Customers whose purchase was still spinning hit **Retry**.
3. You switch traffic to B. B doesn't know about those last orders, so the retries create **new** orders and maybe **new charges**.
4. An hour later, A comes back online and **also** starts accepting orders. Now two regions both think they're in charge, and the data splits in two.

This lesson is about planning for that day **before** it happens.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Region** | A group of data centers in one geographic area. | One city's branch of a bank. |
| **RPO** (Recovery Point Objective) | The most data you're allowed to lose, measured in time. | "I can lose at most 5 minutes of typing" (how often your editor autosaves). |
| **RTO** (Recovery Time Objective) | The longest you're allowed to be down. | "The shop must reopen within 30 minutes of a power cut." |
| **Failover** | Switching the work from the broken region to the backup. | Moving a wedding inside when it rains. |
| **Fencing** | Making sure the old leader **can't** write anymore. | Taking the old manager's keys before giving them to the new one. |

## The fix in three rules

### Rule 1: Set RPO and RTO per kind of data

Not all data is equally precious.

- **Confirmed orders and payments:** almost no loss allowed (RPO near zero). Needs stronger copying.
- **Analytics, browse caches:** losing a few minutes is fine.

❌ **Wrong:** one RPO for everything. Either you overpay to protect the cache, or you under-protect the orders.

### Rule 2: Fence the old leader, then promote the new one

Before Region B starts accepting writes, make sure Region A **cannot** write, even if it wakes up. Only one region may be the *authority* (the one whose writes count) at a time.

Then send traffic to B only after checking B is really ready: data is there, and services are up.

### Rule 3: Backups and extra regions solve different problems

- A **second region** helps when a whole region goes down.
- A **backup** helps when data is **destroyed or corrupted** (a bad script deletes a table, and the deletion is happily copied to every region).

You need both, and you need to **practice** restoring, reconciling and *failing back* (moving home to A again).

## Walk through a failure

Region B is now in charge. Region A comes back online.

- ❌ A resumes taking orders automatically. Now two regions write to the same orders, and records disagree.
- ✅ A stays **fenced**. It doesn't take writes until a person decides.

Then, before failing back:

1. Compare A's lost 20 seconds of orders with B's records.
2. Check payments whose result was unknown with the **payment provider** (did the charge go through or not?).
3. Fix records that disagree (for example, two orders for one cart).
4. Only then move traffic back to A, in a controlled way.

## How to prove it works

Run real drills:

1. **Region-loss drill:** turn off the main region in a safe environment and fail over.
2. **Backup-restore drill:** restore a backup into a fresh database.
3. Measure the **real** data lost (actual RPO) and the **real** time until customers could order again (actual RTO).
4. Count **duplicate orders or charges** caused by retries. It should be zero.

⚠️ A standby region that has never been tested is **not** proof you can meet your RPO and RTO.

### Check your understanding

Your standby gets data by **asynchronous** copying and is 20 seconds behind. Can it meet an RPO of **zero**?

<details>
<summary>Show answer</summary>

**No.** *Asynchronous* means the main region tells the customer "confirmed" **before** the standby has a copy. If the main region dies, up to 20 seconds of confirmed orders are lost. That's an RPO of about 20 seconds, not zero.

For RPO zero, a write must be safely stored in the second region **before** the customer sees "confirmed" (*synchronous* replication). That adds the cross-region trip to every write, so writes get slower. The other choice is to refuse writes when you can't be sure they're safely copied.

</details>

---

## Going deeper

## Two promises before any architecture

- **RPO:** how much data you can lose. An RPO of **5 minutes** means up to 5 minutes of confirmed writes may be lost in a disaster.
- **RTO:** how long you can be down. An RTO of **30 minutes** means users should be working again within 30 minutes.

Agree on these numbers with the business first. They decide the design.

## Example: a food delivery app

Orders must never disappear. But the "restaurants near you" feed can show slightly old results for a while.

| Data or feature | What to do when a region fails |
| --- | --- |
| Payment and final order state | Stronger replication or a controlled failover; reconcile payments with unknown results. |
| Restaurant menus | Serve from the cache in the region; refresh later. |
| Search and recommendations | Turn off, or use a slightly stale copy. |
| Images | Copy across regions with object storage and a CDN (a network of servers that cache files near users). |

## Active-passive vs active-active

| | Active-passive | Active-active |
| --- | --- | --- |
| Who accepts writes? | **One** region. The other waits. | **Several** regions at once. |
| During a disaster | Promote the standby. | Other regions keep going. |
| Hard part | Fast, safe promotion | Two regions can change the same record: you need **conflict rules**, smart routing and strong team discipline. |
| Good for | Money and order workflows (easy to reason about) | Very large global apps that need low latency everywhere |

Active-active also means users can write to a region close to them, which is faster. But ❌ don't pick it just because it *sounds* more available. The conflict handling is real, ongoing work.

## What each promise forces you to build

| Promise | What it means for the design |
| --- | --- |
| RPO = 0 for orders | Synchronous or stronger replication, or refuse writes you can't be sure are copied. |
| RPO = 5 minutes for analytics | Async replication or restoring from backup may be fine. |
| RTO = 15 minutes | Automated, well-practiced promotion and traffic switching. |
| RTO = hours | Manual recovery may be fine, if it's written down. |

## A backup is unproven until restored

Keep **encrypted** backups. Write down **who** is allowed to trigger failover. Practice restoring.

A green "replica healthy" light is not enough. After a drill, check the whole path still works: DNS (the internet's address book), passwords and keys, queues, webhooks from partners, and the apps on customers' phones.

## Run a drill like a product test

1. Fail the main region in a safe environment.
2. Promote the standby, or restore from backup.
3. Then act like a real customer: **create an order, read it back, receive a webhook, process a queue message, and check access controls** (the right people can see the right data).
4. Measure the **real** RPO and RTO you achieved.

A backup that has never been restored is only a hope.

## Quick recap

- ⏱️ **RPO** = how much data you can lose. **RTO** = how long you can be down. Set them per kind of data.
- 🚧 **Fence the old leader** before promoting a new one, so only one region writes.
- 🔁 **Async copies can't give RPO zero**; they lose whatever hadn't been copied yet.
- 💾 **Regions and backups protect against different disasters.** You need both.
- 🧪 **Drill it.** Untested recovery is only a hope.
