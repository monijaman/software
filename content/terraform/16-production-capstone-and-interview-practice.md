---
title: "Production Capstone and Interview Practice"
summary: "Combine modules, isolated environments, remote state, tests, and reviewed delivery in a production-style storage project."
level: Advanced
tags: ["terraform", "capstone", "production", "interview", "project"]
---

## Build a private storage platform

Your task is to provision private application storage for a shop with separate dev and prod environments. Use the AWS bucket resources from lesson 5 and the module principles from lesson 8. This project integrates existing examples; it introduces no requirement for paid compute or a live database.

```text
infra/
  bootstrap/                    # Separate state-backend lifecycle
  modules/
    private-storage/
      main.tf
      variables.tf
      outputs.tf
      README.md
  environments/
    dev/
      versions.tf
      providers.tf
      backend.tf
      main.tf
      outputs.tf
      tests/storage.tftest.hcl
    prod/
      versions.tf
      providers.tf
      backend.tf
      main.tf
      outputs.tf
      tests/storage.tftest.hcl
```

## Step 1: define the module contract

The module takes `name_prefix`, `environment`, and `owner`. It creates a private, encrypted, versioned bucket with owner tags. It publishes `bucket_id` and `bucket_arn`.

Move lesson 5's resources into `modules/private-storage/main.tf`. Keep the module's provider requirement; configure region and credentials in each root. Replace `bucket_prefix` with `var.name_prefix`. Define typed variables and use the environment and owner in tags.

```hcl
# modules/private-storage/variables.tf
variable "name_prefix" {
  type = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,29}$", var.name_prefix))
    error_message = "Prefix must be 3–30 lowercase letters, digits, or hyphens."
  }
}
variable "environment" {
  type = string
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be dev or prod."
  }
}
variable "owner" {
  type = string
  validation {
    condition     = length(trimspace(var.owner)) > 0
    error_message = "An owner is required."
  }
}
```

```hcl
# modules/private-storage/outputs.tf
output "bucket_id" {
  value = aws_s3_bucket.assets.id
}
output "bucket_arn" {
  value = aws_s3_bucket.assets.arn
}
```

Document public-access protection, encryption, versioning, and deletion behavior. A production variant may need KMS and bucket policies that require TLS; add those as explicit, reviewed requirements rather than assuming this exercise covers every compliance need.

## Step 2: call it from dev

In `environments/dev/main.tf`:

```hcl
module "storage" {
  source      = "../../modules/private-storage"
  name_prefix = "academy-shop-dev-"
  environment = "dev"
  owner       = "platform"
}
```

Create root version/provider settings from lesson 5 and an S3 backend from lesson 9 using an existing bootstrap bucket. Add root outputs forwarding `module.storage.bucket_id` and `module.storage.bucket_arn`.

The trailing hyphen in the shown prefix is allowed by the validation. The provider appends a uniqueness suffix. Prod uses a different account or role and a different state key.

## Step 3: test meaningful requirements

In the dev root's `tests/storage.tftest.hcl`, add a plan assertion on a known configured tag:

```hcl
run "required_owner" {
  command = plan
  assert {
    condition     = module.storage.owner == "platform"
    error_message = "The module must publish the expected owner."
  }
}
```

For this example, add an `owner` output to the child module:

```hcl
output "owner" {
  value = aws_s3_bucket.assets.tags["Owner"]
}
```

Ensure the resource tags include `Owner = var.owner`. Add assertions for actual public-access, encryption, and versioning settings by exposing an appropriate policy-status output derived from their configured attributes. Use an isolated apply test or AWS inspection to verify the real API results; the plan-only assertion cannot prove remote enforcement.

## Step 4: deliver and inspect

Run fmt, validate, tests, and a saved plan. Require a reviewed lock file and serialized applies. After apply, inspect bucket settings, record the resource addresses, and run another full plan expecting no changes. Add scheduled drift detection with explicit handling of exit code 2.

## Step 5: rehearse recovery and cleanup

Change a noncritical dev tag through the console. Inspect the resulting plan. Decide whether to restore it or adopt it in code. Practice a resource rename using a moved block and confirm there is no replacement.

Destroy only dev application resources when finished, after confirming the plan and clearing any object versions you uploaded. Keep backend lifecycle and production destruction controls separate from routine lab cleanup.

## Interview practice

**Why is state needed?** It maps configuration addresses to real objects and retains metadata for future operations.

**Does sensitive=true keep a password out of state?** No. It marks values for display redaction. Ephemeral and supported write-only mechanisms address persistence.

**When use for_each instead of count?** When stable named identities matter; index shifts can alter several count instances.

**Does import create infrastructure?** It adopts existing infrastructure into state; the accompanying plan can still propose modifications.

**What prevents concurrent applies?** Backend locking and a serialized delivery path. Locks do not stop console changes or other states.

**How do you roll back an apply?** Plan a new change, assess replacement and data consequences, and use service backups or restoration when required. There is no universal undo.

**When split state?** When resources have different owners, privileges, release cadences, or recovery boundaries. Split carefully; excessive fragmentation creates dependencies and operational overhead.

**Completion criteria:** private storage, clear ownership, isolated environment credentials and state, a reviewed plan, useful tests, a clean second plan, and a documented recovery process.
