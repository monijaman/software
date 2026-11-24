---
title: "Running Kafka in Production: The DevOps View"
summary: "Is Kafka a DevOps tool? What developers own vs what operators own, running a 3-broker KRaft cluster with Docker Compose, the settings that matter, sizing, Linux tuning, security, monitoring consumer lag, topics as code in CI/CD, rolling upgrades, and managed alternatives."
level: Advanced
tags: [kafka, devops, docker, monitoring, operations, ci-cd]
---

## Is Kafka a DevOps thing?

**Short answer: Kafka itself is not a DevOps tool. It's a backend and data platform.** But **running** Kafka is a big operations job, so DevOps and platform engineers deal with it a lot.

Think of Kafka like a **city's postal system**:

- **Developers** decide what letters to send, to which address, and how to read them. That's Kafka as a **backend tool**: topics, producers, consumers, delivery guarantees. The **Apache Kafka** section covers this.
- **DevOps / platform engineers** build and run the post offices: buildings, trucks, staff, security, keeping it open 24/7. That's Kafka as **infrastructure**, and it's what this lesson covers.

| Kafka task | Usually owned by |
| --- | --- |
| Designing topics, events and schemas | Backend developers |
| Writing producers and consumers | Backend developers |
| Choosing delivery guarantees and keys | Backend developers |
| Installing and upgrading brokers | DevOps / platform team |
| Disk, network, OS tuning, capacity planning | DevOps / platform team |
| Security: TLS, authentication, ACLs | DevOps / platform team (with security) |
| Monitoring, alerting, consumer lag | Shared |
| Creating topics through CI/CD | Shared |

> 💡 If you're a developer, learn the **Apache Kafka** section first (topics, partitions, offsets, consumer groups, replication). This lesson assumes those words make sense.

![Three Kafka brokers in KRaft mode spread partition replicas across machines, with producers, consumers and monitoring around the cluster](/img/linux-devops/kafka-ops-cluster.svg)

## Architecture you'll operate

| Component | Job |
| --- | --- |
| **Broker** | Stores partitions on disk and serves producers and consumers |
| **Controller** (KRaft) | Manages cluster metadata: which broker leads which partition. Since Kafka 4.0, **KRaft replaces ZooKeeper** completely |
| **Replication** | Each partition is copied to several brokers (replication factor, usually 3) |
| **Schema Registry** (optional) | Stores Avro/Protobuf/JSON schemas so producers and consumers agree on formats |
| **Kafka Connect** (optional) | Moves data between Kafka and databases, S3, Elasticsearch… |
| **UI / tooling** | Kafka UI, AKHQ, Redpanda Console for browsing topics and groups |

For production, use **at least 3 brokers** (and 3 controllers, which can run on the same nodes in small clusters) so one machine can fail without losing data or availability.

## A 3-broker cluster with Docker Compose

Good for learning, staging, and small self-hosted setups. Each node is both broker and controller ("combined mode").

```yaml
# docker-compose.yml
x-kafka-env: &kafka-env
  KAFKA_PROCESS_ROLES: broker,controller
  KAFKA_CONTROLLER_QUORUM_VOTERS: 1@kafka1:9093,2@kafka2:9093,3@kafka3:9093
  KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
  KAFKA_INTER_BROKER_LISTENER_NAME: INTERNAL
  KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,INTERNAL:PLAINTEXT,EXTERNAL:PLAINTEXT
  CLUSTER_ID: "4L6g3nShT-eMCtK--X86sw"        # same for all nodes; generate with kafka-storage.sh random-uuid
  KAFKA_DEFAULT_REPLICATION_FACTOR: 3
  KAFKA_MIN_INSYNC_REPLICAS: 2
  KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
  KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 3
  KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: 2
  KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"      # topics are created on purpose, not by typos
  KAFKA_LOG_RETENTION_HOURS: 168                # 7 days

services:
  kafka1:
    image: apache/kafka:4.0.0
    restart: unless-stopped
    ports: ["19092:19092"]
    environment:
      <<: *kafka-env
      KAFKA_NODE_ID: 1
      KAFKA_LISTENERS: INTERNAL://:9092,CONTROLLER://:9093,EXTERNAL://:19092
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka1:9092,EXTERNAL://localhost:19092
    volumes: ["kafka1-data:/var/lib/kafka/data"]

  kafka2:
    image: apache/kafka:4.0.0
    restart: unless-stopped
    ports: ["29092:29092"]
    environment:
      <<: *kafka-env
      KAFKA_NODE_ID: 2
      KAFKA_LISTENERS: INTERNAL://:9092,CONTROLLER://:9093,EXTERNAL://:29092
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka2:9092,EXTERNAL://localhost:29092
    volumes: ["kafka2-data:/var/lib/kafka/data"]

  kafka3:
    image: apache/kafka:4.0.0
    restart: unless-stopped
    ports: ["39092:39092"]
    environment:
      <<: *kafka-env
      KAFKA_NODE_ID: 3
      KAFKA_LISTENERS: INTERNAL://:9092,CONTROLLER://:9093,EXTERNAL://:39092
      KAFKA_ADVERTISED_LISTENERS: INTERNAL://kafka3:9092,EXTERNAL://localhost:39092
    volumes: ["kafka3-data:/var/lib/kafka/data"]

  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    ports: ["8081:8080"]
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka1:9092,kafka2:9092,kafka3:9092
    depends_on: [kafka1, kafka2, kafka3]

volumes:
  kafka1-data:
  kafka2-data:
  kafka3-data:
```

