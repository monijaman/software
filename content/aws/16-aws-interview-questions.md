---
title: "AWS Interview Questions and Scenarios"
summary: "The AWS questions that come up again and again, grouped by topic with short, correct answers you can expand: fundamentals, IAM, EC2 and EBS, networking, load balancing and scaling, S3, databases, serverless, messaging, security, cost, plus architecture scenarios with model answers."
level: Advanced
tags: [aws, interview, architecture, scenarios, cost-optimization]
---

## How to use this lesson

Read the question, **answer it out loud first**, then open the answer. For scenario questions, interviewers care about your reasoning: state the requirements, name the trade-offs, then choose.

![Answer framework: clarify requirements, sketch the architecture, cover failure, security and cost](/img/aws/interview-framework.svg)

## Fundamentals

<details>
<summary>What is the difference between a Region, an Availability Zone and an edge location?</summary>

A **Region** is a geographic area with several isolated **AZs**. Each AZ is one or more data centres with independent power and networking. **Edge locations** are smaller sites in many cities used by CloudFront and Route 53 to serve users with low latency. Run production across **at least two AZs**; go multi-Region only for strict DR or global latency needs.
</details>

<details>
<summary>Explain the shared responsibility model.</summary>

AWS is responsible for security **of** the cloud (facilities, hardware, network, hypervisor, managed service software). You are responsible for security **in** the cloud: data, IAM, network configuration, encryption choices, and on EC2 the guest OS and patches. The more managed the service (Lambda, DynamoDB), the more AWS takes on, but data and access are always yours.
</details>

<details>
<summary>What are the pillars of the Well-Architected Framework?</summary>

Operational excellence, security, reliability, performance efficiency, cost optimisation and sustainability.
</details>

## IAM

<details>
<summary>What is the difference between an IAM role and an IAM user?</summary>

A **user** has long-lived credentials (password, access keys) and represents a person or legacy app. A **role** has no permanent credentials; it's **assumed** to get temporary STS credentials. Use roles for workloads (EC2, ECS, Lambda, CI) and Identity Center for people.
</details>

<details>
<summary>How is a request evaluated when several policies apply?</summary>

Default deny → an **explicit Deny anywhere wins** → SCPs, permission boundaries and session policies must allow → an Allow in an identity or resource policy grants it. Cross-account requires both the identity policy and the resource policy to allow.
</details>

<details>
<summary>Why is <code>iam:PassRole</code> dangerous?</summary>

It lets someone attach a role to a service (ECS task, Lambda, EC2). With unrestricted PassRole a user can launch compute running as an admin role and escalate privileges. Scope it to specific role ARNs and add the `iam:PassedToService` condition.
</details>

<details>
<summary>An application on EC2 needs to read from S3. How do you give it access?</summary>

Create an IAM role with a least-privilege policy (`s3:GetObject` on `arn:aws:s3:::bucket/prefix/*`), attach it through an **instance profile**, require **IMDSv2**. The SDK picks up the temporary credentials automatically. Never put access keys on the instance.
</details>

## EC2 and EBS

<details>
<summary>What happens to data when you stop vs terminate an instance?</summary>

**Stop:** EBS volumes persist; instance store data is lost; the public IP changes (unless Elastic IP); you stop paying for compute. **Terminate:** the root EBS volume is deleted by default (`DeleteOnTermination`), other volumes persist unless configured; instance store is lost.
</details>

<details>
<summary>Compare On-Demand, Savings Plans, Reserved and Spot.</summary>

On-Demand: no commitment, highest price. Savings Plans/Reserved: 1–3 year commitment for up to ~72% off (Savings Plans are more flexible). Spot: up to ~90% off using spare capacity, reclaimable with a **2-minute warning**; use for stateless, fault-tolerant work.
</details>

<details>
<summary>Can you reduce the size of an EBS volume?</summary>

No. You can increase size and change type/IOPS online, but to shrink you must create a smaller volume and copy the data.
</details>

<details>
<summary>My instance's public IP changes after stop/start. Why, and how do I fix it?</summary>

Auto-assigned public IPs are released on stop. Use an **Elastic IP**, or better, put the instance behind a **load balancer** and use DNS so the IP doesn't matter.
</details>

<details>
<summary>EBS vs instance store vs EFS?</summary>

EBS: persistent network block storage for one instance in one AZ (boot disks, databases). Instance store: very fast local disks, lost on stop/terminate (caches, scratch). EFS: managed NFS shared by many instances across AZs.
</details>

## Networking

<details>
<summary>What makes a subnet public?</summary>

A route table entry sending `0.0.0.0/0` to an **internet gateway**. Resources also need a public IP to be reachable directly.
</details>

<details>
<summary>Security group vs network ACL?</summary>

Security groups: attached to network interfaces, **stateful**, allow rules only. NACLs: attached to subnets, **stateless** (must allow return traffic), allow and deny rules processed in number order.
</details>

