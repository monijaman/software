---
title: "Variables, Locals, Outputs, and Validation"
summary: "Build a configurable local lab with typed inputs, useful outputs, and clear validation errors."
level: Beginner
tags: ["terraform", "variables", "outputs", "validation"]
---

## Replace hard-coded values with a contract

Extend the first local lab. Retain its `terraform` block, replace the original resource and output, and add:

```hcl
variable "project" {
  type        = string
  description = "Lowercase project name used in the generated file."
  default     = "academy"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,19}$", var.project))
    error_message = "Use 3–20 lowercase letters, digits, or hyphens, starting with a letter."
  }
}

variable "environment" {
  type    = string
  default = "dev"

  validation {
    condition     = contains(["dev", "stage", "prod"], var.environment)
    error_message = "Environment must be dev, stage, or prod."
  }
}

locals {
  name = "${var.project}-${var.environment}"
}

resource "local_file" "welcome" {
  filename = "${path.module}/${local.name}.txt"
  content  = "Project: ${var.project}\nEnvironment: ${var.environment}\n"
}

output "file_path" {
  description = "Generated file path."
  value       = local_file.welcome.filename
}
```

The variable's type protects the module boundary. Validation explains which business values are acceptable. A local avoids repeating the naming expression. An output publishes a result.

## Supply values

Create `dev.tfvars`:

```hcl
project     = "shop"
environment = "dev"
```

```bash
terraform plan -var-file=dev.tfvars
terraform plan -var='project=store' -var='environment=stage'
```

Terraform automatically loads `terraform.tfvars` and `*.auto.tfvars`; an arbitrary filename such as `dev.tfvars` needs `-var-file`. CLI assignments have higher precedence than environment variables and automatically loaded files. Avoid defining the same setting in several places.

Shell environment variables use the `TF_VAR_` prefix:

```bash
export TF_VAR_project=shop
terraform plan
```

## Structured inputs

```hcl
variable "services" {
  type = map(object({
    port     = number
    replicas = optional(number, 1)
  }))
  default = {
    api = { port = 8080 }
    web = { port = 3000, replicas = 2 }
  }
}
```

This maps stable service names to typed settings. `var.services["api"].replicas` evaluates to `1`. An object captures a record with known attributes; a map represents similarly shaped entries identified by keys.

## Sensitive does not mean absent from state

`sensitive = true` hides an input or output in ordinary CLI display. It does not, by itself, prevent its value from being stored in state or plan artifacts. Later security lessons cover ephemeral inputs and write-only arguments.

**Practice:** plan with `environment = "production"`; expect a validation error. Change it to `"prod"`; explain which filename Terraform proposes and whether the old file is replaced.

Further reading: [Input variables](https://developer.hashicorp.com/terraform/language/values/variables), [outputs](https://developer.hashicorp.com/terraform/language/values/outputs).