```bash
docker compose up -d

# Create a topic: 6 partitions, 3 copies
docker compose exec kafka1 /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka1:9092 --create --topic orders \
  --partitions 6 --replication-factor 3

# See where leaders and replicas live
docker compose exec kafka1 /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka1:9092 --describe --topic orders

# Kill one broker and check that the topic still works
docker compose stop kafka2
docker compose exec kafka1 /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server kafka1:9092 --describe --topic orders   # leaders moved, ISR shrank to 2
docker compose start kafka2
```

> ⚠️ **Advertised listeners** are the #1 cause of "I can connect but nothing works". The broker tells clients which address to use next. If it advertises `kafka1:9092` to an app outside Docker, the app can't resolve that name. Advertise an address the **client** can reach.

## Settings that matter

| Setting | Recommended | Why |
| --- | --- | --- |
| `default.replication.factor` | `3` | Survive the loss of a broker |
| `min.insync.replicas` | `2` | With `acks=all`, a write needs 2 copies before it's confirmed |
| Producer `acks` | `all` | Don't lose confirmed writes |
| `unclean.leader.election.enable` | `false` | Never promote an out-of-date replica (avoids silent data loss) |
| `auto.create.topics.enable` | `false` | Topics are created deliberately with the right settings |
| `log.retention.hours` / `retention.bytes` | Per topic | Controls disk usage |
| `num.partitions` | Choose per topic | More partitions = more parallel consumers, but more overhead |

## Sizing and Linux tuning

Kafka is mostly limited by **disk and network**, not CPU.

| Resource | Guidance |
| --- | --- |
| **Disk** | Fast SSD/NVMe; size = daily data × retention days × replication factor × ~1.3 headroom. Use XFS or ext4 |
| **Memory** | JVM heap 4 to 8 GB is plenty; leave the **rest of RAM for the OS page cache**, which Kafka relies on heavily |
| **Network** | Replication multiplies traffic: 100 MB/s in with RF 3 means ~200 MB/s between brokers, plus consumers |
| **CPU** | Moderate; more needed for TLS and compression |

Example disk math: 50 GB/day × 7 days × 3 replicas × 1.3 ≈ **1.4 TB across the cluster**, about 470 GB per broker.

OS settings (`/etc/sysctl.d/99-kafka.conf` and limits):

```bash
vm.swappiness=1                    # avoid swapping the JVM
vm.max_map_count=262144            # many log segments are memory-mapped
net.core.somaxconn=4096
fs.file-max=1000000
```

```ini
# systemd service override: Kafka opens many files (one per segment + connections)
[Service]
LimitNOFILE=200000
```

Mount data disks with `noatime`, put data on **separate disks** from the OS, and spread brokers across **availability zones or racks** (`broker.rack`) so replicas don't share a failure.

## Security

By default Kafka has **no encryption and no authentication**. Anyone who can reach port 9092 can read and write everything.

| Layer | How |
| --- | --- |
| **Network** | Private subnet only; firewall allows 9092/9093 from app servers, never the internet |
| **Encryption** | TLS listeners (`SSL` or `SASL_SSL`) |
| **Authentication** | SASL/SCRAM (username + password), mTLS (client certificates), or OAuth |
| **Authorization** | ACLs: service `orders-api` may write `orders`; `billing` may read `orders` |

```bash
# Allow the billing service's consumer group to read the orders topic
kafka-acls.sh --bootstrap-server kafka1:9093 --command-config admin.properties \
  --add --allow-principal User:billing --operation Read \
  --topic orders --group billing-service
```

Store credentials in your secret manager (Vault, AWS Secrets Manager, Kubernetes Secrets), not in Git.

## Monitoring: what to alert on

Kafka exposes metrics over **JMX**. Use the Prometheus JMX exporter (or `kafka-exporter` for consumer lag) and Grafana.

| Metric | Alert when | Meaning |
| --- | --- | --- |
| **Under-replicated partitions** | > 0 for several minutes | A broker is down or too slow; data has fewer copies than planned |
| **Offline partitions** | > 0 | Some data can't be read or written. **Page someone** |
| **Active controller count** | ≠ 1 across the cluster | Metadata/controller problem |
| **Consumer lag** | Growing steadily | Consumers can't keep up; scale them or fix a slow consumer |
| **Disk usage** | > 75% | Retention too long or traffic grew; Kafka stops when the disk fills |
| **Request latency (p99)** | Rising | Disk, network or GC trouble |
| **ISR shrink/expand rate** | Frequent | Flapping brokers or network issues |

