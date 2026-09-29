---
title: "Ship a Container: ECR, ECS, VPC, RDS and Secrets"
summary: A safe path from Docker image through ECS to private data and secrets.
level: Intermediate
tags: [aws, ecr, ecs, ec2, vpc, rds, secrets-manager]
---

# Ship a Container: ECR, ECS, VPC, RDS and Secrets

Build an image, push it to ECR, and run the immutable image tag in ECS. Choose ECS on Fargate when you do not want to maintain servers; ECS on EC2 when you need control of container hosts; plain EC2 when a VM or OS-level control is required. Put the public load balancer in public subnets, ECS tasks and RDS/Aurora in private subnets, and use security-group references: load balancer → task and task → database port. RDS should not normally be public. ECS needs an **execution role** to pull a private image, write startup logs and retrieve declared secrets, and a separate minimal **task role** for the application’s runtime calls. Store database URLs and API keys in Secrets Manager, never Git or an image. Example runtime permission: `{ "Effect":"Allow", "Action":"secretsmanager:GetSecretValue", "Resource":"arn:aws:secretsmanager:us-east-1:123456789012:secret:my-api/dev/database-abc123" }`. Run database migrations as a controlled release step, make backups explicit, and verify connection through the private database endpoint.
