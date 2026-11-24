---
title: "Jenkins in Production: Deploys, Docker and Scaling"
summary: "A complete Jenkins CI/CD pipeline: parallel test stages, Docker image build and push, SSH deploy to a VPS, manual approval with input, parameters and rollbacks, shared libraries, agents on Docker and Kubernetes, Configuration as Code, security, backups, and Jenkins vs GitHub Actions."
level: Advanced
tags: [jenkins, ci-cd, docker, deployment, devops, jenkinsfile]
---

## The big idea

Lesson 15 got Jenkins running tests. Now we turn it into a real **delivery pipeline**: test in parallel, build a Docker image once, push it to a registry, deploy to staging automatically, wait for a human to approve, then deploy the **same image** to production, with a one-click rollback.

We'll also cover what it takes to run Jenkins itself safely: agents, configuration as code, security and backups.

## The complete pipeline

```groovy
pipeline {
    agent { label 'docker' }                 // an agent that has Docker installed

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '50'))
        disableConcurrentBuilds()
        timestamps()
    }

    environment {
        REGISTRY = 'registry.example.com'
        IMAGE    = "${REGISTRY}/myapp"
        TAG      = "${env.GIT_COMMIT.take(7)}"   // short commit SHA, e.g. 3f9c2a1
    }

    stages {
        stage('Checks') {
            parallel {                           // these run at the same time
                stage('Lint') {
                    agent { docker { image 'node:22-alpine'; reuseNode true } }
                    steps { sh 'npm ci && npm run lint' }
                }
                stage('Unit tests') {
                    agent { docker { image 'node:22-alpine'; reuseNode true } }
                    steps { sh 'npm ci && npm test -- --ci --reporters=default --reporters=jest-junit' }
                    post { always { junit 'junit.xml' } }    // test results graph in the UI
                }
            }
        }

        stage('Build image') {
            steps {
                sh 'docker build -t "$IMAGE:$TAG" .'
            }
        }

        stage('Scan image') {
            steps {
                // fail the build on known critical vulnerabilities
                sh 'docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --exit-code 1 --severity CRITICAL "$IMAGE:$TAG"'
            }
        }

        stage('Push image') {
            when { branch 'main' }
            steps {
                withCredentials([usernamePassword(credentialsId: 'registry',
                                  usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
                    sh '''
                        echo "$REG_PASS" | docker login "$REGISTRY" -u "$REG_USER" --password-stdin
                        docker push "$IMAGE:$TAG"
                    '''
                }
            }
        }

        stage('Deploy to staging') {
            when { branch 'main' }
            steps {
                sshagent(['staging-ssh']) {
                    sh 'ssh -o StrictHostKeyChecking=yes deploy@staging.example.com "~/bin/deploy.sh $TAG"'
                }
            }
        }

        stage('Approve production') {
            when { branch 'main' }
            steps {
                timeout(time: 1, unit: 'HOURS') {              // don't hold an executor forever
                    input message: "Deploy ${TAG} to production?",
                          ok: 'Deploy',
                          submitter: 'release-managers'         // only this group can approve
                }
            }
        }

        stage('Deploy to production') {
            when { branch 'main' }
            steps {
                lock('production') {                            // Lockable Resources plugin: one prod deploy at a time
                    sshagent(['prod-ssh']) {
                        sh 'ssh deploy@prod.example.com "~/bin/deploy.sh $TAG"'
                    }
                }
            }
        }
    }

    post {
        failure {
            withCredentials([string(credentialsId: 'slack-webhook', variable: 'SLACK_URL')]) {
                sh '''curl -fsS -X POST -H 'Content-type: application/json' \
                      --data "{\\"text\\":\\"❌ $JOB_NAME #$BUILD_NUMBER failed: $BUILD_URL\\"}" "$SLACK_URL"'''
            }
        }
        always { cleanWs() }
    }
}
```

What the server's `deploy.sh` does with the tag:

```bash
#!/usr/bin/env bash
set -euo pipefail
TAG="$1"
cd /srv/myapp
export TAG
docker compose pull app                 # docker-compose.yml uses image: registry.example.com/myapp:${TAG}
docker compose up -d app
# health check: fail the deploy (and the Jenkins stage) if the app doesn't come up
for i in {1..20}; do
  curl -fsS http://127.0.0.1:3000/health && exit 0
  sleep 3
done
echo "Health check failed" >&2
exit 1
```

> 💡 The `input` step **pauses** the build. In declarative pipelines, put `input` in its own stage **without** a heavy agent, or use the stage-level `input` directive, so you don't block an executor while waiting for a human.

## Parameters and rollbacks

Add a manual "deploy any version" job, or parameters to the same pipeline:

