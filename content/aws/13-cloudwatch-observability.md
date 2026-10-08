---
title: "CloudWatch: Know What Your App Is Doing"
summary: "Use logs, metrics, alarms, and audit records to discover a problem before users have to report it."
level: Beginner
tags: [aws, cloudwatch, observability, logs, metrics, alarms, x-ray, cloudtrail]
---

## The three things to watch

| Signal | Question it answers |
| --- | --- |
| **Logs** | What happened inside this request or process? |
| **Metrics** | How much, how often, or how slow? |
| **Traces** | Where did one request spend time across services? |

CloudWatch stores logs and metrics. X-Ray/OpenTelemetry traces a request across components. CloudTrail records AWS account actions, such as who changed a security group.

## Start with useful application logs

Write structured logs to stdout from containers or Lambda. Include a request ID, level, operation, and safe error details. Never log passwords, access tokens, or full customer secrets.

## Alarms should point to user impact

Good first alarms include:

- HTTP 5xx errors or failed Lambda invocations
- no healthy load balancer targets
- queue age growing too high
- database storage nearly full
- unexpected cost/budget threshold

An alarm needs a clear owner and action. “CPU is 80%” alone may not mean users are affected.

## A practical incident path

1. Alarm says what changed and where.
2. Check dashboard metrics for time and scope.
3. Search logs using the request ID or error.
4. Check deployment changes and CloudTrail.
5. Fix, verify the public path, then write down the cause.

## Remember this

- Logs explain individual events; metrics reveal trends; traces follow requests.
- Alarm on symptoms users feel, not only machine activity.
- CloudTrail is for AWS account audit, not application logs.
