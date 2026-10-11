---
title: "AWS Interview Questions: Clear Answers"
summary: "Practice short, correct AWS answers by explaining the trade-off, the safe default, and one real example."
level: Beginner
tags: [aws, interview, architecture, scenarios, cost-optimization]
---

## How to answer well

For most questions: state the service, explain why it fits, name one safety concern, then give a small example. Do not throw every AWS service into one answer.

## Common questions

### What is the difference between a Region and an AZ?

A Region is a geographic AWS area. An AZ is an isolated data-centre area inside that Region. I use multiple AZs for availability, while keeping related resources in the same Region to reduce latency and transfer cost.

### How do you secure an application database?

Put it in private subnets, give it no public address, allow its port only from the application security group, use encrypted backups, store credentials in Secrets Manager, and test restoration.

### When would you choose S3?

For files: uploads, images, backups, reports, and static assets. I would not use it as a relational database or normal server filesystem. I keep the bucket private and use IAM roles or short-lived presigned URLs.

### ECS or Lambda?

Lambda is good for short event-driven work with variable traffic. ECS/Fargate is better for long-running web services or containers that need more control. The choice depends on runtime shape, not popularity.

### How do you avoid broad IAM access?

Use roles and temporary credentials. Write policies with the exact actions and ARNs needed, then test the expected workflow. I treat AccessDenied as a clue to add one narrow permission, not a reason to add admin access.

### How do you deploy safely?

Use versioned artifacts, automated tests, a reviewed IaC plan, temporary OIDC credentials, gradual rollout, rollback capability, and a check of the real public endpoint after deployment.

## Scenario: a website is slow after a sale starts

I first check user-visible symptoms: load balancer errors, latency, healthy targets, and database pressure. I compare the time with traffic and deployment changes. If the app needs more copies, I verify autoscaling limits and database capacity rather than scaling blindly. I use logs and traces for the slow request path, then confirm the fix through the public route.

## Answer by walking through one request

A useful explanation starts with the user's action and follows the components it touches. For example: “The customer submits an order over HTTPS. The ALB forwards to a healthy private app. The app saves the order in RDS, then a reliable messaging path triggers confirmation work.”

For each component, explain its responsibility, its permissions, what happens when it fails, and how you know it is healthy. This demonstrates understanding more clearly than listing service names.

## More beginner questions with worked answers

### Does a public subnet make every instance public?

No. It has a route to an internet gateway, but direct IPv4 internet communication also depends on a public address and allowing network rules. A private subnet normally has no direct internet-gateway route. A NAT route can permit outbound IPv4 access for private workloads without making them directly reachable by unsolicited internet requests.

**Example:** the shop's ALB is public, while app tasks have private addresses. The task security group allows only the ALB's app-port traffic.

### Why is listing an S3 bucket different from reading an object?

Listing uses `s3:ListBucket` on the bucket ARN; reading uses `s3:GetObject` on an object ARN. An app can be allowed to read a known object without being allowed to list every object name.

**Example:** a receipt viewer reads `receipts/1001.pdf`; it does not need permission to discover other customers' receipt keys.

### Why not put an AWS access key inside a Docker image?

Anyone who can obtain the image may extract the credential, and rotation requires changing deployed artifacts. Use a task role so the SDK obtains temporary credentials at runtime. Give that role only the application's required actions and resources.

**Example:** ECR image pulling uses the execution role, while the running API's S3 upload uses the task role.

### Is Multi-AZ a backup or a read replica?

It is an availability strategy. The traditional RDS Multi-AZ DB instance standby does not serve application reads. A read replica serves read workloads, with replication behavior and possible lag. Backups let you restore data from an earlier point; a standby can also receive an accidental deletion.

**Example:** failing over does not undo a developer deleting all order records. You need a tested recovery process.

### Does receiving an SQS message remove it?

No. Receiving hides it for the visibility timeout. Delete it using the current receipt handle after successful processing. If the worker fails first, it can become visible again, so side effects must tolerate retries.

**Example:** generate the receipt at a deterministic object key, record job completion safely, then acknowledge the message.

### Does serverless mean no operational work?

