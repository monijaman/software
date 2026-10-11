---
title: "Dependencies, Data Sources, and Resource Lifecycle"
summary: "Understand the dependency graph, read existing infrastructure, and reason about replacements and lifecycle safeguards."
level: Intermediate
tags: ["terraform", "dependencies", "data-sources", "lifecycle"]
---

## References create a graph

Terraform does not execute files line by line. A reference tells it both which value to use and what must exist first:

```hcl
resource "aws_vpc" "main" {
  cidr_block           = "10.42.0.0/16"
  enable_dns_support  = true
  enable_dns_hostnames = true
}

resource "aws_subnet" "app" {
  vpc_id     = aws_vpc.main.id
  cidr_block = "10.42.1.0/24"
}
```

Add this to a root configured with the AWS provider. Terraform creates the VPC before the subnet and destroys the subnet before the VPC. Independent resources can run concurrently.

Use `depends_on` only for a dependency that is not represented by a value reference, such as a service needing an IAM policy attachment to finish before it starts. Broad module-level dependencies can cause more unknown values and more conservative plans.

## Read versus own

```hcl
data "aws_vpc" "existing" {
  id = var.existing_vpc_id
}

variable "existing_vpc_id" {
  type = string
}

output "existing_cidr" {
  value = data.aws_vpc.existing.cidr_block
}
```

A data source reads an existing VPC. It does not take responsibility for creating or deleting it. A managed resource imported into state does. Prefer stable IDs or carefully constrained filters; ambiguous discovery can select the wrong resource or fail.

## Unknown values are normal

A new VPC ID is often `(known after apply)`. Terraform can still plan dependent resources because their shape is known. But instance keys for `for_each` must be known during planning. Keep identity based on configuration, not an ID generated during apply.

## Replacement deserves attention

A `-/+` plan indicates destruction followed by creation; `+/-` indicates creation before destruction. Provider schemas determine which argument changes require replacement.

For a critical managed resource, a lifecycle block can help:

```hcl
# Inside an existing resource block:
lifecycle {
  prevent_destroy = true
}
```

This rejects plans that destroy the protected resource while the lifecycle rule is present. Removing the whole resource block also removes this protection. It is not a substitute for IAM, backups, or review.

`create_before_destroy` asks Terraform to create a replacement first, but unique names, quotas, or provider constraints may prevent that. `ignore_changes` delegates selected attributes to another system; using it broadly can conceal drift. Use it only when ownership is explicitly shared, such as an autoscaler owning desired capacity.

## Exercise

Create the VPC and subnet in an isolated lab. Change the subnet CIDR, then inspect a plan without applying it. Which object is replaced? Would a running workload be affected? Delete the lab after you finish.

**Key takeaway:** dependency order solves resource sequencing; it does not guarantee application readiness or a safe database migration.

Further reading: [Lifecycle reference](https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle), [data sources](https://developer.hashicorp.com/terraform/language/data-sources).