<details>
<summary>How do private instances reach the internet? How do they reach S3 without the internet?</summary>

Outbound internet through a **NAT gateway** in a public subnet. S3 (and DynamoDB) through a free **gateway VPC endpoint**; most other services through **interface endpoints** (PrivateLink).
</details>

<details>
<summary>VPC peering vs Transit Gateway?</summary>

Peering connects two VPCs, isn't transitive and gets messy at scale. Transit Gateway is a regional hub connecting many VPCs and on-prem networks with transitive routing. Both require non-overlapping CIDRs.
</details>

## Load balancing and scaling

<details>
<summary>ALB vs NLB?</summary>

ALB works at layer 7 (HTTP/HTTPS/gRPC) with host/path/header routing, redirects, auth and WAF. NLB works at layer 4 (TCP/UDP/TLS) with extreme performance, static IPs per AZ and client IP preservation.
</details>

<details>
<summary>The ALB returns 502, 503 or 504. What does each suggest?</summary>

502: the target sent an invalid response or closed the connection. 503: no healthy registered targets. 504: the target didn't respond in time (slow app or blocked by a security group).
</details>

<details>
<summary>How does an Auto Scaling group keep an application healthy?</summary>

It maintains min/desired/max instances across AZs from a launch template, replaces instances that fail EC2 or **ELB health checks**, and scales with policies (target tracking on CPU or requests per target, step, scheduled, predictive).
</details>

<details>
<summary>What is connection draining (deregistration delay)?</summary>

When a target is removed, the load balancer stops sending new requests but lets in-flight ones finish for a configured time before closing connections.
</details>

## S3

<details>
<summary>How do you let users upload large files directly to S3 securely?</summary>

The backend validates the request and returns a short-lived **presigned PUT URL** (or presigned POST with size limits) for a server-chosen key. The browser uploads directly; an S3 event triggers processing. The bucket stays private with CORS allowing your origin.
</details>

<details>
<summary>How do you serve a private S3 bucket's website globally over HTTPS?</summary>

CloudFront with **Origin Access Control**; a bucket policy allowing only that distribution; ACM certificate in us-east-1; Route 53 alias record; Block Public Access stays on.
</details>

<details>
<summary>How do you protect S3 data against accidental deletion?</summary>

Versioning (+ MFA Delete), Object Lock for WORM retention, replication to another Region/account, least-privilege IAM without `s3:DeleteObject` for most roles, and AWS Backup.
</details>

<details>
<summary>Which storage class for data read once a quarter but needed instantly?</summary>

**Glacier Instant Retrieval** (or Standard-IA if accessed more often). Intelligent-Tiering if the pattern is unknown.
</details>

## Databases

<details>
<summary>Multi-AZ vs read replicas?</summary>

Multi-AZ provides **high availability** with a synchronous standby and automatic failover on the same endpoint. Read replicas provide **read scaling** with asynchronous replication and their own endpoints; they can be cross-Region and promoted manually.
</details>

<details>
<summary>When would you choose DynamoDB over RDS?</summary>

When access patterns are known and simple (key lookups, range queries within a partition), scale or traffic is very high/spiky, you want serverless with no connection management, and you don't need ad-hoc joins. Choose RDS/Aurora for relational data, complex queries and flexible reporting.
</details>

<details>
<summary>How do you avoid a hot partition in DynamoDB?</summary>

Choose a high-cardinality partition key that spreads traffic, add a random or calculated suffix (write sharding) for very hot keys, and use caching (DAX) for hot reads.
</details>

<details>
<summary>Lambda functions exhaust the database's connections. Fix?</summary>

Put **RDS Proxy** in front of the database, cap the function's **reserved concurrency**, reuse connections outside the handler, or use DynamoDB/Aurora Data API where suitable.
</details>

## Serverless and messaging

<details>
<summary>What is a Lambda cold start and how do you reduce it?</summary>

The time to create a new execution environment and run init code. Reduce with smaller packages, fewer dependencies, arm64, more memory, SnapStart (Java/Python/.NET) or provisioned concurrency.
</details>

<details>
<summary>SQS vs SNS vs EventBridge vs Kinesis?</summary>

SQS: a queue, one consumer processes each message. SNS: push pub/sub to many subscribers. EventBridge: content-based routing of events from apps, AWS and SaaS with archive/replay. Kinesis: ordered, high-throughput streams with replay by multiple consumers.
</details>

<details>
<summary>A message is processed twice. Why, and what do you do?</summary>

Standard SQS delivers **at least once**, and retries happen after visibility timeouts or failures. Make consumers **idempotent** (dedupe by message/business ID with a conditional write), set visibility timeout above processing time, or use FIFO for exactly-once processing within the dedup window.
</details>

<details>
<summary>What is a dead-letter queue?</summary>

