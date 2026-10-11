---
title: "Testing, Preconditions, and Policy Checks"
summary: "Use validation, lifecycle conditions, Terraform tests, and policy checks to catch different classes of errors."
level: Advanced
tags: ["terraform", "testing", "policy", "preconditions", "test"]
---

## Different checks answer different questions

| Check | Question |
| --- | --- |
| `terraform fmt -check` | Is formatting consistent? |
| `terraform validate` | Is the configuration internally valid? |
| Variable validation | Are inputs acceptable? |
| Precondition/postcondition | Are resource assumptions satisfied? |
| `terraform test` | Does the configuration satisfy assertions? |
| Plan review | What operations will happen in this environment? |
| Policy checks | Are these operations allowed by organizational rules? |

Neither validate nor a plan-only test proves a remote API call will succeed.

## Add a blocking precondition

In a root with the local provider configured:

```hcl
variable "environment" {
  type    = string
  default = "dev"
}

variable "replicas" {
  type    = number
  default = 1
}

resource "local_file" "deployment" {
  filename = "${path.module}/deployment.json"
  content  = jsonencode({ replicas = var.replicas })

  lifecycle {
    precondition {
      condition     = var.environment != "prod" || var.replicas >= 2
      error_message = "Production requires at least two replicas."
    }
  }
}
```

This checks a relationship between inputs. Resource preconditions and postconditions can block an operation. A `check` block instead reports assertion failures as warnings, so choose it for observability rather than a hard deployment gate.

## Write a Terraform test

Use the module-lab root from lesson 8. Create `tests/service.tftest.hcl`:

```hcl
run "api_filename_contract" {
  command = plan

  assert {
    condition     = endswith(output.api_config, "/api.json")
    error_message = "The API module must expose its expected filename."
  }
}
```

```bash
terraform init
terraform test
```

This runs a plan and asserts a known output value without applying the file resources. It tests the root's observable contract, not merely the presence of a line of HCL.

The default test run command is `apply`; those tests may create infrastructure. Integration tests need an isolated account, constrained credentials, a budget, and cleanup verification. Terraform tests have separate test state, but failed destruction can leave resources behind.

Mock providers can test configuration logic without real API calls, but mocks cannot demonstrate real provider behavior, IAM access, or service quotas. Use integration tests selectively for those concerns.

## Review policy at the plan boundary

An organization might reject public S3 buckets, unapproved regions, missing owner tags, or production database destruction. Implement policies with the chosen platform's supported policy engine or a tool that evaluates plan JSON.

```bash
terraform show -json reviewed.tfplan > reviewed-plan.json
```

Treat this JSON as sensitive. Policy engines must handle unknown values explicitly; an unknown value is not evidence that a resource is safe. Do not upload raw plan JSON to an untrusted service.

**Exercise:** add a second test assertion for a module output you define, then deliberately break it. Explain why passing tests still requires reviewing replacements in a real production plan.

Further reading: [Terraform tests](https://developer.hashicorp.com/terraform/language/tests), [custom conditions](https://developer.hashicorp.com/terraform/language/expressions/custom-conditions).
