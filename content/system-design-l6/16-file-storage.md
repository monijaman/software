---
title: "Design a File Storage Service"
summary: "Let big files go straight to cheap file storage, while your own server keeps track of who owns each file, who can see it, and when it is safe to download."
level: Advanced
tags: [system-design, file-storage, object-storage, uploads, sync]
---

## The story in one minute

A video team uploads **2 GB** files from laptops on shaky café Wi-Fi. They share folders with outside contractors. Here is what goes wrong with a naive design:

1. Every upload goes **through your app server**. Ten people uploading 2 GB each ties up your servers for an hour.
2. The Wi-Fi drops at **1.8 GB**. The upload starts again from zero.
3. The upload finishes, but your database update crashes. The file is stored, yet **nobody can see it**, and you keep paying for it.
4. A contractor's access is removed. But they still have a download link from yesterday, and it **still works**.

This lesson is about uploading big files safely and controlling who can get them back.

## Words you need

| Word | Plain meaning | Everyday example |
| --- | --- | --- |
| **Object storage** | A huge, cheap store for file bytes (like Amazon S3). It knows files by a key (a name), nothing more. | A self-storage warehouse: it holds boxes, it doesn't know what's inside. |
| **Metadata** | Facts *about* the file: name, owner, size, who may see it, its state. Lives in your database. | The label and the sign-in sheet for the storage box. |
| **Multipart upload** | Sending a big file in small pieces (parts), so a failure only re-sends one piece. | Moving house in many car trips instead of one giant truck. |
| **Signed URL** | A temporary link that lets someone upload or download one file directly, without logging in, until it expires. | A guest pass that works for one room until 6 p.m. |
| **Checksum** | A short fingerprint computed from the bytes. If one byte changes, the fingerprint changes. | Counting the boxes after the move to be sure none went missing. |

## The fix in three rules

### Rule 1: Bytes go straight to storage, your API keeps the records

❌ **Wrong:** the browser sends 2 GB to your app server, which forwards it to storage. Your server becomes a slow, expensive pipe.

✅ **Right:**

1. The browser asks your API: "I want to upload `trip.mp4`, 2 GB."
2. The API checks who the user is, creates a file record in state `PENDING`, and starts an **upload session** (owner, expected size, object key, expiry time).
3. The API returns short-lived signed upload URLs, each limited to **one object name, one size and one content type**.
4. The browser uploads the parts **directly** to object storage.

### Rule 2: A file is not "done" until it is checked

Stored bytes are not enough. Before anyone can download the file:

1. Check that all parts arrived and the **checksum** matches.
2. **Scan** it for viruses and check its real size and type.
3. Only then mark the metadata as `READY`.

❌ **Wrong:** trust the filename or the type the browser says it is (`photo.jpg` might really be a program).

✅ **Right:** keep new files private, look at the real contents, and **quarantine** (lock away) anything suspicious.

### Rule 3: Check permission at every download

Who can see a file is stored in **your database** (an access list, also called an ACL). On each download request:

1. Check the access list.
2. Hand out a **short-lived** download link (for example, 5 minutes).

The link lifetime is a promise. If a link lasts 24 hours, removing someone's access can take up to 24 hours to really bite.

## Walk through a failure

The upload finishes, but the server crashes **before** it marks the file `READY`.

- The bytes are in storage. The record still says `PENDING`.
- A background job called a **reconciler** (it compares two lists and fixes differences) regularly checks old `PENDING` sessions. It sees the object exists, verifies it, and retries finishing the upload.
- Uploads that were simply abandoned leave half-sent parts behind. A **lifecycle policy** (an auto-cleanup rule in the storage service, such as "delete unfinished parts after 7 days") removes them.

And the contractor? Removing access stops **new** links. A link already handed out may keep working until it expires. If you promise "access ends instantly", you need more: very short links, or sending downloads through a check that runs on every request.

## How to prove it works

Test on purpose, then check:

1. **Interrupted uploads:** kill the Wi-Fi at 50%. The upload resumes from the last finished part.
2. **Duplicate completion:** send "I'm done" twice. You get **one** file, not two.
3. **Revoked sharing:** remove access, then measure how long until downloads fail. It should match your promise.
4. **Quarantine:** a file that failed the scan must **never** be downloadable.

Also watch: upload success rate, storage used by orphans (bytes with no `READY` record), and revocation delay.

### Check your understanding

What makes an upload "complete": the bytes being stored, the checksum matching, or the metadata being published?

<details>
<summary>Show answer</summary>

**Published metadata**, but only after the other two. Bytes landing in storage just means the data is there. The checksum proves the bytes are correct. The upload is complete when your database marks the file `READY`, which you do only after the checksum matches and the scan passes. Until then, users cannot see or download it.

</details>

---

## Going deeper

![File storage: multipart uploads go to object storage; the API owns metadata, sharing and versioned changes](/img/system-design-l6/file-storage.svg)

## Who owns what

Think of two separate jobs:

| Job | Where it lives | Holds |
| --- | --- | --- |
| Keeping the bytes | Object storage | The actual file contents |
| Keeping the facts | Your database | Name, owner, folder, permissions, version, state (`PENDING`, `READY`, `QUARANTINED`) |

Object storage is great at holding bytes cheaply and safely. It is not good at answering "which files in this folder can Priya see?" Your database is.

## Why multipart uploads help: worked numbers

A 2 GB file split into **100 MB parts** gives **20 parts**.

- Wi-Fi drops during part 19. You re-send **only part 19** (100 MB), not the whole 2 GB.
- Parts can also be sent a few at a time in parallel, so the upload is faster.
- Each part gets its own checksum, and the whole file gets a final one. That catches corruption early.

| Concern | Design choice |
| --- | --- |
| Big upload on a bad connection | Multipart, resumable parts |
| Making sure bytes aren't damaged | Per-part and final checksums |
| Sharing | Permissions stored in metadata (ACL or a share link that grants specific rights) |
| Syncing many devices | Versioned change feed plus a rule for conflicts |

## Keeping devices in sync

A user has a laptop, a phone and a tablet. How does each one know what changed?

- Every change to a file's metadata gets a new **version number**.
- Every change is also written to a **change feed** (an ordered list of "what changed").
- Each device remembers a **cursor**: "I've seen everything up to change #4,512." Next time it asks, "give me everything after #4,512."

If two devices edit the same file offline, you need a **conflict policy**, for example "keep both copies and rename one `trip (conflict).mp4`".

## Common failures and fixes

| What happened | How to recover |
| --- | --- |
| Browser drops mid-upload | Resume the multipart upload, or let unfinished parts expire. |
| File uploaded but database update lost | Reconciler compares storage with `PENDING` records and finishes or cleans up. |
| Virus scan fails | Keep the file locked away; tell the owner a safe, simple reason. |
| User clicks "upload" twice | Use the same upload key (an **idempotency key**), so the second request returns the existing session instead of starting a new one. |

## Don't just trust "eleven nines"

Storage providers promise extreme durability (often "99.999999999%"). That protects you from disks dying. It does **not** protect you from your own bug deleting files, or a user overwriting a file by mistake. Practice **restoring** deleted or damaged files (using versioning or backups) so you know it really works.

## Quick recap

- 📦 **Split the jobs:** bytes go straight to object storage; your database holds the facts and permissions.
- 🧩 **Multipart:** send big files in pieces so a drop only costs one piece.
- ✅ **Done means checked:** checksum + scan, then mark `READY`.
- 🔑 **Short links:** check permission on every download; link lifetime decides how fast revocation works.
- 🧹 **Clean up:** a reconciler fixes half-finished uploads; lifecycle rules delete abandoned parts.
