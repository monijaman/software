---
title: "IAM: Who Can Do What"
summary: "Learn AWS permissions in plain language: people sign in, roles provide temporary access, and policies allow only needed actions."
level: Beginner
tags: [aws, iam, identity-center, sts, policies, least-privilege, security]
---

## The one rule

IAM decides whether an AWS request is allowed. Every request has a **who**, an **action**, and a **resource**.

```text
Developer role  +  s3:GetObject  +  photos bucket  = allowed or denied
```

| Term | Meaning |
| --- | --- |
| **Policy** | JSON rules that allow or deny actions |
| **Role** | A named set of permissions that a person or workload temporarily assumes |
| **IAM Identity Center** | Recommended sign-in for people in an organization |
| **Least privilege** | Give only the actions and resources actually needed |

## People and apps use different access

People should sign in through Identity Center and receive temporary credentials. Apps should use a role attached to the service, such as an ECS task role or EC2 instance role. Do not put long-lived access keys in code or `.env` files.

## Read a small policy

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject"],
    "Resource": "arn:aws:s3:::my-app-uploads/*"
  }]
}
```

This allows reading objects in one bucket path. It does not allow deleting objects, creating buckets, or accessing another bucket.

An explicit `Deny` always wins over an `Allow`.

## Common mistakes

- Giving `AdministratorAccess` to solve one missing permission.
- Using the root account.
- Committing access keys.
- Giving an app permission to every S3 bucket or every database.
- Allowing `iam:PassRole` broadly. It can let someone make a service use a more powerful role.

## When you see AccessDenied

1. Copy the exact denied action and resource from the error.
2. Confirm the current identity with `aws sts get-caller-identity`.
3. Add the smallest policy statement that permits that exact work.
4. Test again; do not guess with a broad wildcard.

## Remember this

- Policies are permission rules; roles provide temporary credentials.
- Humans use Identity Center; workloads use service roles.
- Explicit Deny wins.
- Least privilege is specific action + specific resource.
