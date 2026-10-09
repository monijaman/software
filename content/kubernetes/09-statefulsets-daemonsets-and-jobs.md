---
title: "StatefulSets, DaemonSets, Jobs and CronJobs"
summary: "Pick the right workload type: stable identity for databases, one pod per node for agents, and run-to-completion tasks."
level: Intermediate
tags: [kubernetes, statefulset, daemonset, job, cronjob, workloads]
---

## A Deployment is not always the answer

Deployments treat pods as interchangeable. That is perfect for stateless web APIs, but wrong for some workloads.

| Need | Use |
| --- | --- |
| Interchangeable stateless copies | **Deployment** |
| Stable name, stable storage, ordered startup | **StatefulSet** |
| Exactly one pod on every (or selected) node | **DaemonSet** |
| Run a task once until it succeeds | **Job** |
| Run a task on a schedule | **CronJob** |

## StatefulSet: pods with identity

A StatefulSet gives each pod a **stable name** (`db-0`, `db-1`, `db-2`), a **stable DNS name**, and its **own PersistentVolumeClaim** that follows the pod if it is rescheduled.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: db
spec:
  serviceName: db-headless     # a headless Service gives each pod its own DNS record
  replicas: 3
  selector:
    matchLabels: { app: db }
  template:
    metadata:
      labels: { app: db }
    spec:
      containers:
        - name: postgres
          image: postgres:16
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: [ReadWriteOnce]
        resources:
          requests:
            storage: 20Gi
```

Key behaviours:

- Pods start in order (`db-0`, then `db-1`...) and stop in reverse, unless you set `podManagementPolicy: Parallel`.
- A **headless Service** (`clusterIP: None`) creates DNS names such as `db-0.db-headless.default.svc`.
- Deleting a StatefulSet does **not** delete its PVCs. This protects data, but you must clean up yourself.
- Replication, leader election and backups are **not** handled for you. For real databases, prefer an **operator** (see the extending lesson) or a managed service such as RDS.

## DaemonSet: one pod per node

Use a DaemonSet for node-level agents: log shippers, metrics exporters, CNI plugins, security agents.

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-agent
spec:
  selector:
    matchLabels: { app: log-agent }
  template:
    metadata:
      labels: { app: log-agent }
    spec:
      tolerations:
        - operator: Exists      # also run on tainted nodes
      containers:
        - name: agent
          image: fluent/fluent-bit:3.1
```

New node joins the cluster, and a pod appears there automatically. Limit it with `nodeSelector` if only some nodes need it.

## Job: run to completion

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: migrate
spec:
  backoffLimit: 3               # retry failed pods up to 3 times
  activeDeadlineSeconds: 600    # give up after 10 minutes
  ttlSecondsAfterFinished: 3600 # clean up automatically
  template:
    spec:
      restartPolicy: Never      # Jobs require Never or OnFailure
      containers:
        - name: migrate
          image: registry.example.com/shop-api:1.9.0
          command: ["node", "migrate.js"]
```

For parallel work, set `completions` (how many successes you need) and `parallelism` (how many pods run at once). **Indexed Jobs** (`completionMode: Indexed`) give each pod a number so it can process its own slice of data.

## CronJob: a Job on a schedule

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-report
spec:
  schedule: "0 2 * * *"
  concurrencyPolicy: Forbid       # skip if the last run is still going
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: report
              image: registry.example.com/reports:2.1.0
```

Pitfalls:

- Make jobs **idempotent**. A run can occasionally happen twice or be missed.
- Set `concurrencyPolicy` deliberately: `Allow` (default), `Forbid` or `Replace`.
- Use `timeZone: "Asia/Dhaka"` if you do not want the controller's time zone.

## Remember this

- Stateless app: Deployment. Stable identity and storage: StatefulSet.
- Node agents: DaemonSet.
- Jobs need `restartPolicy` of `Never` or `OnFailure`, plus `backoffLimit` and a deadline.
- StatefulSet gives identity, not database management. Use operators or managed databases.
