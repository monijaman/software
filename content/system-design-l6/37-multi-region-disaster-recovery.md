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

## Choose the simplest truthful posture

Active-passive means one region accepts writes. Replicate data and promote the standby during a disaster. It is easier to reason about and often the right answer for money/order workflows. Active-active means multiple regions write concurrently; it needs conflict resolution, request routing and careful ownership. Do not choose it only because it sounds more available.

| Promise | Design consequence |
| --- | --- |
| RPO = 0 for orders | Synchronous/stronger replication or refuse uncertain writes. |
| RPO = 5 minutes for analytics | Async replication/restore may be acceptable. |
| RTO = 15 minutes | Automated, rehearsed promotion and routing. |
| RTO = hours | Manual recovery may be acceptable if documented. |

## Run a drill like a product test

Fail the primary path in a safe environment, promote/recover, then create an order, read it, send a webhook, process a queue message and verify access controls. Measure real RPO/RTO. A backup that has never been restored is only a hope.
