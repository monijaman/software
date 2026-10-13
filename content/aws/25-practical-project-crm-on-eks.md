---
title: "Practical Project: Deploy a Real CRM App on EKS"
summary: "Take a containerized CRM (DemoCRM) from source code to a secure AWS deployment: ECR images, an EKS cluster, Pod Identity for Secrets Manager, private RDS, ingress, CI/CD, troubleshooting and a production checklist."
level: Advanced
tags: [aws, project, eks, ecr, rds, secrets-manager, pod-identity, iam, ci-cd, kubernetes, troubleshooting]
---

## What you will build

This lesson walks through a real project: **DemoCRM**, a CRM with a Next.js frontend and NestJS backend services backed by PostgreSQL, deployed to AWS. Everything earlier in this path comes together here: IAM, VPC, ECR, EKS, RDS, Secrets Manager, load balancing and CI/CD.

By the end you should be able to set up the same shape for **your own** containerized application and, more importantly, debug it when it breaks.

> **Placeholders:** commands use `ACCOUNT_ID`, `REGION`, `CLUSTER` and similar values. Replace them with your own. Never publish real account IDs, passwords, access keys, database URLs or secret values in docs, tickets or Git.

```bash
# Set these once per terminal session and reuse them in every command below.
export ACCOUNT_ID=111122223333
export REGION=us-east-1
export CLUSTER=myapp-dev
export NAMESPACE=dev
export APP=crm-core
```

## 1. The complete mental model

```mermaid
flowchart LR
    DEV[Developer] --> GIT[Git repository]
    GIT --> CI[GitHub Actions or CodeBuild]
    CI --> ECR[Amazon ECR]
    ECR --> EKS[Amazon EKS]
    EKS --> FE[Frontend pod]
    EKS --> BE[Backend pods]
    BE --> SM[AWS Secrets Manager]
    BE --> RDS[Amazon RDS PostgreSQL]
    USER[User] --> CF[CloudFront or ALB]
    CF --> FE
    FE --> ALB[ALB or API Gateway]
    ALB --> BE
```

Keep each kind of thing in its proper home:

| Thing | Where it lives | Why |
| --- | --- | --- |
| Source code | Git | Reviewed, versioned, reproducible |
| Runnable versions | Docker images in **ECR** | The exact artifact you tested is the one you deploy |
| Runtime configuration | **Secrets Manager** or Kubernetes ConfigMaps | Changes without rebuilding; secrets never in images |
| Running applications | Kubernetes **pods** on **EKS** | Self-healing, rolling updates, scaling |
| Persistent data | **RDS** PostgreSQL | Pods are disposable; data must not be |
| AWS access | **IAM roles** with temporary credentials | No long-lived keys to leak or rotate |

If you remember only one rule from this project: **containers are cattle, data is not, and credentials are never hard-coded.**

## 2. Prerequisites

Install and configure these tools on your machine:

| Tool | Check | Used for |
| --- | --- | --- |
| AWS CLI v2 | `aws --version` | Every AWS call |
| `kubectl` | `kubectl version --client` | Talking to Kubernetes |
| `eksctl` | `eksctl version` | Creating the cluster (optional but much easier) |
| Docker | `docker version` | Building images |
| Helm | `helm version` | Installing the AWS Load Balancer Controller |

Sign in with short-lived credentials, ideally through IAM Identity Center:

```bash
aws configure sso          # one-time profile setup
aws sso login --profile dev
export AWS_PROFILE=dev
aws sts get-caller-identity   # confirm WHO you are before changing anything
```

> **Cost warning:** an EKS cluster costs about $0.10 per hour (~$73/month) even when empty, plus EC2 nodes, NAT gateways, load balancers and RDS. Do this in a development account and follow the cleanup section when you are done.

## 3. The finished environment

This is what the DemoCRM development environment looked like at the end of the project. Use it as your target.

| Component | Implementation | Status |
| --- | --- | --- |
| EKS cluster | `democrm-dev` | Created |
| EKS node group | `democrm-nodes` | Created; needs desired capacity above zero to run pods |
| Backend workload | `crm-core` Deployment in namespace `dev` | Deployed |
| Backend image | `democrm-crm-core:<version>` in ECR | Pulls successfully |
| Database | RDS PostgreSQL in private subnets | Connection verified |
| Runtime secret | `backendenv` in Secrets Manager | Retrieval verified through Pod Identity |
| Pod IAM role | `DemoCrmCrmCorePodRole` | Created and associated |
| Service account | `dev/crm-core` | Created |
| EKS Pod Identity Agent | EKS add-on | Active |
| Frontend | Legacy EC2 deployment on port 3000 | Being migrated |
| Backend readiness | Outbox transaction issue | Needs an application fix |

