---
title: Node.js, Express and NestJS
summary: How JavaScript server runtimes and frameworks fit together.
level: Intermediate
tags: [languages, nodejs, express, nestjs]
---

# Node.js, Express and NestJS

Node.js runs JavaScript outside the browser and handles I/O asynchronously. Express is a small HTTP framework: you assemble routes and middleware yourself. NestJS adds modules, dependency injection, controllers, providers, guards, pipes and interceptors for larger TypeScript backends.

```ts
// Express: a route handler
app.get("/health", (_req, res) => res.json({ ok: true }));

// NestJS: controller route
@Controller("health")
export class HealthController { @Get() check() { return { ok: true }; } }
```

Use middleware for cross-cutting HTTP work, guards for authorization, pipes for validation/transformation and exception filters for consistent errors. Always validate request data at the boundary, await asynchronous work, use environment variables for configuration and add health checks and structured logs.