```groovy
pipeline {
    agent { label 'docker' }
    parameters {
        string(name: 'TAG', description: 'Image tag (commit SHA) to deploy')
        choice(name: 'ENV', choices: ['staging', 'production'], description: 'Target')
    }
    stages {
        stage('Deploy') {
            steps {
                sshagent(["${params.ENV}-ssh"]) {
                    sh "ssh deploy@${params.ENV}.example.com '~/bin/deploy.sh ${params.TAG}'"
                }
            }
        }
    }
}
```

Because every image is tagged with its commit SHA and kept in the registry, **rollback = deploy the previous tag**. It takes seconds and doesn't need a new build.

## Shared libraries: stop copy-pasting Jenkinsfiles

With 30 repositories, you don't want 30 copies of the same 150-line Jenkinsfile. A **shared library** is a Git repo of reusable Groovy steps:

```text
jenkins-shared-lib/
└── vars/
    └── nodeAppPipeline.groovy
```

```groovy
// vars/nodeAppPipeline.groovy
def call(Map cfg) {
    pipeline {
        agent { label 'docker' }
        stages {
            stage('Test')   { steps { sh 'npm ci && npm test' } }
            stage('Build')  { steps { sh "docker build -t ${cfg.image}:${env.GIT_COMMIT.take(7)} ." } }
            stage('Deploy') {
                when { branch 'main' }
                steps { sshagent([cfg.sshCred]) { sh "ssh ${cfg.host} '~/bin/deploy.sh ${env.GIT_COMMIT.take(7)}'" } }
            }
        }
    }
}
```

Register it under **Manage Jenkins → System → Global Pipeline Libraries** (name `ci-lib`), and each app's Jenkinsfile becomes:

```groovy
@Library('ci-lib') _
nodeAppPipeline(image: 'registry.example.com/shop', sshCred: 'prod-ssh', host: 'deploy@prod.example.com')
```

Fix a bug once in the library, and every project gets it.

## Agents: where builds run

| Agent type | How | Good for |
| --- | --- | --- |
| **Permanent SSH agent** | Controller connects to a Linux VM over SSH | Simple, predictable setups |
| **Inbound (JNLP) agent** | Agent connects to the controller on port 50000 | Agents behind firewalls |
| **Docker agents** | Each stage runs in a fresh container | Clean, version-pinned environments |
| **Kubernetes agents** (Kubernetes plugin) | Each build gets a new Pod, deleted afterwards | Auto-scaling, many teams |
| **Cloud agents** (EC2 plugin, etc.) | Spin VMs up on demand, terminate when idle | Bursty load, cost control |

Kubernetes example: each build runs in a throwaway Pod with the containers you ask for:

```groovy
pipeline {
    agent {
        kubernetes {
            yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: node
    image: node:22-alpine
    command: ["sleep"]
    args: ["infinity"]
'''
        }
    }
    stages {
        stage('Test') {
            steps { container('node') { sh 'npm ci && npm test' } }
        }
    }
}
```

Use **labels** to route work: `agent { label 'linux && docker' }`, `agent { label 'gpu' }`.

## Configuration as Code (JCasC)

Clicking through the UI to configure Jenkins can't be reviewed, repeated or recovered. The **Configuration as Code** plugin describes Jenkins in YAML:

```yaml
# jenkins.yaml
jenkins:
  systemMessage: "Managed by JCasC - do not edit in the UI"
  numExecutors: 0                      # no builds on the controller
  securityRealm:
    local:
      allowsSignup: false
      users:
        - id: admin
          password: ${ADMIN_PASSWORD}  # read from an environment variable / secret
  authorizationStrategy:
    loggedInUsersCanDoAnything:
      allowAnonymousRead: false
unclassified:
  location:
    url: https://jenkins.example.com/
```

Combine with a custom image that pre-installs plugins:

```dockerfile
FROM jenkins/jenkins:lts-jdk21
ENV JAVA_OPTS="-Djenkins.install.runSetupWizard=false"
ENV CASC_JENKINS_CONFIG=/var/jenkins_home/casc/jenkins.yaml
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli -f /usr/share/jenkins/ref/plugins.txt
COPY jenkins.yaml /var/jenkins_home/casc/jenkins.yaml
```

```text
# plugins.txt
configuration-as-code
workflow-aggregator
git
github-branch-source
ssh-agent
docker-workflow
credentials-binding
lockable-resources
ws-cleanup
```

Now a broken Jenkins can be rebuilt from Git in minutes. Jobs themselves come from Jenkinsfiles in each repo (plus Multibranch / Organization Folders), so almost nothing lives only in the UI.

## Securing Jenkins

| Area | Do this |
| --- | --- |
| **Network** | HTTPS via Nginx; never expose 8080 directly; restrict access with VPN or IP allow-list if possible |
| **Authentication** | No anonymous access; use SSO (GitHub, Google, LDAP/Active Directory) |
| **Authorization** | **Role-based** or **matrix** permissions; most users can only build and view |
| **Controller** | 0 executors; builds only on agents |
| **Plugins** | Install few, update often; watch the security warnings banner |
| **Updates** | Follow the **LTS** line and upgrade regularly |
| **Credentials** | Scope them to folders; use separate deploy keys per environment |
| **Untrusted PRs** | Don't run fork PRs with production credentials; require approval for outside contributors |
| **Script approval** | Don't blindly approve Groovy methods in "In-process Script Approval" |

