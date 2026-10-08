---
title: "Domains, Load Balancers and HTTPS"
summary: "Follow a browser request from a domain name to healthy app copies, with AWS-managed HTTPS certificates."
level: Beginner
tags: [aws, elb, alb, route53, dns, acm, tls]
---

## The web request path

```mermaid
flowchart LR
    B[Browser: app.example.com] --> D[Route 53 DNS]
    D --> A[Application Load Balancer]
    A --> T[Healthy app target]
```

**Route 53** answers “where is this domain?” An **Application Load Balancer (ALB)** receives web traffic and sends it to a healthy app copy.

## The ALB words

| Word | Meaning |
| --- | --- |
| **Listener** | A port and protocol, commonly HTTPS 443 |
| **Rule** | Routing choice, such as `/api/*` → API service |
| **Target group** | The list of app copies that can receive traffic |
| **Health check** | URL the ALB calls to decide if a target is usable |

The load balancer sends traffic only to healthy targets. Your health endpoint should be fast and truthful.

## HTTPS with ACM

AWS Certificate Manager (ACM) can issue public TLS certificates at no extra charge for supported AWS integrations. Request a certificate for your domain, validate ownership by DNS, then attach it to the HTTPS listener.

For a CloudFront distribution, request the certificate in `us-east-1`. For a regional ALB, request it in the ALB’s Region.

## Route 53 record

Use an alias record to point `app.example.com` to an ALB or CloudFront distribution. The user sees the domain; AWS routes them to the current infrastructure.

## Remember this

- Route 53 maps names to destinations.
- ALB routes HTTP/HTTPS to healthy targets.
- ACM provides certificates; DNS validation proves domain ownership.
- Test the health endpoint and real public URL after deployment.
