---
title: "Providers and Your First AWS Resources"
summary: "Configure AWS safely and provision a private, versioned S3 bucket with explicit resource settings."
level: Beginner
tags: ["terraform", "aws", "providers", "s3"]
---

## Before running this lab

Use a new directory and an AWS learning account. Configure short-lived AWS credentials outside Terraform, such as an AWS CLI SSO profile. Confirm the account with `aws sts get-caller-identity` using the same profile Terraform will use. Never paste access keys into provider blocks.

```bash
export AWS_PROFILE=learning
aws sso login --profile learning
aws sts get-caller-identity
```

SSO login assumes that profile has already been configured with `aws configure sso`. The role needs permissions for the illustrated S3 operations.

## A complete private bucket example

Save as `main.tf`:

```hcl
terraform {
  required_version = ">= 1.11, < 2.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "assets" {
  bucket_prefix = "academy-assets-"
  tags = {
    Environment = "dev"
    ManagedBy   = "Terraform"
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

output "bucket_name" {
  value = aws_s3_bucket.assets.id
}
```

The provider version range targets the AWS 6.x family. Review provider release notes before upgrading a real project. `bucket_prefix` lets the provider choose a unique name instead of colliding with the globally shared bucket namespace.

The references to the bucket ID automatically make the related resources depend on the bucket. Separate resources manage public access, versioning, and encryption settings.

```bash
terraform init
terraform fmt
terraform validate
terraform plan -out=storage.tfplan
terraform apply storage.tfplan
terraform output -raw bucket_name
```

Expect four resources to be created. Inspect the actual plan if provider behavior or configuration changes.

## Verify and clean up

Using the output as the bucket name, inspect settings through the AWS console or `aws s3api get-public-access-block`, `get-bucket-versioning`, and `get-bucket-encryption`. Run plan again and expect no changes.

Plan destruction and review it before applying. An empty bucket can be deleted. If you uploaded objects, remove all object versions and delete markers before deleting a versioned bucket. This example intentionally leaves `force_destroy` disabled.

**Practice:** change only the `Environment` tag and inspect the plan. It should modify tags without replacing the bucket. Explain why the public-access configuration is a separate managed resource.

Further reading: [AWS provider documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs), [AWS authentication](https://registry.terraform.io/providers/hashicorp/aws/latest/docs#authentication-and-configuration).
