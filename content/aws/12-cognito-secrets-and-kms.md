---
title: "AWS Security Building Blocks"
summary: "Add user sign-in with Cognito, keep credentials out of code, and understand the simple role of KMS encryption keys."
level: Beginner
tags: [aws, cognito, jwt, secrets-manager, kms, encryption, security]
---

## Three separate jobs

| Need | AWS service |
| --- | --- |
| User sign-up and sign-in | Cognito User Pools |
| Passwords, API tokens, connection strings | Secrets Manager or Parameter Store |
| Encryption key management | KMS |

## Cognito

A Cognito User Pool manages application users. After sign-in, the app receives tokens. Your API must verify the token signature, issuer, audience/client, and expiry before trusting the user identity.

Do not treat a JWT as trustworthy just because it looks like one; validation is required.

## Secrets

Secrets Manager is a good fit for important credentials and supports rotation workflows. Parameter Store suits simpler configuration and can also hold secure strings. Neither means you should print secrets in logs or commit them to Git.

Give the running workload role permission to read only its required secret.

## KMS

KMS manages encryption keys used by many AWS services. Usually you ask a service such as S3, RDS, or Secrets Manager to encrypt with a KMS key; you do not encrypt every byte manually in app code.

## Remember this

- Cognito authenticates users; your API validates the token.
- Secrets belong in a secret service, not code, images, or Git.
- KMS controls encryption keys and access to use them.
- Give each workload only the secret and key access it needs.
