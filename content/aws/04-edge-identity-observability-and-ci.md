---
title: "Deliver and Operate: S3, CloudFront, Cognito, APIs, Logs and CI"
summary: Delivery, authentication, observability, alerts and least-privilege CodeBuild.
level: Intermediate
tags: [aws, s3, cloudfront, cognito, api-gateway, cloudwatch, sns, codebuild]
---

# Deliver and Operate: S3, CloudFront, Cognito, APIs, Logs and CI

Keep S3 origins private and use CloudFront Origin Access Control to grant the distribution `s3:GetObject`; this is separate from a backend upload role with `s3:PutObject`. Cognito handles sign-in and tokens, while API Gateway exposes the API: configure token validation, authorization, throttling, CORS and logs deliberately. Send application logs and metrics to CloudWatch, build alarms for failed requests, latency, task restarts, database pressure and failed deployments, then connect alarms to an SNS topic and test the final notification. CodeBuild has a **service role**, not the developer’s identity. Scope it to its source connection, log group, ECR repository, artifact location and only the secrets it truly needs; never give it broad IAM or production database administration. A safe flow is commit SHA → CodeBuild tests → immutable ECR image tag → ECS update → CloudWatch health evidence → SNS alert or rollback. Avoid `latest` in production because it prevents exact incident recovery.
