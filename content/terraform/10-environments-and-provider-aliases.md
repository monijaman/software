---
title: "Environments, Workspaces, and Multiple Accounts"
summary: "Separate development and production ownership, understand workspace limits, and configure provider aliases."
level: Intermediate
tags: ["terraform", "environments", "workspaces", "aws", "aliases"]
---

## Isolation has several layers

Development and production should have deliberate separation of credentials, state, approvals, and cloud resources. A naming suffix alone does not isolate access.

```text
infra/
  modules/private-storage/
  environments/
    dev/
      main.tf
      backend.tf
      providers.tf
    prod/
      main.tf
      backend.tf
      providers.tf
```

Both roots can call the same module but use different accounts, backend keys, input values, and deployment permissions. Run Terraform in the intended environment directory; CI should specify that directory explicitly.

Keep root-level differences visible: dev may use a small database, while production enables replicas and deletion protection. Reuse the underlying module rather than copying its entire implementation.

## What a CLI workspace does

```bash
terraform workspace new dev
terraform workspace select dev
terraform workspace show
```

CLI workspaces select separate state instances for one configuration and backend. They can be useful for similar temporary environments. They do not inherently provide separate credentials, permissions, or approval policies.

For strong dev/prod isolation, use separate roots and credentials rather than relying only on CLI workspaces. Also distinguish CLI workspaces from **HCP Terraform workspaces**, which manage configuration, runs, settings, and state within the hosted service.

## Multiple provider configurations

In an AWS-configured root, add a second region using an alias:

```hcl
provider "aws" {
  region = "us-east-1"
}

provider "aws" {
  alias  = "secondary"
  region = "us-west-2"
}

resource "aws_s3_bucket" "secondary" {
  provider      = aws.secondary
  bucket_prefix = "academy-secondary-"
}
```

This selects a different region, not automatically a different account. Use an appropriately authorized `assume_role` configuration for cross-account operations. Verify caller identity and target account before every environment's first apply.

Pass aliases explicitly when a module should use one:

```hcl
# Assume ./modules/private-storage declares hashicorp/aws as a requirement.
module "secondary_storage" {
  source = "../../modules/private-storage"
  providers = {
    aws = aws.secondary
  }
  # Add the module's required inputs here.
}
```

This snippet illustrates wiring, not a complete module invocation. A child that internally uses `aws.secondary` must declare that alias through `configuration_aliases`; a child using only default `aws` can receive the selected parent configuration as shown.

## Prevent environment mix-ups

Use distinct state keys such as `shop/dev/storage.tfstate` and `shop/prod/storage.tfstate`, distinct runner roles, and environment-specific deployment approvals. Restrict production state access as well as production API permissions.

**Exercise:** design dev and prod layouts for a small shop. Identify the account, backend key, role, and approver for each. Which control stops a dev CI job from reading production state?

Further reading: [CLI workspaces](https://developer.hashicorp.com/terraform/cli/workspaces), [provider configurations](https://developer.hashicorp.com/terraform/language/providers/configuration).
