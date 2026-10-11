---
title: "VPC Endpoints, Transit Gateway and Hybrid Networking"
summary: "Keep traffic private, cut NAT costs, connect many VPCs, link to on-premises networks, and troubleshoot with flow logs."
level: Intermediate
tags: [aws, vpc, privatelink, vpc-endpoint, transit-gateway, vpn, direct-connect, flow-logs]
---

## Keep AWS traffic off the internet

By default, a private subnet reaches S3 or DynamoDB through a **NAT gateway**, which costs money per hour and per GB. **VPC endpoints** give a private path instead.

| Endpoint type | Used for | Cost |
| --- | --- | --- |
| **Gateway endpoint** | S3 and DynamoDB only | Free |
| **Interface endpoint** (PrivateLink) | Most other AWS services and third-party services | Hourly plus per GB |

```mermaid
flowchart LR
    subgraph VPC
      A[App in private subnet]
    end
    A -->|gateway endpoint, free| S3[(S3)]
    A -->|interface endpoint ENI| SM[Secrets Manager / ECR / SQS]
    A -.->|NAT gateway, paid| I[Internet]
```

Consider an S3 gateway endpoint for VPCs that access S3. ECR image pulls can also require ECR API and registry connectivity; an S3 endpoint alone does not establish the entire private image-pull path.

Endpoint policies restrict what can be done through an endpoint:

```json
{
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": ["s3:GetObject"],
    "Resource": "arn:aws:s3:::shop-assets/*"
  }]
}
```

Combine with a bucket policy using `aws:SourceVpce` so the bucket is reachable only through your endpoint.

## Security groups versus network ACLs

| | Security group | Network ACL |
| --- | --- | --- |
| Level | Network interface | Subnet |
| State | **Stateful** (return traffic allowed) | **Stateless** (allow both directions) |
| Rules | Allow only | Allow and deny, evaluated by number |
| Typical use | Main control | Coarse guardrail or blocking an IP range |

Tip: reference **another security group** as the source, such as "port 5432 from `sg-app`", instead of IP ranges.

## Connecting VPCs

| Option | Good for | Limits |
| --- | --- | --- |
| **VPC peering** | A few VPCs, simple 1:1 links | Not transitive; CIDRs cannot overlap |
| **Transit Gateway** | Many VPCs and on-premises, hub and spoke | Hourly and per-GB cost |
| **PrivateLink** | Expose **one service** to other VPCs or accounts | One direction, no CIDR overlap problem |

```mermaid
flowchart TD
    TGW((Transit Gateway))
    TGW --- V1[VPC prod]
    TGW --- V2[VPC staging]
    TGW --- V3[VPC shared services]
    TGW --- VPN[Site-to-Site VPN / Direct Connect]
```

Plan non-overlapping **CIDR ranges** from day one. Overlaps are painful to fix later.

## Hybrid connectivity

| Option | Notes |
| --- | --- |
| **Site-to-Site VPN** | Encrypted over the internet; fast to set up; two tunnels for redundancy |
| **Direct Connect** | Dedicated private link; consistent latency; takes weeks to provision |
| **VPN over Direct Connect** or a second connection | Redundancy and encryption |

Use **Route 53 Resolver** inbound and outbound endpoints to resolve DNS names across AWS and on-premises.

## IPv6 and egress

An **egress-only internet gateway** lets IPv6 instances reach out without accepting inbound connections, without IPv4-style address translation. Consider one NAT gateway per AZ for resilience, balanced against cost in non-production.

## Troubleshooting with VPC Flow Logs

Flow logs record accepted and rejected traffic per network interface.

```text
version account-id interface-id srcaddr dstaddr srcport dstport protocol packets bytes start end action log-status
2 123456789012 eni-0abc 10.0.1.5 10.0.2.9 51234 5432 6 10 840 1700000000 1700000060 REJECT OK
```

A `REJECT` on port 5432 points at a security group or NACL. Query logs in S3 with Athena or in CloudWatch Logs Insights.

**Reachability Analyzer** traces a path between two resources and tells you which component blocks it, without sending packets.

Checklist when "it cannot connect":

1. Route table of the source subnet has a route to the target.
2. Security group on both ends allows the port.
3. NACLs allow both directions, including ephemeral return ports.
4. DNS resolves to the expected private IP.
5. The service is listening on the right interface and port.

## Worked private-service path: a task reads a secret

A private app calls the Secrets Manager regional hostname over HTTPS. With an interface endpoint and private DNS configured, that hostname resolves to endpoint network-interface addresses in your VPC. The task needs a reachable endpoint, an endpoint security group allowing port 443 from the task, and appropriate IAM and resource permissions.

An endpoint does not grant access by itself. Its policy restricts the path; the workload still needs authorization. See [interface endpoint configuration](https://docs.aws.amazon.com/vpc/latest/privatelink/interface-endpoints.html).

### Diagnose by separating DNS, TCP, and authorization

| Symptom | Likely area to investigate |
| --- | --- |
| Hostname resolves to unexpected addresses | Private DNS and VPC DNS settings |
| HTTPS connection times out | Endpoint placement, groups, ACLs, and routes |
| AWS returns AccessDenied | Identity, resource, endpoint, and key policies |
| Image pull fails but secret retrieval works | ECR-related dependencies and their network paths |

Use the actual task's network environment. Successful access from a developer laptop does not prove private subnet access.

### Transit Gateway: routing is not automatic isolation

Imagine production, staging, and shared-services VPCs. Document which pairs should communicate before creating attachments. Separate route-table association and propagation decisions so staging is not accidentally granted a production path. Check return routes as well as the initial direction.

PrivateLink is useful when you want to expose a service rather than share general network reachability. Peering and Transit Gateway connect networks and require broader route planning.

### Exercise and cleanup

Draw the private path to a secret, an S3 object, and a third-party API. Name the endpoint or egress mechanism for each. Inspect a lab's endpoint DNS, security groups, and policy separately, then remove unused interface endpoints, NAT gateways, logs, and dedicated attachments after the lab. Compare the costs of the architecture using current regional prices rather than assuming every private path is cheaper.

## Remember this

- Evaluate gateway endpoints for S3 and DynamoDB where their routing and policy fit the workload.
- Peering is not transitive; Transit Gateway scales hub and spoke; PrivateLink shares one service.
- Security groups are stateful; NACLs are stateless.
- Use Flow Logs and Reachability Analyzer instead of guessing.