The interesting lesson: the original AWS credential failure was an **infrastructure** problem and was solved with Pod Identity. The remaining `OutboxRelayService` error is an **application** problem. Learning to tell those two apart is half of operating on AWS.

## 4. Understand the four identities

AWS uses different identities for different jobs. Mixing them up is the most common cause of both security holes and `AccessDenied` errors.

```mermaid
flowchart TB
    H[Human engineer] -->|IAM Identity Center permission set| A[EKS access entry]
    CP[EKS control plane] -->|assumes| CR[Cluster role]
    N[EC2 worker node] -->|assumes| NR[Node role]
    P[crm-core pod] -->|Pod Identity| PR[Pod role]
    PR -->|GetSecretValue only| S[backendenv secret]
```

| Identity | Example | Who assumes it | Should allow |
| --- | --- | --- | --- |
| Human | `EKS-Infrastructure-Admin-Dev` permission set | An engineer via SSO | Managing the dev cluster |
| Cluster role | `DemoCrmEksClusterRole` | EKS control plane | `AmazonEKSClusterPolicy` only |
| Node role | `DemoCrmEksNodeRole` | Worker EC2 instances | Join cluster, pull from ECR, VPC CNI |
| Pod role | `DemoCrmCrmCorePodRole` | Only the `crm-core` service account | Read **one** secret |

The pod role allows reading only:

```text
arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:backendenv-*
```

> **Why not give the node role secret access?** Every pod on the node could then read it. A pod role scopes access to one workload. That is least privilege in practice.

## 5. Create the cluster and node group

`eksctl` creates the VPC, public and private subnets, NAT gateway, IAM roles, cluster and node group from one file. Save this as `cluster.yaml`:

```yaml
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig
metadata:
  name: myapp-dev
  region: us-east-1
  version: "1.33"

accessConfig:
  authenticationMode: API_AND_CONFIG_MAP

addons:
  - name: vpc-cni
  - name: coredns
  - name: kube-proxy
  - name: eks-pod-identity-agent

managedNodeGroups:
  - name: myapp-nodes
    instanceType: t3.medium
    minSize: 0
    maxSize: 2
    desiredCapacity: 1
    privateNetworking: true   # nodes live in private subnets
    volumeSize: 30
```

```bash
eksctl create cluster -f cluster.yaml     # takes 15–20 minutes
aws eks update-kubeconfig --name "$CLUSTER" --region "$REGION"
kubectl get nodes                          # one node should be Ready
```

Prefer Terraform or CloudFormation once the shape is stable; `eksctl` is the fastest way to learn it.

## 6. Give people access to the cluster

Generating a kubeconfig does **not** authorize an IAM identity inside Kubernetes. Access entries are what map IAM principals to Kubernetes permissions.

If your cluster was not created with access entries, enable them:

```bash
aws eks update-cluster-config \
  --name "$CLUSTER" --region "$REGION" \
  --access-config authenticationMode=API_AND_CONFIG_MAP

aws eks describe-cluster --name "$CLUSTER" --region "$REGION" \
  --query 'cluster.accessConfig.authenticationMode' --output text
```

Grant an approved role access:

```bash
aws eks create-access-entry \
  --cluster-name "$CLUSTER" --region "$REGION" \
  --principal-arn ROLE_ARN --type STANDARD

# View-only for diagnosis. Use AmazonEKSClusterAdminPolicy only for real admins.
aws eks associate-access-policy \
  --cluster-name "$CLUSTER" --region "$REGION" \
  --principal-arn ROLE_ARN \
  --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSViewPolicy \
  --access-scope type=cluster
```

> For SSO users, `ROLE_ARN` is the role behind the permission set, for example `arn:aws:iam::ACCOUNT_ID:role/aws-reserved/sso.amazonaws.com/AWSReservedSSO_EKS-Infrastructure-Admin-Dev_abc123`. Use the ARN **without** the `/aws-reserved/sso.amazonaws.com/` path when the CLI rejects it.

### Access errors decoded

| Error | Meaning | Fix |
| --- | --- | --- |
| `connection to localhost:8080 refused` | No kubeconfig | Run `aws eks update-kubeconfig` |
| `the server has asked for the client to provide credentials` | IAM identity not known to EKS | Create an access entry |
| `Forbidden` | Known, but lacks Kubernetes permission | Associate a wider access policy |

