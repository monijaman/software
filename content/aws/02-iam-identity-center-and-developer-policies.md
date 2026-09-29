---
title: "IAM Identity Center, IAM and Developer Permissions"
summary: Permission sets, workload roles, inline policies and least-privilege rules.
level: Beginner
tags: [aws, iam, permissions, policies, least-privilege]
---

# IAM Identity Center and Developer Policies

Humans receive temporary account access from an IAM Identity Center **permission set**. ECS tasks, EC2 instances and CodeBuild use separate runtime **roles**; a developer’s console permission never automatically grants workload access. Prefer reusable customer-managed policies for teams. An inline policy is a one-to-one exception directly attached to one identity or role and is deleted with it; use it only when its scope, owner and review date are clear. Least privilege restricts **Action**, **Resource** and **Condition**, and an explicit `Deny` wins. Example: `{ "Version": "2012-10-17", "Statement": [{ "Effect": "Allow", "Action": "s3:ListBucket", "Resource": "arn:aws:s3:::my-project-dev-assets" }, { "Effect": "Allow", "Action": "s3:GetObject", "Resource": "arn:aws:s3:::my-project-dev-assets/*" }] }`. The bucket ARN is different from its object ARN. For a developer who deploys one ECS service, allow `ecs:UpdateService` only on that service ARN; list/describe/token actions sometimes require `"Resource":"*"` because AWS does not support resource scoping for them. Treat `iam:PassRole` as high risk: allow only named task roles and require `"Condition":{"StringEquals":{"iam:PassedToService":"ecs-tasks.amazonaws.com"}}`. Never grant `iam:*`, unrestricted `iam:PassRole`, or administrator access merely to unblock a deployment. Validate policies with IAM Access Analyzer and test using the intended role in a development account.