```bash
# Check consumer lag by hand
kafka-consumer-groups.sh --bootstrap-server kafka1:9092 \
  --describe --group billing-service
# LAG column = messages waiting to be processed per partition
```

> 💡 **Consumer lag** is the most useful single number for app teams: it tells you if the system is keeping up, regardless of message rate.

## Kafka in CI/CD: topics as code

Don't create topics by hand in production. Define them in Git and apply them from the pipeline, the same way you treat infrastructure.

Option 1, **Terraform** (Kafka provider):

```hcl
resource "kafka_topic" "orders" {
  name               = "orders"
  partitions         = 6
  replication_factor = 3
  config = {
    "retention.ms"        = "604800000"   # 7 days
    "min.insync.replicas" = "2"
    "cleanup.policy"      = "delete"
  }
}
```

Option 2, on Kubernetes with the **Strimzi** operator:

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: orders
  labels:
    strimzi.io/cluster: my-cluster
spec:
  partitions: 6
  replicas: 3
  config:
    retention.ms: 604800000
    min.insync.replicas: 2
```

A Jenkins stage (lessons 15 and 16) or GitHub Actions job runs `terraform plan` on PRs and `terraform apply` after merge, so every topic change is reviewed.

Testing apps that use Kafka in CI: start a real broker in the pipeline with **Testcontainers** or a `docker compose` service, run integration tests against it, then throw it away.

```groovy
stage('Integration tests') {
    steps {
        sh 'docker compose -f docker-compose.test.yml up -d kafka'
        sh 'npm run test:integration'
    }
    post { always { sh 'docker compose -f docker-compose.test.yml down -v' } }
}
```

Also consider **schema compatibility checks** in CI: the Schema Registry can reject a new event schema that would break existing consumers before it ever reaches production.

## Rolling upgrades and maintenance

Kafka can be upgraded **without downtime**, one broker at a time:

1. Check that **under-replicated partitions = 0**.
2. Stop **one** broker gracefully (`controlled.shutdown` moves leadership away first).
3. Upgrade its binaries or image, start it.
4. Wait until it has caught up (under-replicated back to 0).
5. Repeat for the next broker. Upgrade controllers before brokers if they are separate.
6. After all nodes run the new version, bump the metadata version (`kafka-features.sh upgrade`).

Other routine jobs:

| Task | Tool |
| --- | --- |
| Add a broker and move data to it | `kafka-reassign-partitions.sh` or Cruise Control |
| Rebalance leaders | `kafka-leader-election.sh --election-type preferred` |
| Increase partitions | `kafka-topics.sh --alter --partitions N` (can't decrease; changes key-to-partition mapping) |
| Reset a consumer group's offsets | `kafka-consumer-groups.sh --reset-offsets` (stop consumers first) |
| Disaster recovery to another region | MirrorMaker 2 or Cluster Linking (Confluent) |

## Self-hosted or managed?

| Option | You manage | Good for |
| --- | --- | --- |
| **VMs + systemd** | Everything | Full control, on-premises |
| **Docker Compose** | Everything, simpler packaging | Dev, staging, small installs |
| **Kubernetes + Strimzi** | Cluster; operator handles rolling upgrades, certs, topics | Teams already on Kubernetes |
| **AWS MSK** | Topics, clients, scaling choices | AWS users; MSK Serverless for low ops |
| **Confluent Cloud** | Topics and clients only | Least ops work, rich ecosystem |
| **Redpanda / Aiven / others** | Varies | Kafka-compatible alternatives |

> 💡 Running Kafka well takes real time and skill. If your team is small and data volumes are modest, a **managed service** (or a simpler queue like RabbitMQ or SQS) is often the right call.

## Key takeaways

- Kafka is a **backend/data platform**, not a DevOps tool, but **operating** it is classic DevOps work.
- Run **3+ brokers** with KRaft (no ZooKeeper since Kafka 4.0), replication factor 3, `min.insync.replicas=2`, `acks=all`.
- Kafka needs fast disks, lots of page cache and good networking; get **advertised listeners** right.
- Turn on **TLS, authentication and ACLs**; keep brokers off the public internet.
- Alert on **under-replicated/offline partitions, consumer lag and disk**.
- Manage topics as code in CI/CD, upgrade one broker at a time, and consider managed Kafka.

## Try it yourself

Start the 3-broker Compose cluster, create the `orders` topic, produce some messages with `kafka-console-producer.sh`, then stop one broker and confirm you can still produce and consume. Open Kafka UI on port 8081 and watch the partition leaders move.