A queue that receives messages that failed processing `maxReceiveCount` times, so they don't block or loop forever. Alarm on its depth, inspect, fix and redrive.
</details>

## Security and operations

<details>
<summary>Where should an application store its database password?</summary>

**Secrets Manager** (with rotation), read at runtime or injected at start via the task definition, encrypted with KMS and scoped with IAM. Not in code, Git, images or plaintext environment variables.
</details>

<details>
<summary>What is envelope encryption?</summary>

KMS generates a data key; data is encrypted locally with the plaintext data key; the data key is stored encrypted next to the data. Decrypting requires KMS to decrypt the data key, so access to the KMS key controls access to the data.
</details>

<details>
<summary>How would you find out who deleted a production resource?</summary>

Search **CloudTrail** (event history or a trail in S3/CloudTrail Lake) for the delete API call. It shows the principal, source IP, time and request parameters.
</details>

<details>
<summary>How do you deploy to AWS from GitHub Actions without storing keys?</summary>

Configure GitHub as an **OIDC identity provider** in IAM and a role whose trust policy allows only your repository and branch. The workflow requests `id-token: write` and assumes the role with `configure-aws-credentials`.
</details>

## Cost

<details>
<summary>Name common causes of surprise AWS bills.</summary>

Idle NAT gateways and their data processing, oversized or forgotten RDS/EC2 instances, data transfer out and cross-AZ traffic, unattached EBS volumes and old snapshots, public IPv4 addresses, CloudWatch logs without retention, and unbounded Lambda/DynamoDB usage from a bug or attack.
</details>

<details>
<summary>How would you reduce the cost of a steady ECS/EC2 workload?</summary>

Right-size using metrics, use Graviton, buy a **Compute Savings Plan** for the baseline, Spot/Fargate Spot for interruptible parts, scale down non-prod at night, VPC endpoints instead of NAT for AWS traffic, lifecycle rules on logs and S3.
</details>

## Architecture scenarios

<details>
<summary>Design a highly available web application for a startup.</summary>

Route 53 → CloudFront (static assets from private S3, WAF) → ALB in public subnets across 2–3 AZs → ECS Fargate service in private subnets with autoscaling and circuit-breaker deploys → Aurora/RDS Multi-AZ in private subnets, ElastiCache for sessions/cache → Secrets Manager for credentials → CloudWatch alarms to SNS → CI/CD with GitHub OIDC and immutable image tags. Separate dev/prod accounts; backups with PITR; IaC for everything.
</details>

<details>
<summary>An image-upload feature must create thumbnails without slowing the API.</summary>

Presigned URL upload to `uploads/`; S3 event → SQS (buffer) → Lambda (or ECS worker) generates thumbnails into `thumbnails/` (different prefix to avoid loops); DLQ with alarm; idempotent processing keyed by object key + version; CloudFront serves thumbnails.
</details>

<details>
<summary>Traffic will spike 20× during a one-hour sale. How do you prepare?</summary>

Scheduled scaling ahead of time plus target tracking; pre-warm or raise limits (Lambda concurrency, DynamoDB on-demand or pre-provisioned capacity); cache aggressively with CloudFront/ElastiCache; move non-critical work to queues; protect the database with RDS Proxy and read replicas; load test beforehand; alarms and a runbook ready.
</details>

<details>
<summary>The business needs recovery from a full Region outage within 1 hour (RTO) with at most 5 minutes of data loss (RPO).</summary>

**Warm standby** in a second Region: Aurora Global Database (≈1s replication lag) or DynamoDB global tables, S3 cross-Region replication, container images replicated in ECR, infrastructure deployable from IaC with a scaled-down copy running, Route 53 failover routing with health checks, and regularly rehearsed failover runbooks.

| DR strategy | RTO / RPO | Cost |
| --- | --- | --- |
| Backup and restore | Hours | $ |
| Pilot light | Tens of minutes | $$ |
| Warm standby | Minutes | $$$ |
| Multi-site active/active | Near zero | $$$$ |
</details>

<details>
<summary>A migration from on-premises must happen with minimal downtime. What's your approach?</summary>

Connect networks (Site-to-Site VPN or Direct Connect); replicate databases with **AWS DMS** (full load + CDC) or native replication; move files with DataSync; deploy the app to AWS in parallel; test; lower DNS TTLs; cut over with a short write freeze; keep the old environment for rollback until confidence is high.
</details>

## Key takeaways

- Most answers come back to a few principles: **multi-AZ**, **least privilege with roles**, **private by default**, **managed services**, **decoupling with queues**, **IaC and immutable deploys**, **observability**, and **cost awareness**.
- For scenarios: clarify requirements (scale, RTO/RPO, compliance), sketch the request path, then cover failure modes, security and cost.
- Know the classic pairs: Multi-AZ vs read replicas, SG vs NACL, ALB vs NLB, SQS vs SNS vs EventBridge, stop vs terminate, Savings Plans vs Spot.