## 7. Worker nodes and scheduling

The EKS control plane does not run your pods. A node group needs **running EC2 capacity**.

```bash
aws eks describe-nodegroup \
  --cluster-name "$CLUSTER" --nodegroup-name myapp-nodes --region "$REGION" \
  --query 'nodegroup.scalingConfig'

# Start one development worker
aws eks update-nodegroup-config \
  --cluster-name "$CLUSTER" --nodegroup-name myapp-nodes --region "$REGION" \
  --scaling-config minSize=0,maxSize=2,desiredSize=1

kubectl get nodes
kubectl get pods -A
```

If every pod is `Pending` and events say `no nodes available to schedule pods`, desired capacity is probably zero or the nodes failed to join (check the node role and subnets).

> **Save money in dev:** scale the node group to `desiredSize=0` at night. All pods stop, but the cluster, images and database survive.

## 8. Build and push images to ECR

### Create one repository per service

```bash
for repo in myapp-web myapp-crm-core myapp-identity myapp-notifications; do
  aws ecr create-repository --repository-name "$repo" --region "$REGION" \
    --image-tag-mutability IMMUTABLE \
    --image-scanning-configuration scanOnPush=true
done
```

`IMMUTABLE` stops anyone overwriting a tag, so `v1.4.0` always means the same bytes.

### Tag with versions, not `latest`

```text
v1.4.0                 semantic release version
git-a1b2c3d            exact commit
2026-10-14-a1b2c3d     date + commit, easy to sort
```

Deploying `latest` makes it impossible to know what is running or to roll back reliably.

### Build and push

```bash
REPOSITORY=myapp-crm-core
VERSION=git-$(git rev-parse --short HEAD)
REGISTRY="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin "$REGISTRY"

# --platform matters when building on Apple Silicon for x86 nodes
docker build --platform linux/amd64 -t "$REGISTRY/$REPOSITORY:$VERSION" .
docker push "$REGISTRY/$REPOSITORY:$VERSION"
```

A small, production-friendly Dockerfile for a Node.js backend:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3060
CMD ["node", "dist/main.js"]
```

Add an ECR **lifecycle policy** to delete untagged images and keep only the last N versions, or storage costs creep up.

## 9. Create the database (RDS PostgreSQL)

The database lives in the **private** subnets of the cluster VPC and accepts traffic only from the cluster.

```bash
# Private subnets created by eksctl
aws ec2 describe-subnets --region "$REGION" \
  --filters "Name=tag:alpha.eksctl.io/cluster-name,Values=$CLUSTER" \
            "Name=tag:kubernetes.io/role/internal-elb,Values=1" \
  --query 'Subnets[].SubnetId' --output text

aws rds create-db-subnet-group \
  --db-subnet-group-name myapp-dev-db \
  --db-subnet-group-description "myapp dev private subnets" \
  --subnet-ids subnet-aaa subnet-bbb

aws rds create-db-instance \
  --db-instance-identifier myapp-dev-postgres \
  --engine postgres --db-instance-class db.t4g.micro \
  --allocated-storage 20 --storage-encrypted \
  --master-username appadmin --manage-master-user-password \
  --db-subnet-group-name myapp-dev-db \
  --vpc-security-group-ids sg-DB_SECURITY_GROUP \
  --no-publicly-accessible --backup-retention-period 7
```

`--manage-master-user-password` makes RDS generate the password and store it in Secrets Manager for you, so no human ever types it.

**Security group rule:** allow TCP `5432` into the DB security group **only** from the cluster/node security group. Never from `0.0.0.0/0`.

## 10. Store runtime configuration in Secrets Manager

```bash
cat > backendenv.json <<'EOF'
{
  "DATABASE_URL": "postgresql://appuser:CHANGE_ME@myapp-dev-postgres.xxxx.us-east-1.rds.amazonaws.com:5432/crm",
  "JWT_SECRET": "CHANGE_ME"
}
EOF

aws secretsmanager create-secret --region "$REGION" \
  --name backendenv --secret-string file://backendenv.json

rm backendenv.json   # do not leave secrets on disk or in shell history
```

The application reads the secret at startup using the AWS SDK and the secret ID from an environment variable. It does **not** need `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`. Pod Identity supplies those (next step).

## 11. Give the pod access to the secret with Pod Identity

This is where DemoCRM originally failed with `CredentialsProviderError`: the SDK in the pod found no credentials. The fix is a dedicated pod role.

### Step 1: the Pod Identity Agent add-on

Already installed if you used the `cluster.yaml` above. Otherwise:

```bash
aws eks create-addon --cluster-name "$CLUSTER" --region "$REGION" \
  --addon-name eks-pod-identity-agent
