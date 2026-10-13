---
title: "Your First Terraform Project"
summary: "Install Terraform and create, change, inspect, and destroy a local file without using a cloud account."
level: Beginner
tags: ["terraform", "cli", "init", "plan", "apply", "local"]
---

## Prepare your workstation

Install the Terraform CLI using the instructions for your OS in the [official installation guide](https://developer.hashicorp.com/terraform/install). Then check:

```bash
terraform version
mkdir terraform-first-lab
cd terraform-first-lab
```

These lessons use Terraform **1.11 or newer within the 1.x series** as a baseline. Specific provider versions and features still need compatibility checks. This is a minimum for the examples, not a claim about the newest release.

## Create main.tf

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

resource "local_file" "welcome" {
  filename = "${path.module}/welcome.txt"
  content  = "Hello from Terraform!\n"
}

output "file_path" {
  value = local_file.welcome.filename
}
```

`local_file` is a provider resource type. `welcome` is the name within this configuration. Together they form the address `local_file.welcome`. The output returns the created file's path.

## Initialize and preview

```bash
terraform init
terraform fmt
terraform validate
terraform plan -out=first.tfplan
```

`init` installs the provider and initializes the backend. `fmt` formats the source. `validate` checks configuration consistency; it does not prove credentials work or that an API will accept a change. `plan` shows the proposed infrastructure changes.

Expect a plan to add one resource. Read its filename and content before continuing.

```bash
terraform apply first.tfplan
cat welcome.txt
terraform output file_path
terraform state list
```

Expected file content: `Hello from Terraform!`. Applying a saved plan executes that approved plan without a second interactive confirmation. Treat plan files as sensitive artifacts.

## Change and repeat

Change `content` to `"Hello, infrastructure as code!\n"`, create a new plan, inspect it, and apply it. Provider behavior determines whether a change updates or replaces a resource; inspect the symbols rather than assuming.

Run `terraform plan` again. With no external changes, you should see **No changes**. Delete `welcome.txt` manually and run plan again: Terraform detects the missing file and proposes creating it.

## Clean up

```bash
terraform plan -destroy -out=cleanup.tfplan
terraform apply cleanup.tfplan
```

The file disappears; the source files remain. Cleanup applies only to resources in this root module's current state.

## What belongs in Git?

Commit `.tf` files and `.terraform.lock.hcl`. Do not commit the downloaded `.terraform/` directory, state, secret variable files, or saved plans.

```gitignore
.terraform/
*.tfstate
*.tfstate.*
*.tfplan
crash.log
secrets.tfvars
```

**Practice:** add a second `local_file` with a different filename. Predict the plan before running it. Keep this lab separate from later AWS configurations.

Further reading: [CLI workflow](https://developer.hashicorp.com/terraform/cli/run).
