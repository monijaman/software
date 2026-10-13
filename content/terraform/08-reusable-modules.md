---
title: "Reusable Modules and Clear Interfaces"
summary: "Build and call a small module, expose outputs, and define sensible module ownership and versioning."
level: Intermediate
tags: ["terraform", "modules", "interfaces", "reuse"]
---

## A module is a directory with an interface

A root module is the directory where you run Terraform. A child module is called through a `module` block. Inputs customize it; outputs expose results; internal resources implement the behavior.

Start with a local module so you can practice without cloud credentials:

```text
module-lab/
  main.tf
  modules/
    service-file/
      main.tf
      variables.tf
      outputs.tf
```

In `modules/service-file/main.tf`:

```hcl
terraform {
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = ">= 2.5, < 3.0"
    }
  }
}

resource "local_file" "config" {
  filename = "${var.output_dir}/${var.name}.json"
  content  = jsonencode({ name = var.name, port = var.port })
}
```

In `variables.tf`:

```hcl
variable "name" {
  type = string
}
variable "port" {
  type = number
  validation {
    condition     = var.port >= 1 && var.port <= 65535 && floor(var.port) == var.port
    error_message = "Port must be a whole number between 1 and 65535."
  }
}
variable "output_dir" {
  type = string
}
```

In `outputs.tf`:

```hcl
output "filename" {
  value = local_file.config.filename
}
```

In the root `main.tf`:

```hcl
terraform {
  required_version = ">= 1.11, < 2.0"
  required_providers {
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

module "api" {
  source     = "./modules/service-file"
  name       = "api"
  port       = 8080
  output_dir = abspath(path.root)
}

output "api_config" {
  value = module.api.filename
}
```

Run init, validate, plan, and apply. The resource address is now `module.api.local_file.config`. Add a second call named `web` with a different name and port.

## Design a useful boundary

A production storage module might always configure encryption, public-access protection, ownership tags, and versioning. Callers supply a naming prefix and retention requirements. This is a useful abstraction because it bundles a policy and lifecycle boundary.

Avoid modules that simply rename every provider argument without adding a clear contract. Also avoid a universal module with dozens of toggles for unrelated resource families.

Pass the output directory into the local module instead of writing into `path.module`: remote module directories can be shared or cached, making writes there surprising.

## Providers and versions

Configure credentials and provider settings in the root. Child modules declare their required provider sources. Default provider configurations can be inherited; aliased configurations require explicit wiring and appropriate `configuration_aliases` declarations in the child.

Pin registry module versions. For Git sources use a reviewed commit or immutable release ref. Upgrading a module can change resource addresses and replacement behavior, so review the upgrade plan and migration guidance.

**Practice:** add a validation rejecting an empty module name and document the module's inputs and outputs. Decide which settings callers can change and which are enforced defaults.

Further reading: [Module development](https://developer.hashicorp.com/terraform/language/modules/develop).
