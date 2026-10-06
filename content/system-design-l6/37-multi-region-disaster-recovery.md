---
title: "Multi-Region and Disaster Recovery"
summary: "Decide what must survive a regional failure, how much data can be lost, and how recovery is actually proven."
level: Advanced
tags: [system-design, multi-region, disaster-recovery, rpo, rto, failover]
---

## Two promises before architecture

- **RPO (Recovery Point Objective):** maximum acceptable data loss. RPO of five minutes means up to five minutes of accepted writes may be lost in a disaster.
- **RTO (Recovery Time Objective):** maximum acceptable time until recovery. RTO of 30 minutes means users should be working again within 30 minutes.

## Example: food order system

Orders must not disappear, but the restaurant discovery feed can temporarily show stale results.

| Data/path | Choice during a region failure |
| --- | --- |
| Payment and final order state | Stronger replication or controlled failover; reconcile uncertain payments. |
| Restaurant menus | Serve regional cache; refresh later. |
| Search/recommendations | Degrade or use stale replica. |
| Images | Multi-region object storage/CDN replication. |

**Active-passive** keeps one write region and fails over when needed; it is easier to reason about. **Active-active** accepts writes in multiple regions; it lowers locality and improves resilience, but needs conflict rules, routing and much more operational discipline.

## A backup is unproven until restored

Keep encrypted backups, document who can trigger failover, practice restoration, and verify the full external path after a drill. A green database replica alone does not prove DNS, credentials, queues, webhooks and clients will recover correctly.
