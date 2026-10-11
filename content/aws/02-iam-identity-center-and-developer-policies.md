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
3. Inspect relevant identity and resource policies, boundaries, and organization restrictions; add a narrow allow only if it fits the intended access policy.
4. Test again; do not guess with a broad wildcard.

## IAM through a building analogy

Think of your AWS account as an office building. Authentication checks a person's badge. Authorization decides which rooms they may enter and what they may do inside. A valid badge does not grant access to every room.

For the book shop, a developer may read logs, the order API may upload receipts, and the email worker may read a queue. These are different jobs and should have different permissions.

A **principal** is the person, role session, or service making a request. An **ARN** is a resource identifier. For example, `arn:aws:s3:::academy-shop-uploads/receipts/123.pdf` identifies one S3 object.

## Two policies answer different questions

A role's **trust policy** answers who may assume the role. Its **permissions policy** answers what the assumed role may do.

An EC2 application role might trust the EC2 service. That does not automatically give it access to S3. You also attach a policy allowing the needed S3 operations. A human role instead has a trust relationship with an approved identity system or role.

Do not confuse an application customer's Cognito login with an employee's AWS administrative login. Customers need permission to use your application; they usually do not need permission to manage AWS resources.

## Worked policy: list and read only receipt files

Replace the sample bucket with a bucket you own. Attach this policy through your authorized role-management process; do not assume your learner identity can edit IAM.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListReceiptPrefix",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::academy-shop-uploads",
      "Condition": {
        "StringLike": { "s3:prefix": ["receipts/", "receipts/*"] }
      }
    },
    {
      "Sid": "ReadReceiptObjects",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::academy-shop-uploads/receipts/*"
    }
  ]
}
```

Read each statement aloud:

- `Effect` says this is an allow.
- `Action` names the API operation.
- `Resource` scopes the operation to the bucket or object prefix.
- `Condition` restricts which listing prefix is permitted.

`ListBucket` uses the **bucket ARN**, while `GetObject` uses an **object ARN**. Adding `/*` to every resource is not a universal solution.

This policy alone permits listing receipt keys and reading receipts. It does not permit uploading or deleting objects. Other policies attached to the principal can broaden effective access; evaluate the full identity rather than one policy in isolation.

## Verify with simple commands

Using the intended role session:

```bash
aws sts get-caller-identity --profile academy
aws s3api list-objects-v2 \
  --bucket academy-shop-uploads --prefix receipts/ --profile academy
aws s3api get-object \
  --bucket academy-shop-uploads --key receipts/example.txt \
  --profile academy downloaded-receipt.txt
```

**Expected result:** with an existing object and appropriate overall permissions, listing and reading succeed. Attempts to write should be denied if no other policy grants them. Test prohibited operations only against disposable lab data.

An encrypted object using a customer-managed KMS key can additionally require decrypt permission and an appropriate key policy. S3 permission alone may not be enough.

## Diagnose denial without granting admin

For ordinary permission failures, check the identity, action, ARN, and conditions. Then check whether a resource policy, permissions boundary, session policy, or organization policy further restricts access. An explicit deny overrides an allow; an absent required allow also denies access.

If your organization applies a deny, adding another identity allow does not override it. Bring the specific request and error to the owner of the restriction.

**Practice:** modify the example to allow uploading only `receipts/*` while still denying deletion through absence of a delete allow. Which new action is required? **Answer:** `s3:PutObject` on the receipt object ARN, plus any encryption permissions required by the bucket's configuration.

Further reading: [IAM evaluation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html), [IAM roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html).

## Worked access review: an invoice-export worker

The worker reads database rows and writes objects under `exports/` in one bucket. It does not administer IAM, delete customer uploads, or read another environment's secrets. List each API action it actually uses before constructing its policy.

| Operation | Typical permission | Resource to scope |
| --- | --- | --- |
| Write an export | `s3:PutObject` | Objects under the export prefix |
| Read a database secret | `secretsmanager:GetSecretValue` | The intended secret ARN |
| Use a customer-managed encryption key | Appropriate KMS operations | The intended key ARN and policy |

A workload role is not permission to act as every customer. The application still checks tenant ownership before producing an export. IAM restricts AWS access; application authorization restricts business access.

### Deliberate denied-path exercise

Using a dedicated learning role, verify that one permitted sample object can be read, then attempt to read a sample outside its prefix. The expected result is a successful allowed request and `AccessDenied` for the other request. Do not expand permissions until both expectations are understood.

Keep the request's action, resource ARN, account, role, and relevant conditions in your notes. An S3 bucket ARN covers bucket operations, while an object ARN covers object operations. A permission on one does not automatically cover the other.

**Explain:** Why does attaching S3 permissions to your personal login not fix an ECS task? They are different principals; inspect the workload's task role.

## Remember this

- Policies are permission rules; roles provide temporary credentials.
- Humans use Identity Center; workloads use service roles.
- Explicit Deny wins.
- Least privilege is specific action + specific resource.
