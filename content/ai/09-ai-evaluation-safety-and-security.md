---
title: AI Evaluation, Safety, and Security
summary: Build representative tests, measure retrieval and model quality, defend against prompt injection, and handle sensitive data responsibly.
level: Advanced
tags: [ai, evaluation, safety, security]
---

## The big idea

AI behavior is probabilistic and can change with data, prompts, models, and settings. Reliable systems need repeatable evaluations, clear risk boundaries, and defenses around the model. A single successful demo is not evidence of production readiness.

## Build an evaluation set

Collect representative, permissioned examples that cover routine cases, edge cases, ambiguous input, and known failure modes. Keep evaluation examples separate from the examples used to tune prompts or models. Define what “good” means before reviewing outputs.

For a support-answering system, a rubric might check factual support, relevance, correct abstention when sources are missing, citation accuracy, and appropriate handling of private information. Score important dimensions separately rather than hiding tradeoffs in one average.

Automated checks are useful for exact formats, required fields, forbidden disclosures, and citation presence. Human review is important for nuanced quality and high-impact use. Model-based graders can help triage but may share the model's blind spots; calibrate them against human judgments.

## Evaluate the whole pipeline

For RAG, measure whether retrieval finds the right evidence and whether the final response uses that evidence correctly. For tool use, test argument validation, authorization, retries, timeouts, and harmful actions. Measure latency and cost alongside quality.

Test changes to the model, prompt, index, and preprocessing against a stable regression set. Monitor real-world aggregate signals and investigate failures with privacy-respecting traces.

## Security and privacy

- **Prompt injection:** user input or retrieved content may try to override instructions. Treat it as untrusted data, constrain tool access, and verify actions in code.
- **Sensitive data:** minimize what is sent to providers, follow retention and access policies, and avoid placing secrets in prompts or logs.
- **Output handling:** validate output before using it in SQL, HTML, shell commands, or business actions. Never treat generated content as executable or trusted by default.
- **Abuse and misuse:** apply authentication, rate limits, content controls appropriate to the use case, and escalation paths for high-risk requests.
- **Bias and impact:** examine performance across relevant groups and use human oversight where errors can affect people's rights, safety, or access to services.

No single prompt or filter solves these risks. Use defense in depth and define what the system must refuse, escalate, or leave to a human.

## Key takeaways

- Evaluate against representative, held-out examples and explicit acceptance criteria.
- Test retrieval, model output, tools, safety, latency, and cost as parts of one system.
- Treat prompts, retrieved content, and generated output as untrusted.
- Minimize sensitive data and use layered controls with human oversight appropriate to risk.