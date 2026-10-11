---
title: "Drift, Troubleshooting, and Disaster Recovery"
summary: "Diagnose common failures, recover after partial applies, and operate state without destructive guesswork."
level: Advanced
tags: ["terraform", "drift", "troubleshooting", "recovery", "operations"]
---

## Start with the failing layer

| Symptom | First checks | Next action |
| --- | --- | --- |
| Provider download fails | Network, registry access, lock file, platform | Restore access; use an approved mirror if required |
| Access denied | Active identity, role policy, resource policy, organization controls | Grant only the missing permission through review |
| State lock error | Another runner, crashed operation, lock metadata | Wait or establish that the lock is stale |
| Unexpected replacement | Resource address, changed keys, provider schema, version diff | Correct configuration or add a planned migration |
| Unknown for_each keys | Keys derived from new resource IDs | Use stable configuration keys |
| Dependency cycle | Circular references and broad depends_on | Remove the cycle or separate lifecycle stages |
| Resource already exists | Import ownership, wrong state key, duplicate root | Find the owner before adopting anything |

Do not delete state or run repeated targeted applies just to make an error disappear.

## A partial apply is not an automatic rollback

Suppose Terraform creates a VPC and subnet, then fails to create another resource because of an IAM denial. Successfully created resources normally remain, and successful operations are recorded in state. Fix the permission or configuration issue, run a fresh plan, review it, then apply.

Some failures can leave a real object not fully recorded, especially when remote creation succeeds but the result is lost. Check both cloud inventory and state before deciding whether import is needed. Re-running blindly can create duplicates or naming conflicts.

## Respond to drift

If someone changed a bucket tag in the console, ordinary plan refreshes its view and usually proposes restoring the configured tag. Decide whether the change was intentional.

```bash
terraform plan -refresh-only -out=observed.tfplan
terraform apply observed.tfplan
```

Refresh-only updates state and outputs to observed remote values without changing managed infrastructure. It does not edit the source configuration to match those values. A later ordinary plan may still propose undoing the console change.

## Replacement and targeting

Use `terraform plan -replace=ADDRESS` when you deliberately need a replacement, then review all dependent consequences. Prefer this to the older taint workflow.

`-target` is an exceptional recovery tool. It produces a partial view and can leave the rest of the configuration unreconciled. After any justified targeted operation, run a complete plan and review the outstanding changes.

## Recovering state

1. Stop writers and confirm the backend and environment.
2. Preserve the current state snapshot and logs in restricted storage.
3. Compare cloud inventory, resource addresses, and available backend versions.
4. Restore or repair through a reviewed recovery procedure.
5. Run a full plan and verify that no existing infrastructure will be recreated accidentally.

An old state backup may omit resources created later. Restoring it is not an infrastructure rollback. Direct state pushing is dangerous; prefer backend recovery mechanisms and reviewed imports when possible.

## Rollback means a new reviewed change

Reverting source code and applying it is a new infrastructure change. It may replace resources, lose data, or fail because the provider/API no longer supports old settings. Database backups, restore drills, and application migration plans remain necessary.

**Exercise:** a CI apply times out after creating two resources. Write the next five checks you would perform before retrying. Explain why force-unlocking immediately is unsafe if the original job is still running.

Further reading: [State management](https://developer.hashicorp.com/terraform/cli/state), [refresh-only planning](https://developer.hashicorp.com/terraform/cli/commands/plan#planning-modes).
