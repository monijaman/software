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
