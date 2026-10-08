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

## Remember this

- Explain the service and the reason, not only its definition.
- Mention availability, security, cost, and recovery when relevant.
- Prefer a small correct architecture over a complicated list of services.
