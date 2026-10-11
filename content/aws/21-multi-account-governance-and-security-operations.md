---
title: "Multi-Account Strategy, Governance and Security Operations"
summary: "Organize accounts with Organizations and Control Tower, enforce guardrails with SCPs, and detect threats with CloudTrail, Config and GuardDuty."
level: Advanced
tags: [aws, organizations, control-tower, scp, cloudtrail, config, guardduty, security-hub]
---

## Why many accounts

An AWS account is the strongest isolation boundary: separate permissions, quotas, billing and blast radius. Mature organizations use **many accounts**, not one big one.

```mermaid
flowchart TD
    Root[Management account] --> Sec[Security OU]
    Root --> Inf[Infrastructure OU]
    Root --> Wl[Workloads OU]
    Root --> San[Sandbox OU]
    Sec --> Log[Log archive account]
    Sec --> Aud[Security tooling account]
    Inf --> Net[Network account]
    Inf --> Sh[Shared services account]
    Wl --> Dev[Dev accounts]
    Wl --> Prod[Prod accounts]
```

Typical split:

- **Management account**: billing and Organizations only; no workloads.
- **Log archive**: immutable, centralized CloudTrail and Config logs.
- **Security tooling**: GuardDuty, Security Hub and Access Analyzer administration.
- **Network**: Transit Gateway, shared egress and inspection.
- **Workload accounts**: per team, per environment (dev, staging, prod).

## AWS Organizations and SCPs

**Service Control Policies** constrain principals in member accounts, including their root users. Management-account principals and service-linked roles are exceptions. They are guardrails, not grants.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyOutsideApprovedRegions",
      "Effect": "Deny",
      "NotAction": ["iam:*", "organizations:*", "sts:*", "cloudfront:*", "route53:*", "support:*"],
      "Resource": "*",
      "Condition": { "StringNotEquals": { "aws:RequestedRegion": ["ap-south-1", "eu-west-1"] } }
    },
    {
      "Sid": "ProtectSecurityServices",
      "Effect": "Deny",
      "Action": ["cloudtrail:StopLogging", "cloudtrail:DeleteTrail", "guardduty:DeleteDetector", "config:StopConfigurationRecorder"],
      "Resource": "*"
    }
  ]
}
```

Test SCPs on a sandbox OU first. A bad SCP can lock teams out.

## Control Tower and landing zones

**AWS Control Tower** builds a landing zone: OU structure, log archive, baseline guardrails (preventive SCPs and detective Config rules), and **Account Factory** to vend new accounts consistently. Customize with **Account Factory for Terraform** or CloudFormation StackSets so every account gets the same baseline.

## Access across many accounts

- Use **IAM Identity Center** (SSO) with permission sets assigned per account and group, tied to your identity provider.
- Avoid IAM users; use short-lived SSO credentials.
- Deploy pipelines assume a **role in the target account** through OIDC or cross-account trust (see the IAM deep dive).
- Use **AWS RAM** to share resources (subnets, Transit Gateway) instead of duplicating them.

## Detective controls: know what happened

| Service | What it gives you |
| --- | --- |
| **CloudTrail** | Who called which API, when, from where. Use an **organization trail** to a locked S3 bucket with log file validation |
| **AWS Config** | Resource configuration history and compliance rules (for example "S3 buckets must not be public") with auto-remediation |
| **GuardDuty** | Threat detection from CloudTrail, VPC Flow Logs, DNS and S3, EKS and malware scanning |
| **Security Hub** | Aggregates findings and scores against standards (CIS, AWS Foundational) |
| **Macie** | Finds sensitive data in S3 |
| **Inspector** | Vulnerability scanning for EC2, ECR images and Lambda |
| **IAM Access Analyzer** | External and unused access findings |

Wire findings into **EventBridge** so critical ones trigger a Lambda, ticket or chat alert, or an automated fix:

```mermaid
flowchart LR
    G[GuardDuty finding] --> E[EventBridge rule: severity >= 7]
    E --> N[SNS / chat alert]
    E --> L[Lambda: isolate instance, disable key]
```

## Preventive controls checklist

- Block public S3 access at the **account** level.
- Enforce encryption (EBS default encryption, S3 default encryption, RDS encrypted).
- Require **IMDSv2** on EC2.
- Disable root access keys and enable MFA on the root user.
- Use **customer managed KMS keys** with key policies for sensitive data.
- Tag resources with owner, environment, and cost-center. Tag policies standardize supported tags; they do not by themselves guarantee that every resource is tagged. Add appropriate creation controls and compliance checks.

## Incident response outline

1. **Detect**: GuardDuty, alarms, anomaly in CloudTrail.
2. **Contain**: revoke sessions (attach an explicit deny with a `TokenIssueTime` condition), isolate the instance with a quarantine security group, rotate keys.
3. **Investigate**: snapshot disks, preserve logs in the log archive, query with Athena or CloudTrail Lake.
4. **Recover**: redeploy from known-good infrastructure as code.
5. **Learn**: write the blameless post-mortem and add a guardrail.

Prepare in advance with runbooks and a dedicated, pre-approved **break-glass role**.

## Worked account onboarding: a new payments team

Before creating the account, define its owner, environment, organizational unit, access groups, billing tags, Region policy, logging, and recovery contact. Apply a baseline through repeatable provisioning rather than relying on a checklist someone must remember each time.

### A useful verification matrix

| Control | Positive verification | Negative verification |
| --- | --- | --- |
| Developer access | Assigned user assumes intended role | Unassigned user cannot access it |
| Logging | Expected test API activity is captured | Workload role cannot erase archive |
| Resource access | App can reach its designated secret | App cannot read another team's secret |
| Deployment | Approved pipeline changes its stack | Unapproved workflow cannot assume deploy role |

Use a sandbox OU for guardrail tests. SCPs restrict member-account principals, including member root, but do not restrict the management account or service-linked roles. A root-level attachment is not a universal control over every identity. See [Organizations integration behavior](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_integrate_services.html).

### Investigate a suspicious credential use

Record the finding ID, account, principal, resource, time window, and observed API activity. Preserve evidence in the protected archive. Determine whether the credential belongs to a person, workload, or integration before choosing containment: removing a key or restricting a role can also interrupt legitimate traffic.

Changing trust prevents future assumptions but is not a complete strategy for sessions already issued. Follow tested session-revocation procedures and verify the relevant policy enforcement. Replacing a security group also does not justify assuming every existing connection has instantly ended.

### Exercise

Write a runbook for unauthorized S3 reads. Include triage, scoped containment, log evidence, affected data assessment, recovery, and verification. Run it using sample findings and harmless test objects. State who approves automated disruptive containment and how the service is restored afterward.

## Remember this

- Use many accounts grouped into OUs; keep the management account empty of workloads.
- SCPs constrain member-account principals, with management-account and service-linked-role exceptions.
- Centralize CloudTrail and Config in a protected log archive account.
- Automate response with EventBridge, and keep a tested incident runbook.
