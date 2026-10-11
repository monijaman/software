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

## Follow one failed order

A customer reports that order submission failed at 10:05. You need to know whether it affected one customer or everyone, whether the API or database failed, and whether the order was accepted despite the error.

Metrics show the size and timing of the problem. Logs explain individual requests. Traces connect the work across services. These signals complement each other.

## Write a useful structured log

Instead of `Something broke`, emit safe context:

```json
{
  "level": "ERROR",
  "request_id": "req-123",
  "operation": "create_order",
  "status_code": 503,
  "duration_ms": 1200,
  "error_code": "DATABASE_TIMEOUT"
}
```

The exact identifiers are examples. Log a stable request/correlation ID across the API and worker so you can follow the same business operation. Do not include raw access tokens, passwords, payment-card details, or complete customer payloads.

In Lambda, application output is sent to configured logging destinations when its role and settings allow it. In ECS, configure a log driver such as `awslogs`; writing stdout alone does not configure CloudWatch delivery. On EC2, configure a suitable agent or collector if you want local application logs shipped.

## Try a Logs Insights query

Choose the relevant log group and a narrow incident time window in CloudWatch Logs Insights. For structured JSON logs with discoverable fields:

```text
fields @timestamp, request_id, operation, status_code, error_code
| filter request_id = "req-123"
| sort @timestamp asc
| limit 50
```

**Expected result:** log events for that request appear in time order. If the fields are not discovered from your log format, use parsing or inspect `@message`; the query assumes standalone structured JSON events.

To count failures by operation:

```text
fields operation, status_code
| filter status_code >= 500
| stats count() as failures by operation
| sort failures desc
```

A query is not an alarm automatically. Create a metric or supported alerting mechanism for ongoing detection. Logs Insights queries can incur scan costs, so avoid querying every log group over an unnecessarily broad time range.

## Turn a metric into an actionable alarm

Suppose a five-minute window contains 100 requests and ten server failures. That is a 10% server-error rate. An alarm based on error rate can be more informative than a raw count when traffic changes.

Specify the metric, aggregation, period, threshold, evaluation windows, missing-data behavior, notification target, and owner. A possible learning alarm is “server-error rate above 5% for two five-minute periods,” but choose production thresholds based on service objectives and real traffic.

For very low traffic, percentage alarms can be noisy: one failure in one request is 100%. Combine traffic context or use a different low-volume rule. Avoid treating missing metrics as proof that the service is healthy.

## A small dashboard for the shop

| Signal | Why it helps |
| --- | --- |
| Request count | Distinguish load changes from code changes |
| 5xx errors and latency percentiles | Show user-visible failures and slow responses |
| Healthy targets or Lambda errors/throttles | Identify compute/integration problems |
| SQS oldest-message age | Show whether work is falling behind |
| Database connections, latency, storage | Reveal bottlenecks downstream |

Percentiles matter: an average latency of 100 ms can hide a subset of users waiting several seconds. Select an appropriate percentile such as p95 and inspect request distribution.

## A runbook an on-call person can use

```text
Alarm: Order API error rate increased
Owner: Shop application team
1. Confirm account, Region, service, and time window.
2. Compare traffic, deployments, and database health.
3. Search affected request IDs and trace slow/error paths.
4. Use the approved mitigation: rollback or restore capacity.
5. Verify a real order path and watch recovery metrics.
6. Record cause and follow-up action.
```

CloudTrail answers who changed AWS resources. It does not replace application logs, and not every data access is captured by default; required data-event auditing must be configured deliberately.

**Practice:** CPU stays low while checkout latency rises. Why might more app servers not help? The API may be waiting on a database or external service rather than running out of CPU.

**Cleanup:** set finite retention for learning log groups and remove unused dashboards/alarms. Keep audit records according to the organization's policy.

Further reading: [Logs Insights fields](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_AnalyzeLogData-discoverable-fields.html), [CloudWatch alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html).

## Worked incident: checkout latency increases

Suppose users report that checkout takes eight seconds. Begin with the time window and affected requests. Check request count, error rate, and latency percentiles; an average can hide a slow minority.

Correlate application request IDs with dependency timings. If database duration increased while app CPU remained low, investigate slow queries, locks, pool saturation, and database capacity before adding app replicas. More replicas can create more competing connections.

### Turn findings into a runbook

| Signal | Question | Immediate evidence |
| --- | --- | --- |
| High target response time | Where is time spent? | Request traces and dependency duration |
| Queue age increasing | Are workers making progress? | Consumer errors and dependency status |
| Connection pool full | Are connections leaked or slow? | Pool wait time and active queries |
| Error spike after release | What changed? | Version marker and deployment timeline |

Define an alarm's owner, severity, threshold rationale, evaluation window, and first action. Missing data should have an intentional treatment; a missing metric can mean no traffic or broken telemetry.

**Exercise:** Write a five-step runbook for a failed checkout release. Include how to identify the affected version, check ongoing transactions, roll back safely, verify recovery, and preserve evidence. Avoid recording payment details or authentication tokens in logs.

## Remember this

- Logs explain individual events; metrics reveal trends; traces follow requests.
- Alarm on symptoms users feel, not only machine activity.
- CloudTrail is for AWS account audit, not application logs.
