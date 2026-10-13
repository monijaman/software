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

The load balancer normally routes to healthy targets. If every registered target is unhealthy, it can fail open and route to unhealthy targets; monitor target health rather than treating health checks as a complete safety gate. Your health endpoint should be fast and truthful.

## HTTPS with ACM

AWS Certificate Manager (ACM) manages TLS certificates for supported AWS integrations. Request a certificate for your domain, validate ownership by DNS, then attach it to the HTTPS listener. Check current pricing for the certificate type and features you select.

For a CloudFront distribution, request the certificate in `us-east-1`. For a regional ALB, request it in the ALB’s Region.

## Route 53 record

Use an alias record to point `app.example.com` to an ALB or CloudFront distribution. The user sees the domain; AWS routes them to the current infrastructure.

## DNS, routing, and encryption do different jobs

Think of Route 53 as a directory giving you the shop's address, the ALB as a receptionist forwarding you to an available cashier, and TLS as protection for the conversation between your browser and the receptionist.

DNS normally answers a lookup; it does not relay every byte of the webpage. Once the browser learns the endpoint address, it connects to the endpoint. This explains why a correct DNS record does not fix an unhealthy app.

## Concrete shop routing

Suppose a website and API share `shop.example.com`:

| Listener rule | Target group | Target port |
| --- | --- | --- |
| `/api/*` | Order API | 8080 |
| Default | Website | 3000 |

Listener rules select a destination by path or hostname. A target group contains destinations and health-check settings. A listener is the public port/protocol on the ALB, typically HTTPS 443.

For a Fargate task using `awsvpc` networking, the target group normally uses IP targets. For EC2 routing, the target type depends on how the app is deployed. Pick it to match the workload rather than copying a random tutorial.

## A beginner health endpoint

Here is a tiny Python web server you can run locally to understand the contract. It uses only Python's standard library; it is not a production web server.

```python
from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            payload = {"status": "ok"}
        elif self.path == "/api/books":
            payload = {"books": ["Cloud Basics", "Python Basics"]}
        else:
            self.send_response(404)
            self.end_headers()
            return
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

HTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
```

Save as `app.py`, run `python3 app.py`, then use:

```bash
curl -i http://127.0.0.1:8080/health
curl -i http://127.0.0.1:8080/api/books
```

**Expected result:** both requests return HTTP 200 and JSON. In AWS, configure the API target group's health-check path as `/health` and allow its port from the ALB group. A health check should not require customer authentication or perform slow work.

## Add HTTPS step by step

You need control of a domain's DNS records, an ALB with healthy targets, and permission to manage certificates. Domain registration, DNS hosting, and load balancing can incur charges.

1. Request an ACM public certificate for `shop.example.com` in the ALB's Region.
2. Publish the DNS validation record in the domain's DNS provider.
3. Wait for certificate issuance.
4. Add an HTTPS listener on 443 using the certificate.
5. Redirect the HTTP listener on 80 to HTTPS if exposing HTTP.
6. Create a Route 53 alias to the ALB, or use your DNS provider's supported record pattern.
7. Test `https://shop.example.com/health` and a real API route.

An ACM certificate for CloudFront is requested in `us-east-1`; a regional ALB certificate belongs in that ALB's Region. An HTTPS listener encrypts the browser-to-ALB connection. If policy requires encryption to the backend too, configure HTTPS targets separately.

## Diagnose by symptom

| Symptom | Likely place to inspect |
| --- | --- |
| Domain does not resolve | DNS records and authoritative nameservers |
| Certificate name mismatch | Requested domain names and attached certificate |
| ALB returns an error with no usable targets | Target health and registration |
| Browser hangs | Security groups, routes, and target listening port |
| `/health` works but `/api/books` fails | Listener rule, application route, and app logs |

If a target group has no healthy targets, do not assume the system safely stops all requests; ALB behavior can include routing to unhealthy targets when all registered targets are unhealthy. Use alarms and a deployment readiness gate.

**Practice:** your app serves `/health`, but the target group checks `/`. What might happen? A 404 at `/` can mark the target unhealthy even though `/health` is fine. Fix the health path and verify its expected status.

Further reading: [ALB health checks](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html), [ACM DNS validation](https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html).

## A health-check failure is a routing investigation

Suppose `/books` works when called on the app machine but the public endpoint fails. Inspect the target group's health status and reason before changing DNS. Common explanations include the wrong target port, a security-group rule missing the ALB source, a process bound to localhost, or a health endpoint returning an unexpected status.

| Observation | Next investigation |
| --- | --- |
| Name does not resolve | Hosted zone, delegation, and record |
| TLS hostname mismatch | Certificate names and listener attachment |
| No healthy targets | Target registration, port, path, and allowed traffic |
| Application error response | App logs and dependencies with a request ID |
| Slow response | Target latency, saturation, and downstream calls |

A health endpoint should indicate whether a target can serve its intended traffic. If every target fails because a shared dependency has a brief issue, aggressive replacement can worsen the incident. Decide deliberately which dependency checks belong in readiness and how clients receive a degraded response.

**Exercise:** Deploy a new application version in a lab with a deliberately incorrect health path. Observe why it receives no traffic, restore the path, then verify target health before testing the public hostname. This separates deployment readiness from DNS propagation.

## Remember this

- Route 53 maps names to destinations.
- ALB routes HTTP/HTTPS to healthy targets.
- ACM provides certificates; DNS validation proves domain ownership.
- Test the health endpoint and real public URL after deployment.
