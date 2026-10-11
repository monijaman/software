---
title: "Serverless: Lambda and API Gateway"
summary: "Run small event-driven code without managing servers, expose it through an HTTP API, and handle retries safely."
level: Beginner
tags: [aws, lambda, api-gateway, serverless, sam, dynamodb]
---

## What serverless means here

With Lambda, you upload a function. AWS runs it when an event arrives and charges for the time it runs. You still write, test, secure, and monitor the code; AWS manages the servers.

```mermaid
flowchart LR
    B[Browser] --> G[API Gateway]
    G --> L[Lambda function]
    L --> D[DynamoDB or another service]
```

## The important settings

| Setting | Plain meaning |
| --- | --- |
| **Memory** | RAM; more memory also gives more CPU |
| **Timeout** | Longest one invocation may run |
| **Concurrency** | How many invocations may run at once |
| **Role** | AWS permissions the function has |

Set a timeout deliberately. A function that waits forever wastes money and makes failures harder to understand.

## API Gateway

API Gateway receives HTTP requests, optionally checks authentication, then calls Lambda. Use HTTP APIs for many simple APIs; use REST APIs when you specifically need their extra features.

Do not forget CORS when a browser frontend calls your API from a different domain.

## Retries require idempotency

AWS can retry some event deliveries. Your handler must handle the same event more than once without creating duplicate charges, emails, or records. Use a stable event ID or idempotency key stored with the result.

For failed asynchronous work, configure a dead-letter queue or failure destination so messages are not silently lost.

## When not to use Lambda

Choose a container or server for long-running connections, very long jobs, specialized runtime needs, or consistently high work where a service is easier to operate.

## Serverless through a small book lookup

An API route `GET /books/42` does not need a permanently running server process in this example. API Gateway receives the request and invokes Lambda. Lambda reads its inputs and returns a response. AWS manages execution capacity, while you still own application correctness and permissions.

“Serverless” does not mean there are no servers or that code runs indefinitely. It means you do not provision the underlying server fleet for this function.

## Write a complete beginner handler

Create a Lambda function with a currently supported Python runtime. Use the handler name `lambda_function.lambda_handler` and save this as `lambda_function.py`:

```python
import json

BOOKS = {
    "42": {"id": "42", "title": "Cloud Basics", "price_cents": 2500},
    "43": {"id": "43", "title": "Python Basics", "price_cents": 1800},
}

def reply(status, payload):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload),
    }

def lambda_handler(event, context):
    book_id = (event.get("pathParameters") or {}).get("id")
    if not book_id:
        return reply(400, {"error": "Book ID is required"})
    book = BOOKS.get(book_id)
    if book is None:
        return reply(404, {"error": "Book not found"})
    return reply(200, book)
```

This is a stateless, read-only exercise with in-memory sample data. Do not use the module dictionary as a production database; execution environments can disappear or be replicated.

Test it in Lambda with:

```json
{
  "version": "2.0",
  "pathParameters": { "id": "42" }
}
```

**Expected result:** the handler returns `statusCode: 200` and a JSON string containing Cloud Basics. Test `id = "999"` for 404 and missing path parameters for 400.

## Connect API Gateway

Create an HTTP API with Lambda integration and route `GET /books/{id}`. Use the HTTP API payload format expected by the handler, authorize API Gateway to invoke this function, and deploy the route to a stage.

```bash
curl -i https://REPLACE_API_HOSTNAME/books/42
curl -i https://REPLACE_API_HOSTNAME/books/999
```

If your stage is named rather than `$default`, include its stage prefix in the URL. **Expected result:** the client receives an HTTP 200 or 404 with the matching response body.

For a public learning endpoint, expose only non-sensitive read-only data. Configure authentication before adding private customer data or writes. A Lambda execution role supplies the function's AWS permissions; it does not decide which customers may call the API.

If the browser calls from a different origin, configure API Gateway CORS for that frontend's origin, methods, and headers. Successful curl requests alone do not prove browser CORS is correct.

## Timeout, capacity, and cold starts

Select a short timeout suited to the operation. Memory allocation also affects CPU capacity, so benchmark time and cost together rather than assuming the smallest memory is cheapest.

Concurrency is simultaneous invocations. If 100 requests arrive together and each takes one second, the function may need many concurrent executions. Downstream databases and third-party APIs must tolerate the resulting traffic. Reserved concurrency can bound a function's concurrency; throttling still needs a client and retry strategy.

A new execution environment can require initialization, called a cold start. Keep startup work modest and reuse safe SDK/database client objects where appropriate. Never depend on local memory for durable coordination.

## Retry behavior depends on the caller

API Gateway does **not** automatically retry Lambda invocations. A browser or mobile client might retry a failed request. Asynchronous Lambda invocation and queue-based event sources have their own retry behavior.

For `POST /orders`, an idempotency key lets repeated attempts return the same accepted result rather than create another order. Persist that key and result in durable storage with a race-safe operation. A local Python set is not enough across execution environments.

**Cleanup:** delete the dedicated API, function, and unneeded lab log group. Check other created resources separately.

**Practice:** the handler passes a console test but API Gateway returns an error. Inspect invocation permission, handler logs, integration settings, route/stage, and response shape before changing unrelated database settings.

Further reading: [API Gateway Lambda errors and retries](https://docs.aws.amazon.com/lambda/latest/dg/services-apigateway-errors.html), [Lambda invocation retry behavior](https://docs.aws.amazon.com/lambda/latest/dg/invocation-retries.html).

## Follow a serverless order request

API Gateway receives a request and applies its configured routing and authorization. Lambda then validates the payload and business permissions, writes the order, and returns the configured response shape. Customer authentication does not remove the need for ownership checks.

Distinguish invocation sources. A synchronous HTTP request does not have the same retry behavior as an asynchronous event or an SQS event-source mapping. If a browser retries after a timeout, the first invocation may already have saved the order.

### Make duplicate submissions predictable

Require a stable idempotency key for one intended order. Persist that key with the result through a concurrency-safe operation. Repeated requests with the same key should return the established result; the same key with conflicting content should be rejected according to your API contract.

### Bound dependencies

Choose the function timeout to exceed the intended dependency timeouts plus application work, rather than allowing a database call to wait until the runtime terminates. Reuse initialized SDK clients where suitable, but never keep one customer's request state in shared globals.

**Exercise:** Draw the timeline when the database commits at second two but the client disconnects before receiving the answer. Explain why retrying a plain `INSERT` may create another order and how the stored idempotency result changes that behavior.

## Remember this

- Lambda runs code for events; API Gateway exposes it over HTTP.
- Memory, timeout, concurrency, and role are core settings.
- Assume events can be retried; make side effects idempotent.
- Use a queue or failure destination for work that must not disappear.