```

### Step 2: create the pod role

Trust policy (`pod-trust.json`). This lets **EKS pods** assume the role:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "pods.eks.amazonaws.com" },
    "Action": ["sts:AssumeRole", "sts:TagSession"]
  }]
}
```

Permission policy (`pod-secret.json`). One action on one secret:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "secretsmanager:GetSecretValue",
    "Resource": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:backendenv-*"
  }]
}
```

The `-*` suffix is needed because Secrets Manager appends six random characters to every secret ARN.

```bash
aws iam create-role --role-name MyAppCrmCorePodRole \
  --assume-role-policy-document file://pod-trust.json

aws iam put-role-policy --role-name MyAppCrmCorePodRole \
  --policy-name read-backendenv --policy-document file://pod-secret.json
```

If the secret is encrypted with a customer-managed KMS key, also allow `kms:Decrypt` on that key.

### Step 3: link the role to a Kubernetes service account

```bash
kubectl create namespace "$NAMESPACE"
kubectl -n "$NAMESPACE" create serviceaccount "$APP"

aws eks create-pod-identity-association \
  --cluster-name "$CLUSTER" --region "$REGION" \
  --namespace "$NAMESPACE" --service-account "$APP" \
  --role-arn "arn:aws:iam::$ACCOUNT_ID:role/MyAppCrmCorePodRole"
```

Pods that use this service account now get temporary credentials automatically. Pods must be **restarted** after creating the association to pick it up.

### Step 4: security cleanup

If static keys were ever placed in the secret or in environment variables, remove `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`, then **deactivate and rotate** those IAM user keys. Assume a key that was ever in plain configuration is compromised.

## 12. Deploy the backend to EKS

Save as `crm-core.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crm-core
  namespace: dev
spec:
  replicas: 1
  selector:
    matchLabels:
      app: crm-core
  template:
    metadata:
      labels:
        app: crm-core
    spec:
      serviceAccountName: crm-core          # this is what grants the pod role
      containers:
        - name: crm-core
          image: ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/myapp-crm-core:v1.4.0
          ports:
            - containerPort: 3060
          env:
            - name: AWS_REGION
              value: us-east-1
            - name: AWS_SECRETS_MANAGER_SECRET_ID
              value: backendenv
          resources:
            requests: { cpu: 250m, memory: 256Mi }
            limits:   { memory: 512Mi }
          readinessProbe:                   # receive traffic only when ready
            httpGet: { path: /healthz, port: 3060 }
            initialDelaySeconds: 20
            periodSeconds: 10
          livenessProbe:                    # restart if hung
            httpGet: { path: /healthz, port: 3060 }
            initialDelaySeconds: 60
            periodSeconds: 20
---
apiVersion: v1
kind: Service
metadata:
  name: crm-core
  namespace: dev
spec:
  selector:
    app: crm-core
  ports:
    - port: 80
      targetPort: 3060
```

```bash
kubectl apply -f crm-core.yaml
kubectl -n dev rollout status deployment/crm-core
kubectl -n dev get pods
kubectl -n dev logs deployment/crm-core --tail=100
```

Healthy startup logs look like:

```text
GetSecretValue OK
Connected to PostgreSQL Database
Nest application successfully started
```

Log **that** the secret loaded, never **what** it contains.

## 13. Frontend: choose the right hosting

| Frontend type | Best home | Why |
| --- | --- | --- |
| Static export (SPA, `next export`) | S3 + CloudFront | Cheapest, global CDN, nothing to patch |
| Server-rendered Next.js (SSR) | Separate EKS Deployment + Service | Needs a running Node.js server |
| Legacy single EC2 instance | Keep temporarily | Only as a rollback path during migration |

**Migration recommendation:** keep the existing EC2 frontend running. Deploy the new versioned frontend to EKS or CloudFront, test it on a temporary hostname, switch DNS only after validation, and keep EC2 available until you are confident you will not roll back.

## 14. Routing and ingress

The **AWS Load Balancer Controller** turns Kubernetes `Ingress` objects into real ALBs. It needs its own IAM role (separate from your application roles).

```bash
curl -o lbc-policy.json \
  https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json
aws iam create-policy --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://lbc-policy.json
# Create a role with the pods.eks.amazonaws.com trust policy, attach this policy,
# then associate it with kube-system/aws-load-balancer-controller via Pod Identity.

helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system --set clusterName="$CLUSTER" \
  --set serviceAccount.name=aws-load-balancer-controller
```

An Ingress for the backend:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: crm-core
  namespace: dev
  annotations:
    alb.ingress.kubernetes.io/scheme: internal          # or internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /healthz
spec:
  ingressClassName: alb
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service: { name: crm-core, port: { number: 80 } }
```

A typical private-backend design:

```text
Internet → API Gateway → VPC Link → internal ALB → Kubernetes Service → Pods
```

For a public app, an `internet-facing` ALB with an ACM certificate and a Route 53 alias record is simpler.

**Verify each layer separately**, from the inside out:

1. The pod health endpoint works: `kubectl -n dev port-forward deploy/crm-core 3060` then `curl localhost:3060/healthz`.
2. The Service has endpoints: `kubectl -n dev get endpoints crm-core`.
3. The Ingress created an ALB with healthy targets: `kubectl -n dev describe ingress crm-core`, then check the target group in the console.
4. The VPC Link is `AVAILABLE` (if using API Gateway).
5. The API Gateway route points at the right integration.
6. Route 53 points at the intended public endpoint.

When something fails, the first broken layer is your problem. Everything after it is a symptom.

## 15. CI/CD pipeline

Nobody should run `docker push` from a laptop to deploy production. The pipeline does it:

1. Check out a specific Git commit.
2. Run tests.
3. Build the Docker image.
4. Tag it with the Git SHA (and release version on tags).
5. Push it to ECR.
6. Update the EKS Deployment.
7. Wait for rollout completion.
8. Run a health check.
9. Roll back if validation fails.

GitHub Actions with **OIDC** (no stored AWS keys in GitHub):

```yaml
name: deploy-crm-core
on:
  push:
    branches: [main]

permissions:
  id-token: write     # required for OIDC
  contents: read

env:
  AWS_REGION: us-east-1
  CLUSTER: myapp-dev
  REPOSITORY: myapp-crm-core

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - run: npm ci && npm test

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT_ID:role/GitHubDeployRole
          aws-region: ${{ env.AWS_REGION }}

      - id: ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push
        env:
          IMAGE: ${{ steps.ecr.outputs.registry }}/${{ env.REPOSITORY }}:git-${{ github.sha }}
        run: |
          docker build -t "$IMAGE" .
          docker push "$IMAGE"
          echo "IMAGE=$IMAGE" >> "$GITHUB_ENV"

      - name: Deploy
        run: |
          aws eks update-kubeconfig --name "$CLUSTER" --region "$AWS_REGION"
          kubectl -n dev set image deployment/crm-core crm-core="$IMAGE"
          if ! kubectl -n dev rollout status deployment/crm-core --timeout=5m; then
            kubectl -n dev rollout undo deployment/crm-core
            exit 1
          fi
```

`GitHubDeployRole` trusts GitHub's OIDC provider for **your repository and branch only**, can push to ECR, and has an EKS access entry scoped to the `dev` namespace.

Manual rollback is always one command:

```bash
kubectl -n dev rollout history deployment/crm-core
kubectl -n dev rollout undo deployment/crm-core
```

## 16. Troubleshooting workflow

Always diagnose in the same order, from the cluster down to the container:

```bash
kubectl get nodes
kubectl get deployments -A
kubectl get pods -A
kubectl -n NAMESPACE describe pod POD_NAME          # read the Events at the bottom
kubectl -n NAMESPACE logs POD_NAME --tail=100
kubectl -n NAMESPACE logs POD_NAME --previous --tail=100   # the crash before the restart
```

| Symptom | Meaning | First check |
| --- | --- | --- |
| `Pending` | Pod cannot be scheduled | Node capacity and pod events |
| `ContainerCreating` (stuck) | Image, network or volume setup | Pod events |
| `ImagePullBackOff` | Wrong tag or ECR permission | Image tag exists; node role has ECR read |
| `CrashLoopBackOff` | App starts then crashes repeatedly | Current and `--previous` logs |
| `CredentialsProviderError` | AWS SDK found no workload credentials | Service account name, Pod Identity association, pod restarted |
| `AccessDenied` | Credentials exist, permission missing | The denied action and resource ARN in the error |
| `0/1 Running` | Process runs, readiness probe fails | Probe path/port and startup logs |

Read errors literally. `AccessDenied ... secretsmanager:GetSecretValue on arn:...:secret:backendenv-AbCdEf` tells you exactly which action, which resource and therefore which policy line is missing.