## Backups and upgrades

Everything important is in `JENKINS_HOME` (`/var/lib/jenkins` or the `jenkins_home` volume):

```bash
# Simple nightly backup (excluding the big, rebuildable parts)
sudo tar --exclude='workspace' --exclude='caches' \
  -czf /backup/jenkins-$(date +%F).tgz -C /var/lib jenkins
```

Upgrade routine:

1. Back up `JENKINS_HOME`.
2. Read the LTS upgrade guide for breaking changes.
3. Upgrade Jenkins (`apt upgrade jenkins` or a new image tag), then plugins.
4. Check the system log and run a few pipelines.

With JCasC + Jenkinsfiles in Git, the backup mainly protects **build history and credentials**.

## Monitoring Jenkins

- **Prometheus metrics** plugin → Grafana dashboards: queue length, executor usage, build durations, failures.
- Alert when the **build queue** keeps growing (not enough agents) or disk usage on the controller passes 80%.
- Track the DORA metrics from lesson 14: deploy frequency and failure rate come straight from your pipeline history.

## Jenkins vs GitHub Actions

| | Jenkins | GitHub Actions |
| --- | --- | --- |
| Hosting | You run it | GitHub runs it (or your self-hosted runners) |
| Cost | Free software, you pay for servers and time | Free minutes, then pay per minute |
| Pipeline language | Groovy (`Jenkinsfile`) | YAML |
| Works with | Any Git host, on-premises, air-gapped networks | Best with GitHub |
| Extensibility | 1,800+ plugins, shared libraries | Marketplace actions, reusable workflows |
| Maintenance | Upgrades, plugins, security are **your job** | Almost none |
| Typical users | Enterprises, regulated industries, existing installations | Startups, open source, GitHub-centric teams |

Same concepts, different syntax:

| Concept | Jenkins | GitHub Actions |
| --- | --- | --- |
| Pipeline file | `Jenkinsfile` | `.github/workflows/ci.yml` |
| Where it runs | `agent` | `runs-on` |
| Phase | `stage` | `job` |
| Command | `sh 'npm test'` | `run: npm test` |
| Condition | `when { branch 'main' }` | `if: github.ref == 'refs/heads/main'` |
| Parallel | `parallel { }` | Separate jobs run in parallel by default |
| Secret | `credentials('id')` | `${{ secrets.NAME }}` |
| Approval | `input` step | Environment required reviewers |
| One at a time | `lock()` / `disableConcurrentBuilds()` | `concurrency:` |
| Reuse | Shared library | Reusable workflow / composite action |

## Interview questions

**What is the difference between declarative and scripted pipelines?**
Declarative uses a fixed structure (`pipeline`, `agent`, `stages`, `post`) that is easier to read and validate. Scripted is plain Groovy, more flexible but harder to maintain. Use declarative, and drop into a `script { }` block only when needed.

**Why shouldn't builds run on the Jenkins controller?**
Builds can use all CPU, fill the disk, or run untrusted code with access to `JENKINS_HOME`, which holds all credentials. Agents isolate that risk and scale out.

**How do you handle secrets in Jenkins?**
Store them in the Credentials store, scoped as narrowly as possible, reference them by ID with `withCredentials` or `credentials()`, use single-quoted `sh` scripts, and never print them.

**How do you avoid duplicated pipelines across many repos?**
Shared libraries, plus Organization Folders or Multibranch Pipelines that discover Jenkinsfiles automatically.

**How do you make Jenkins itself reproducible?**
Custom image with `plugins.txt`, Configuration as Code YAML, jobs defined by Jenkinsfiles in Git, and regular `JENKINS_HOME` backups.

**How do you roll back?**
Tag every artifact with the commit SHA, keep old artifacts in the registry, and run a parameterized deploy job with the previous tag.

## Key takeaways

- A production pipeline: **parallel checks → build image once → scan → push → staging → approve → production**.
- Tag images with the **commit SHA**; rollback is redeploying an older tag.
- Use `input` with a `timeout` and `submitter` for approvals, and `lock` to prevent overlapping production deploys.
- **Shared libraries** remove copy-paste; **Docker/Kubernetes agents** give clean, scalable build environments.
- Make Jenkins reproducible with **JCasC + plugins.txt**, secure it like production, and back up `JENKINS_HOME`.

## Try it yourself

Extend your lesson 15 pipeline: build a Docker image tagged with the short commit SHA, push it to a registry, and add an `input` approval stage before a (fake) production deploy that just runs `echo "deploying $TAG"`. Then create a parameterized job that "deploys" any tag you type.
