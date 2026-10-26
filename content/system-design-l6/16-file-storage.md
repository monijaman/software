---
title: "Design a File Storage Service"
summary: "Upload bytes directly to object storage while the API owns durable metadata, authorization, sharing and synchronization."
level: Advanced
tags: [system-design, file-storage, object-storage, uploads, sync]
---

## The problem in context

A team uploads 2 GB video files from unreliable laptops and shares folders with contractors. A contractor’s access is revoked midway through a download workflow.

## What must be true

Support resumable uploads, publish only verified files, and enforce access at the metadata and object boundaries.

## Practical response

1. Create an upload session with owner, expected size, object key and expiry. Return narrowly scoped multipart upload authorization.

2. Send bytes directly to object storage. On completion verify parts/checksum and scan before marking the metadata version readable.

3. Use versioned metadata and change cursors for synchronization. Authorize download requests and choose signed-link lifetimes consistent with the revocation promise.

### Walk through a failure and recovery

An upload finishes but metadata finalization crashes. A reconciler checks the object/session and retries finalization; a lifecycle policy removes abandoned parts. Already-issued signed URLs may remain usable until expiry, so immediate revocation needs stronger enforcement.

## How to prove it worked

Test interrupted uploads, duplicate completion and revoked sharing. Measure completion success, orphan storage and revocation delay; require that quarantined files never become downloadable.

### Check your understanding

What makes an upload complete: stored bytes, verified checksum or published metadata?

---

## Concepts and implementation details

![File storage: multipart uploads go to object storage; the API owns metadata, sharing and versioned changes](/img/system-design-l6/file-storage.svg)

Create short-lived multipart upload URLs so app servers never proxy huge files. On completion validate checksums, commit metadata, and emit a versioned change event.

| Concern | Design choice |
| --- | --- |
| Unstable large upload | Multipart/resumable parts |
| Integrity | Per-part and final checksums |
| Sharing | Metadata-owned ACL/capability |
| Device sync | Versioned change feed/conflict policy |

Object-store durability still needs recovery testing.

## Upload safely, without making the API a pipe

The API should authenticate the user, create a file record in `PENDING` state, and issue a short-lived upload URL limited to one object name, size and content type. The browser uploads directly to object storage. A worker then scans the object, verifies size/type, creates derivatives, and marks it `READY`. Downloads check the file ACL and issue a short-lived read URL.

Do not trust a filename or client-provided MIME type. Keep new objects private, quarantine suspicious files, and never serve a file before scanning if users can share it.

## Important failure cases

| Event | Recovery |
| --- | --- |
| Browser drops mid-upload | Resume multipart upload or expire incomplete parts. |
| Object uploaded but DB update lost | Reconcile storage inventory with pending records. |
| Scan fails | Keep object inaccessible; notify owner with safe reason. |
| User retries upload | Idempotent file/session key returns the existing session. |

Use metadata in a database for names, owners and permissions; object storage holds bytes. Test restore of deleted/corrupted objects, not just storage-provider durability claims.
