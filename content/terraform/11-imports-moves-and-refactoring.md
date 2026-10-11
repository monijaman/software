---
title: "Imports, Moved Blocks, and Safe Refactoring"
summary: "Adopt existing infrastructure, rename resources without recreating them, and remove ownership deliberately."
level: Advanced
tags: ["terraform", "import", "moved", "refactoring", "state"]
---

## Import brings an existing object under management

Suppose a private bucket already exists and you want Terraform to manage it. In an AWS-configured root, write matching resource configuration and an import block:

```hcl
resource "aws_s3_bucket" "assets" {
  bucket = "replace-with-your-existing-bucket"
}

import {
  to = aws_s3_bucket.assets
  id = "replace-with-your-existing-bucket"
}
```

```bash
terraform plan -out=adopt.tfplan
terraform apply adopt.tfplan
terraform plan
```

Review the first plan for both import and unintended modifications. Import does not guarantee that your configuration matches the current settings. For S3, public-access settings and versioning are separately managed resources; importing the bucket alone does not import every related setting.

The CLI alternative is `terraform import ADDRESS ID`, which updates state directly. Import blocks make adoption reviewable through the plan/apply workflow. Provider docs define the import ID; different resource types use different formats.

`terraform plan -generate-config-out=generated.tf` can help generate resource configuration for appropriate import blocks. Review generated code, resolve conflicting settings, and adapt it to your conventions before apply. Generated configuration is a starting point.

## Rename without replacement

If `aws_s3_bucket.assets` becomes `aws_s3_bucket.media`, update the resource label and references, then add:

```hcl
moved {
  from = aws_s3_bucket.assets
  to   = aws_s3_bucket.media
}
```

The plan should show an address move rather than a destroy/create cycle. This preserves the real object while changing its recorded address.

Moving a root resource into a module follows the same principle:

```hcl
moved {
  from = aws_s3_bucket.assets
  to   = module.storage.aws_s3_bucket.assets
}
```

This assumes the destination module exists and its settings match. Keep migration blocks long enough for all consumers to upgrade. Removing them too early can break upgrades from older module versions.

## Stop managing without deleting

For a deliberate handoff, remove the original resource configuration and use:

```hcl
removed {
  from = aws_s3_bucket.assets
  lifecycle {
    destroy = false
  }
}
```

The object remains in AWS but leaves this state's management after apply. Confirm the successor owner first. Simply deleting the resource block normally plans destruction.

## Refactoring checklist

Before applying, confirm the state owner, destination address, provider account, and plan. Back up state securely. Avoid simultaneous writers during ownership transfers. Cross-state moves require a coordinated migration: an in-state `moved` block cannot move an object between independent state files.

**Practice:** rename the local file resource from lesson 2 using `moved`. Verify that the plan reports a move. Compare with the proposed plan when no moved block is present; do not apply the destructive alternative.

Further reading: [Import overview](https://developer.hashicorp.com/terraform/language/import), [module refactoring](https://developer.hashicorp.com/terraform/language/modules/develop/refactoring), [removed blocks](https://developer.hashicorp.com/terraform/language/block/removed).
