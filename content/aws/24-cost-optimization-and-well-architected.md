---
title: "Cost Optimization and the Well-Architected Framework"
summary: "Measure spend, pick the right pricing model, remove waste, and review architectures against the six Well-Architected pillars."
level: Advanced
tags: [aws, cost, finops, savings-plans, spot, well-architected, graviton, tagging]
---

## You cannot optimize what you cannot see

Set up visibility first.

| Tool | Purpose |
| --- | --- |
| **Cost Explorer** | Explore spend by service, account, tag and usage type |
| **Budgets** | Alerts and actions when spend or usage exceeds a threshold |
| **Cost and Usage Report (CUR) / Data Exports** | Line-item data in S3 for Athena queries |
| **Cost Anomaly Detection** | Machine-learning alerts for unexpected spikes |
| **Cost allocation tags** | Attribute cost to teams, products and environments |
| **Compute Optimizer** | Right-sizing recommendations for EC2, EBS, Lambda and ECS |
| **Trusted Advisor** | Checks for idle and underused resources |

Tag consistently (`team`, `env`, `service`, `cost-center`) and activate them as **cost allocation tags**. Enforce with tag policies and SCPs.

## Pricing models

| Model | Discount | Commitment | Best for |
| --- | --- | --- | --- |
| **On-demand** | None | None | Unpredictable or short-lived workloads |
| **Compute Savings Plans** | Up to roughly 66% | 1 or 3 years of $/hour | Flexible across EC2, Fargate and Lambda |
| **EC2 Instance Savings Plans** | Higher, specific family and region | 1 or 3 years | Stable fleets |
| **Reserved Instances** | Similar to Savings Plans | 1 or 3 years | RDS, ElastiCache, OpenSearch (where Savings Plans do not apply) |
| **Spot** | Up to around 90% | None, can be interrupted with a 2-minute notice | Batch, CI, stateless, fault-tolerant work |

Rule of thumb: commit to your **steady baseline** (say 60 to 70% of usage), leave the variable part on-demand, and run interruptible work on Spot. Do not commit before right-sizing.

## Where money usually leaks

1. **Idle and oversized resources**: unused EC2, unattached EBS volumes, old snapshots, idle load balancers, dev environments running overnight.
2. **NAT gateway data processing**: add S3 and DynamoDB gateway endpoints; use interface endpoints for heavy services; keep traffic within an AZ.
3. **Data transfer**: cross-AZ, cross-region and internet egress. Use CloudFront in front of origins, keep chatty services in the same AZ when safe.
4. **Storage**: S3 data left in Standard forever, old log groups, over-provisioned IOPS.
5. **Logging**: CloudWatch Logs ingestion is costly; set retention, lower log levels, and sample.
6. **Over-provisioned databases**: check Performance Insights before upsizing.

## Quick wins by service

**EC2 and containers**
- Right-size using Compute Optimizer; move to **Graviton (arm64)** for often 20% or better price-performance.
- Schedule non-production shutdowns (Instance Scheduler, EventBridge Scheduler).
- Use Spot with diversified instance types and capacity-optimized allocation.

**S3**
- Use **Lifecycle rules** and **Intelligent-Tiering** when access patterns are unknown.
- Abort incomplete multipart uploads; expire old versions.

```json
{
  "Rules": [{
    "ID": "tier-and-expire",
    "Status": "Enabled",
    "Filter": { "Prefix": "logs/" },
    "Transitions": [
      { "Days": 30, "StorageClass": "STANDARD_IA" },
      { "Days": 90, "StorageClass": "GLACIER_IR" }
    ],
    "Expiration": { "Days": 365 },
    "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
  }]
}
```

**Databases**
- Use Aurora Serverless v2 or schedule stop for dev databases; delete old manual snapshots.
- DynamoDB: pick on-demand or provisioned correctly; use **Standard-IA table class** for rarely read tables; enable TTL.

**Lambda**
- Tune memory with **AWS Lambda Power Tuning**: more memory can mean shorter duration and lower total cost.
- Use arm64 and avoid unnecessary invocations (filter events at the source).

**EBS**
- Move gp2 to **gp3** (cheaper, independent IOPS); delete unattached volumes and unused snapshots.

## Build cost into engineering culture

- Show each team its own spend (**showback**), then consider **chargeback**.
- Set budgets with alerts per account and per team.
- Estimate cost in design reviews with the AWS Pricing Calculator.
- Track **unit economics**, such as cost per order or per 1,000 requests, not only the total bill.
- Review monthly: top ten cost lines, anomalies, commitment coverage and utilization.

## The Well-Architected Framework

A structured way to review a workload against six pillars.

| Pillar | Guiding question | Examples |
| --- | --- | --- |
| **Operational excellence** | Can we run, observe and improve it? | IaC, CI/CD, runbooks, small reversible changes |
| **Security** | Is data and access protected? | Least privilege, encryption, detection, incident response |
| **Reliability** | Does it recover from failure and meet demand? | Multi-AZ, backups, limits, tested recovery |
| **Performance efficiency** | Are we using the right resources? | Right-sizing, caching, managed services, load testing |
| **Cost optimization** | Do we avoid unnecessary spend? | Right pricing model, tagging, removing waste |
| **Sustainability** | Is the environmental impact minimized? | Graviton, utilization, data lifecycle |

Use the **AWS Well-Architected Tool** to run structured reviews, record risks and track improvements. Do it at design time and again before major launches.

## Trade-offs to articulate in interviews

- **Cost versus reliability**: multi-region active-active doubles cost; justify it with RTO and RPO.
- **Managed versus self-managed**: managed services cost more per unit but save engineering time and reduce risk.
- **Serverless versus containers**: serverless wins for spiky or low traffic; steady heavy load is often cheaper on containers or instances.
- **Commitment versus flexibility**: Savings Plans save money but reduce agility.

## Remember this

- Tag, measure, and alert before optimizing.
- Right-size first, then commit to the steady baseline, and use Spot for tolerant work.
- Watch NAT, data transfer, logs and idle resources; they are the usual surprises.
- Use the six Well-Architected pillars to review designs and explain trade-offs.
