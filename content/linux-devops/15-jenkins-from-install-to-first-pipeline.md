---
title: "Jenkins: From Install to Your First Pipeline"
summary: "Install Jenkins with Docker or on Ubuntu, unlock it, choose plugins, and write a declarative Jenkinsfile: stages, steps, agents, environment variables, credentials, post actions, GitHub webhooks and multibranch pipelines."
level: Intermediate
tags: [jenkins, ci-cd, jenkinsfile, pipeline, devops, automation]
---

## The big idea

**Jenkins** is a free, open-source automation server. You install it on **your own** machine, connect it to your Git repositories, and it runs your build, test and deploy steps whenever code changes.

If GitHub Actions is like **ordering a taxi** (someone else owns and maintains the car), Jenkins is like **owning your own car**: more work to maintain, but you can drive it anywhere, modify anything, and it works even where taxis can't go (private company networks, air-gapped data centers).

Jenkins is one of the oldest and most widely used CI/CD tools, so you'll meet it in many companies, especially larger ones and those with on-premises servers.

## How Jenkins is organized

![The Jenkins controller schedules jobs from Git webhooks and hands the work to agents, which build, test and deploy](/img/linux-devops/jenkins-architecture.svg)

| Term | Meaning |
| --- | --- |
| **Controller** | The main Jenkins server: web UI, configuration, job scheduling, plugin host |
| **Agent** (node) | A machine (or container) that actually runs the build steps |
| **Executor** | One "slot" on an agent; an agent with 2 executors runs 2 builds at once |
| **Job / Project** | A configured task, such as "build and deploy myapp" |
| **Pipeline** | A job defined as code in a `Jenkinsfile` |
| **Build** | One run of a job (#1, #2, #3…), with its own log and result |
| **Stage** | A named phase of a pipeline (Build, Test, Deploy), shown as a column in the UI |
| **Step** | One action inside a stage (`sh 'npm test'`) |
| **Plugin** | An add-on: Git, Docker, Slack, Kubernetes… almost everything in Jenkins is a plugin |
| **Credentials** | Encrypted secrets (passwords, SSH keys, tokens) stored by Jenkins |

> 💡 Best practice: run **no builds on the controller**. Set its executors to 0 and use agents. A build that fills the disk or runs untrusted code should never be able to break or read the controller.

## Step 1: Install Jenkins

### Option A: Docker (easiest for learning)

```bash
docker network create jenkins

docker volume create jenkins_home

docker run -d --name jenkins \
  --restart unless-stopped \
  --network jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins_home:/var/jenkins_home \
  jenkins/jenkins:lts-jdk21
```

- Port **8080** is the web UI; port **50000** is where agents connect.
- The `jenkins_home` volume holds **everything**: jobs, build history, plugins, credentials. Back it up.

### Option B: Ubuntu server (systemd service)

```bash
# Jenkins needs Java (17 or 21)
sudo apt update
sudo apt install -y fontconfig openjdk-21-jre

# Add the official Jenkins LTS repository
sudo wget -O /etc/apt/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key
echo "deb [signed-by=/etc/apt/keyrings/jenkins-keyring.asc] https://pkg.jenkins.io/debian-stable binary/" \
  | sudo tee /etc/apt/sources.list.d/jenkins.list > /dev/null

sudo apt update
sudo apt install -y jenkins

sudo systemctl enable --now jenkins
systemctl status jenkins          # should be "active (running)"
```

> ⚠️ The signing key URL changes from time to time. If `apt update` complains about a missing key, copy the current commands from the official Jenkins installation page.

Jenkins now runs as a **systemd service** (lesson 4) under its own `jenkins` user, with data in `/var/lib/jenkins`.

**Don't expose port 8080 to the internet.** Put Nginx with HTTPS in front of it (lesson 7) and allow only 443 in the firewall (lesson 5):

```nginx
server {
    server_name jenkins.example.com;
    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }
    # listen 443 ssl; certificates added by certbot
}
```

## Step 2: Unlock and set up

1. Open `http://your-server:8080` (or your HTTPS domain).
2. Get the one-time admin password:

   ```bash
   # Docker
   docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
   # Ubuntu package
   sudo cat /var/lib/jenkins/secrets/initialAdminPassword
   ```

3. Choose **Install suggested plugins** (includes Git, Pipeline, Credentials).
4. Create your **admin user** (don't keep using the initial password).
5. Set the **Jenkins URL** to the public HTTPS address.

Useful extra plugins (**Manage Jenkins → Plugins → Available**):

| Plugin | Why |
| --- | --- |
| **Pipeline** (suggested) | `Jenkinsfile` support |
| **GitHub Branch Source** / **GitLab Branch Source** | Multibranch pipelines and PR builds |
| **SSH Agent** | Use an SSH key in a pipeline step for deploys |
| **Docker Pipeline** | Run stages inside containers, build and push images |
| **Credentials Binding** (suggested) | Turn credentials into environment variables |
| **Pipeline: Stage View** | Visual stage columns per build |
| **Configuration as Code (JCasC)** | Define Jenkins setup in YAML (lesson 16) |

> 🔒 Install **only** the plugins you need. Each plugin is code running inside your CI server, and old plugins are a common source of security issues.

## Step 3: Your first Jenkinsfile

A **Jenkinsfile** lives in the root of your repository, next to `package.json`. It's "pipeline as code": reviewed in pull requests, versioned in Git, and the same for everyone.

Jenkins has two syntaxes: **declarative** (structured, recommended) and **scripted** (raw Groovy). Use declarative.

```groovy
pipeline {
    agent any                          // run on any available agent

    options {
        timeout(time: 20, unit: 'MINUTES')          // kill stuck builds
        buildDiscarder(logRotator(numToKeepStr: '30'))  // keep the disk clean
        disableConcurrentBuilds()                   // one build of this branch at a time
    }

    environment {
        NODE_ENV = 'test'
    }

    stages {
        stage('Install') {
            steps {
                sh 'node --version'
                sh 'npm ci'
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
    }

    post {
        success { echo '✅ Build passed' }
        failure { echo '❌ Build failed, check the log above' }
        always  { cleanWs() }          // delete the workspace (needs Workspace Cleanup plugin)
    }
}
```

![A declarative Jenkinsfile maps to stage columns in the Jenkins UI, and post blocks run after the stages finish](/img/linux-devops/jenkins-pipeline.svg)

### Anatomy of a declarative pipeline

| Block | Required? | Purpose |
| --- | --- | --- |
| `pipeline { }` | Yes | Wraps everything |
| `agent` | Yes | Where to run: `any`, a label (`agent { label 'linux' }`), or a Docker image |
| `options` | No | Timeouts, retries, build retention, concurrency |
| `environment` | No | Environment variables for all stages |
| `parameters` | No | Inputs shown when you click "Build with Parameters" |
| `triggers` | No | Schedules (`cron`) or polling |
| `stages` → `stage` → `steps` | Yes | The actual work |
| `when` | No | Run a stage only if a condition is true |
| `post` | No | `always`, `success`, `failure`, `unstable`, `changed` actions |

### Run stages inside a Docker container

Instead of installing Node.js on the agent, run the stage in an official image (needs the Docker Pipeline plugin and Docker on the agent):

```groovy
pipeline {
    agent {
        docker {
            image 'node:22-alpine'
            args  '-v $HOME/.npm:/root/.npm'     // reuse the npm cache between builds
        }
    }
    stages {
        stage('Test') {
            steps {
                sh 'npm ci && npm test'
            }
        }
    }
}
```

Now every build gets a clean, identical Node 22 environment, and different projects can use different versions on the same agent.

## Step 4: Create the job

### Simple Pipeline job

1. **New Item → Pipeline**, name it `myapp`.
2. Under **Pipeline**, choose **Pipeline script from SCM**.
3. **SCM: Git**, repository URL, credentials (if private), branch `*/main`.
4. **Script path:** `Jenkinsfile`.
5. **Save → Build Now**, then click the build number → **Console Output**.

### Multibranch Pipeline (recommended)

A **Multibranch Pipeline** scans your repository and automatically creates a job for **every branch and pull request** that has a `Jenkinsfile`.

1. **New Item → Multibranch Pipeline**.
2. **Branch Sources → GitHub** (or GitLab / Git), add credentials and the repo URL.
3. Save. Jenkins scans and builds each branch and PR.

Now feature branches and PRs get CI, and Jenkins reports ✅/❌ back to the PR on GitHub.

## Step 5: Credentials

Never write passwords or keys in the Jenkinsfile. Store them in **Manage Jenkins → Credentials → System → Global → Add Credentials**:

| Kind | Example | Use in pipeline |
| --- | --- | --- |
| **Username with password** | Docker Hub login | `usernamePassword(...)` |
| **Secret text** | API token, Slack webhook | `string(...)` or `credentials('id')` |
| **SSH Username with private key** | Deploy key for the VPS | `sshagent(['id'])` |
| **Secret file** | `kubeconfig`, `.env` | `file(...)` |

Use them with an **ID**, never the value:

```groovy
environment {
    // For "username with password", Jenkins also creates DOCKER_CREDS_USR and DOCKER_CREDS_PSW
    DOCKER_CREDS = credentials('dockerhub')
    SLACK_URL    = credentials('slack-webhook')
}

stages {
    stage('Login') {
        steps {
            // single quotes: the SHELL expands the variable, so the secret is not put into Groovy strings
            sh 'echo "$DOCKER_CREDS_PSW" | docker login -u "$DOCKER_CREDS_USR" --password-stdin'
        }
    }
}
```

Or only inside one block:

```groovy
withCredentials([string(credentialsId: 'api-token', variable: 'TOKEN')]) {
    sh 'curl -fsS -H "Authorization: Bearer $TOKEN" https://api.example.com/deploy-hook'
}
```

Jenkins masks these values as `****` in the console log.

> ⚠️ Use **single quotes** around `sh` scripts that use secrets. With double quotes, Groovy puts the secret into the command string first, which can leak it (Jenkins warns about this).

## Step 6: Trigger builds automatically

| Trigger | How | Notes |
| --- | --- | --- |
| **Webhook** (best) | GitHub → Settings → Webhooks → `https://jenkins.example.com/github-webhook/`, event: push + pull requests | Instant; needs Jenkins reachable from GitHub |
| **Multibranch scan** | Branch source scans on webhook or every N minutes | Automatic with GitHub Branch Source |
| **Poll SCM** | `triggers { pollSCM('H/5 * * * *') }` | Use only if webhooks can't reach Jenkins |
| **Schedule** | `triggers { cron('H 2 * * *') }` | Nightly builds, scheduled jobs |
| **Manual** | "Build Now" / "Build with Parameters" | Deploys, maintenance tasks |

`H` in Jenkins cron means "hash": Jenkins picks a consistent minute per job so 100 jobs don't all start at exactly 02:00.

## Useful built-in variables

| Variable | Example value |
| --- | --- |
| `env.BUILD_NUMBER` | `42` |
| `env.BRANCH_NAME` | `main`, `feature/login`, `PR-17` (multibranch) |
| `env.GIT_COMMIT` | `3f9c2a1e…` |
| `env.JOB_NAME` | `myapp/main` |
| `env.BUILD_URL` | `https://jenkins.example.com/job/myapp/job/main/42/` |
| `env.WORKSPACE` | `/var/jenkins_home/workspace/myapp_main` |

```groovy
stage('Deploy') {
    when { branch 'main' }            // only on main
    steps {
        echo "Deploying build ${env.BUILD_NUMBER} (${env.GIT_COMMIT})"
    }
}
```

## Common beginner problems

| Problem | Cause | Fix |
| --- | --- | --- |
| `npm: not found` | Node.js isn't installed on the agent | Use `agent { docker { image 'node:22' } }` or install via the NodeJS plugin |
| `permission denied ... docker.sock` | The `jenkins` user can't use Docker | `sudo usermod -aG docker jenkins` then restart Jenkins (understand that this gives root-level power) |
| Webhook doesn't trigger | GitHub can't reach Jenkins, or wrong URL | Check GitHub → Webhooks → Recent Deliveries; the URL must end with `/github-webhook/` |
| Build hangs forever | Waiting for input or a stuck process | Add `options { timeout(...) }` |
| Disk full on the controller | Old builds and workspaces | `buildDiscarder`, `cleanWs()`, run builds on agents |
| Jenkins is slow or crashes | Too little RAM for the JVM | Give it at least 2 to 4 GB RAM; don't build on the controller |

## Key takeaways

- Jenkins is a **self-hosted** automation server: controller schedules, agents build.
- Install with Docker (`jenkins/jenkins:lts-jdk21`) or the Ubuntu package, put it behind **Nginx + HTTPS**, and back up `jenkins_home`.
- Define pipelines as code in a **declarative Jenkinsfile**: `agent`, `stages`, `steps`, `post`.
- Use **Multibranch Pipelines** with **webhooks** so every branch and PR is tested.
- Keep secrets in **Jenkins Credentials** and reference them by ID, with single-quoted `sh` scripts.

## Try it yourself

Run Jenkins in Docker on your laptop, create a Multibranch Pipeline for one of your repositories, and add the Jenkinsfile above. Break a test on a branch and confirm the build turns red. Next lesson: deploying to a server from Jenkins.
