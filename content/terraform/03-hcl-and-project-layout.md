---
title: "HCL, Resource Addresses, and Project Layout"
summary: "Read Terraform blocks, expressions, references, and version constraints, and organize a root module clearly."
level: Beginner
tags: ["terraform", "hcl", "configuration", "versions"]
---

## Read a block

Terraform usually uses HashiCorp Configuration Language, or HCL. A block contains a type, optional labels, and a body. An argument assigns an expression to a name.

```hcl
resource "local_file" "notes" {
  filename = "${path.module}/notes.txt"
  content  = "Review the plan before apply.\n"
}
```

The block type is `resource`. The labels identify the resource type and local name. `filename` and `content` are arguments defined by the local provider.

```hcl
locals {
  project = "academy"
  tags = {
    Project   = local.project
    ManagedBy = "Terraform"
  }
}
```

Locals name expressions. They cannot be overridden through CLI flags like input variables. Refer to a local as `local.project`, an input as `var.environment`, and a resource attribute as `aws_vpc.main.id`.

## Values and expressions

| Form | Example | Meaning |
| --- | --- | --- |
| String | `"academy"` | Text |
| Number | `3` | Numeric value |
| Boolean | `true` | True/false |
| List | `["web", "api"]` | Ordered collection |
| Map/object | `{ team = "platform" }` | Named values |
| Null | `null` | Absence; often omit an optional argument |
| Conditional | `var.production ? 3 : 1` | Choose one of two expressions |
| Function | `lower(var.project)` | Transform a value |

Terraform is declarative: moving a block to the top of a file does not make it execute first. References establish dependencies.

## One directory is one module

A common root layout is:

```text
storage-lab/
  versions.tf    # CLI and provider constraints
  providers.tf   # region and provider settings
  main.tf        # resources
  variables.tf   # input contract
  outputs.tf     # results for callers
  terraform.tfvars
  .terraform.lock.hcl
```

All top-level `.tf` files in that directory are combined. Filenames organize code for humans. Subdirectories are separate modules and are not loaded automatically.

## Constraints versus locking

`version = "~> 2.5"` allows versions from 2.5 up to, but excluding, 3.0. `"~> 2.5.0"` stops before 2.6.0. A constraint describes acceptable releases; `.terraform.lock.hcl` records the selected provider versions and checksums.

Use `terraform init -upgrade` only when you intend to reconsider provider selections. Review the lock-file diff and resulting plan together. The lock file does not lock remote module versions: pin registry modules explicitly and Git modules to immutable refs when reproducibility matters.

## Explore with the console

```bash
terraform console
```

Try `upper("academy")`, `length(["api", "web"])`, and `{ for name in ["api", "web"] : name => upper(name) }`. Exit with `exit`.

**Practice:** split the local lab across `versions.tf`, `main.tf`, and `outputs.tf`. Run plan. Reorganizing unchanged blocks within one module should not change infrastructure.

Further reading: [Configuration syntax](https://developer.hashicorp.com/terraform/language/syntax/configuration), [dependency lock file](https://developer.hashicorp.com/terraform/language/files/dependency-lock).
