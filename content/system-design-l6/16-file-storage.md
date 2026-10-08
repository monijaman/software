---
title: "Design a File Storage Service"
summary: "Upload bytes directly to object storage while the API owns durable metadata, authorization, sharing and synchronization."
level: Advanced
tags: [system-design, file-storage, object-storage, uploads, sync]
---

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
