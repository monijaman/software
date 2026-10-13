---
title: "Secrets, Ephemeral Values, and Least Privilege"
summary: "Protect credentials and state, distinguish sensitive from ephemeral values, and use provider-supported write-only inputs."
level: Advanced
tags: ["terraform", "security", "secrets", "ephemeral", "iam"]
---

## Protect the whole workflow

Secrets can appear in variable files, state, plan files, logs, outputs, and CI artifacts. Hiding a value in ordinary CLI output does not remove it from every artifact.

| Technique | What it provides | Limit |
| --- | --- | --- |
| `sensitive = true` | Redaction in ordinary display | Value may still be stored |
| Encrypted remote state | Protection of stored bytes | Authorized readers can read contents |
| Short-lived runner credentials | Reduced credential lifetime | Runner still needs narrow permissions |
| Ephemeral values | Omission from persisted Terraform state/plan | Only permitted in compatible contexts |
| Write-only resource arguments | Provider input omitted from persisted artifacts | Provider and resource must support them |

## Ephemeral input example

Terraform 1.10 introduced ephemeral input variables. In a supporting configuration:

```hcl
variable "session_token" {
  type      = string
  sensitive = true
  ephemeral = true
}
```

This value must be used in a permitted ephemeral context, such as provider configuration or a write-only resource argument. You cannot use it as the ordinary `content` of `local_file`, because that resource value is persisted.

When applying a saved plan, ephemeral values needed during apply must be supplied again. Design runner credential renewal accordingly.

## Write-only arguments

Terraform 1.11 added write-only resource arguments. The provider must implement them; adding `_wo` to an arbitrary argument name does not create support. For a resource offering a write-only password and companion version field, a password rotation typically supplies a new ephemeral password and increments the persisted version field so the provider performs the update.

Check the exact resource schema and provider release before using this pattern. Terraform cannot compare old and new write-only passwords because it does not retain them. See [write-only arguments](https://developer.hashicorp.com/terraform/language/manage-sensitive-data/write-only) and [ephemeral variables](https://developer.hashicorp.com/terraform/language/values/variables#ephemeral).

## Least privilege for people and runners

Use identity federation such as OIDC for CI instead of long-lived access keys. Scope the trust policy to the intended repository, branch or protected environment, and token audience. Give the assumed role only the API operations and resources the root module needs.

State permissions are separate from application permissions. A runner with access to production state may learn secrets even if its cloud resource permissions are limited.

Separate plan and apply identities where practical. A plan often requires read access, but some providers or data sources need additional capabilities. Verify actual behavior rather than assuming all plans are strictly read-only.

## Handle artifacts carefully

Commit the provider lock file; keep secrets out of Git. Protect plan artifacts with limited access and short retention. Suppress debug logs unless necessary; inspect them for sensitive content before sharing. `terraform output -json` and `-raw` can reveal sensitive output values.

**Exercise:** inventory every artifact in your proposed CI workflow. Who can read each artifact? What happens if an untrusted pull request modifies provider configuration or executes a malicious external data source?

**Key takeaway:** Terraform configuration is executable input to a privileged runner. Review changes to code and dependencies as part of infrastructure security.