## 17. Case study: the outbox transaction error

After fixing credentials and the database connection, `crm-core` still was not ready:

```text
OutboxRelayService: Transaction API error:
Unable to start a transaction in the given time
```

This is **not** an AWS problem. The pod has credentials, reads the secret and connects to PostgreSQL. The application exhausts its database connection pool, typically because the outbox relay starts overlapping transactions.

The fix belongs in code:

- Reuse **one** Prisma client per process.
- Prevent overlapping relay iterations (wait for one run to finish before scheduling the next).
- Keep external network calls (Kafka, HTTP, email) **outside** database transactions.
- Process small outbox batches.
- Coordinate multiple replicas with row locking:

```sql
SELECT id, payload
FROM outbox
WHERE processed_at IS NULL
ORDER BY created_at
LIMIT 50
FOR UPDATE SKIP LOCKED;
```

- Start the relay loop **after** NestJS finishes booting so it cannot block startup and the readiness probe.
- Tune Prisma `maxWait` and `timeout` only after the concurrency bug is fixed.

Then ship it the proper way: code change → new versioned image → ECR push → EKS rollout. **Never** edit code directly on a worker node or inside a running container; the next restart erases it.

## 18. Observability

| What | How |
| --- | --- |
| Container logs | CloudWatch Observability add-on or Fluent Bit → CloudWatch Logs, with a retention period |
| Metrics | Container Insights for CPU, memory, restarts |
| Alarms | Pod restarts, ALB 5xx rate, RDS CPU and free storage, node count = 0 |
| Dashboards | One page per environment: request rate, errors, latency, saturation |

Set log retention (for example 30 days in dev). The default is "never expire", which quietly grows your bill.

## 19. Production checklist

### Done in this project

- [x] EKS cluster exists with access entries enabled.
- [x] Development administrator access configured.
- [x] Node group launches a worker.
- [x] ECR image pulls successfully.
- [x] Pod Identity Agent active.
- [x] Dedicated `crm-core` service account and pod role.
- [x] `backendenv` retrieval succeeds.
- [x] RDS PostgreSQL connection succeeds.

### Still to do before production

- [ ] Fix `OutboxRelayService` transaction and startup behaviour.
- [ ] Build and deploy the corrected backend image; confirm `1/1 Running`.
- [ ] Remove and rotate any static AWS access keys.
- [ ] Separate frontend and backend ECR repositories.
- [ ] Adopt immutable semantic-version and Git-SHA tags.
- [ ] Decide frontend hosting: S3/CloudFront or EKS SSR.
- [ ] Complete and validate ALB / API Gateway / VPC Link routing.
- [ ] Add CloudWatch alerts, dashboards and log retention.
- [ ] Move infrastructure to Terraform with remote state (S3 + locking).
- [ ] Automate CI/CD health checks and rollback.
- [ ] Run at least 2 replicas across AZs with a PodDisruptionBudget.
- [ ] Enable RDS Multi-AZ and test a snapshot restore.

## 20. Clean up (avoid surprise bills)

Delete in reverse order of creation, because load balancers created by Kubernetes block VPC deletion:

```bash
kubectl delete ingress --all -A                 # removes ALBs first
kubectl delete namespace dev
aws rds delete-db-instance --db-instance-identifier myapp-dev-postgres \
  --skip-final-snapshot                         # dev only!
aws secretsmanager delete-secret --secret-id backendenv --recovery-window-in-days 7
eksctl delete cluster -f cluster.yaml           # cluster, nodes, VPC, NAT
# Finally delete ECR repositories and IAM roles you created.
```

Check the Billing console the next day to make sure nothing is still running.

## 21. Practice plan

Work through these ten exercises in a dev account. For each, write down: **purpose, what state it changes, expected output, and how to roll it back.**

1. Run `kubectl get`, `describe` and `logs` against every namespace and explain what you see.
2. Build one Docker image locally and tag it twice (version and Git SHA).
3. Push a test image to ECR and pull it back.
4. Deploy a simple health-check service into a `dev` namespace.
5. Add a service account and Pod Identity role.
6. Retrieve a harmless test secret from inside the pod.
7. Perform an image update, then a rollback.
8. Scale the node group to zero and back to one while watching pod states.
9. Trace one request from DNS → load balancer → Service → pod → RDS.
10. Break something on purpose (wrong image tag, removed policy, wrong probe path) and fix it using only the troubleshooting table.

When you can explain those ten exercises without notes, you understand the core operational path, not just the commands.