No. AWS operates the server fleet, but you manage code, permissions, timeouts, concurrency, monitoring, and cost. Event retry behavior depends on the caller; API Gateway does not automatically retry Lambda invocations.

**Example:** a customer retrying checkout can still create duplicate orders unless you implement durable idempotency.

### Does encryption mean an S3 bucket is private?

No. Encryption protects stored data, while access policies determine who may read it through authorized APIs. Configure both. A publicly readable encrypted object is still publicly readable if access controls permit it.

**Example:** keep Block Public Access enabled and grant a specific CloudFront distribution access through OAC.

### Is a cost budget a hard cap?

No. It provides notifications, and reporting can be delayed. Optional budget actions have specific behaviors; they are not a universal instantaneous stop for every service charge.

**Example:** a NAT gateway or database can continue costing money after an alert arrives until you deliberately change or delete the resource.

## Scenario: design a tiny static website

**Requirements:** public book descriptions and cover images, HTTPS, no customer login, and no database updates.

Use S3 for files and CloudFront for HTTPS delivery/caching. Keep the bucket private with OAC. Use the distribution hostname for a learning lab, or add a controlled custom domain and suitable ACM certificate.

You do not need EC2, RDS, and Kubernetes just to serve static files. Verify both that the website loads through CloudFront and that the unsigned S3 object is not public. Choose cache lifetimes and a deployment approach for changed files.

## Scenario: add private customer orders

Now the shop requires login and transactional order storage. Add user authentication, an authorized API, and a database suited to its queries. Keep the database private, scope the API's IAM role, and enforce customer ownership inside application authorization.

Add monitoring before a sale, and design duplicate-safe writes before adding automatic retries. If email is asynchronous, provide a reliable publication path and a retry-safe worker. These are real requirements rather than reasons to add every AWS messaging service.

## Scenario: checkout fails after deployment

1. Confirm impact and the deployment time.
2. Inspect ALB target health or Lambda/API errors.
3. Find an affected request in logs and identify the failing dependency.
4. Compare the new artifact, settings, permissions, and migrations.
5. Use the approved rollback or mitigation, then verify customer-visible behavior.

Low CPU does not rule out database timeouts. A “deployment succeeded” message does not prove that requests work.

## A completion exercise

Draw your shop architecture and label each connection with its protocol, permission, and failure behavior. Then answer: where are files stored, where are transactions enforced, where do retries occur, who can decrypt secrets, and which resources keep costing money while idle?

A clear answer to these questions is a strong beginner foundation for the deeper AWS lessons that follow.

Review references: [RDS availability](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZSingleStandby.html), [SQS processing](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html), [AWS budget behavior](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html).

## Practice answering as the responsible developer

### Design a reliable order endpoint

**Strong answer:** authenticate the caller, validate the request, verify ownership and stock, commit durable order state, and publish background work through a reliable pattern. Add idempotency for client retries. Explain the data store and transaction choice before naming compute services.

**Follow-up:** The client times out after the order commits. Return the prior outcome when the same idempotency key is retried instead of creating another order.

### Diagnose an ECS task that cannot access S3

**Strong answer:** distinguish execution role from task role, verify the request's object ARN and action, inspect bucket and KMS policies if relevant, and check the network path. Do not assume pulling an ECR image proves application S3 access.

### Explain availability versus recovery

**Strong answer:** multiple app copies and database failover reduce some outages, but corruption or deletion may propagate. Define RTO and RPO, protect backups, and demonstrate a restore. Name the consistency and cutover behavior during recovery.

### Review a surprising bill

**Strong answer:** compare service, Region, usage type, tags, and time period. Check running resources, data transfer, NAT processing, logs, and storage versions. Separate a usage increase from a rate or architecture change. Avoid purchasing a commitment before understanding the steady baseline.

**Practice format:** Give a two-minute answer, draw the request path, identify one failure case, and describe the evidence you would collect. A list of service names without correctness or operational reasoning is incomplete.

## Remember this

- Explain the service and the reason, not only its definition.
- Mention availability, security, cost, and recovery when relevant.
- Prefer a small correct architecture over a complicated list of services.
