---
title: What Is Artificial Intelligence? A Developer's Guide
summary: "Understand AI, machine learning, deep learning, and generative AI through everyday examples and concrete software decisions."
level: Beginner
tags: [ai, foundations, examples, developer]
---

## Start with a familiar example

Imagine building an email application. You can write a rule that marks any message containing “win money” as spam. That is ordinary rule-based software. It will miss new wording and may block legitimate messages.

Alternatively, collect messages labeled spam or legitimate and train a model to recognize patterns. The resulting spam detector is a machine-learning application. It still needs ordinary software to authenticate users, read messages, display results, and collect corrections.

**Artificial intelligence (AI)** is the broad field of building systems that perform tasks associated with intelligence, such as recognizing patterns, reasoning, planning, understanding language, or choosing actions. AI includes both learned models and techniques such as symbolic rules and search. It does not imply human consciousness or reliable understanding.

## How the terms fit together

| Term | Meaning | Example |
| --- | --- | --- |
| AI | The broad field | A route planner searches possible paths |
| Machine learning (ML) | Models learn patterns from data | Predict late deliveries from historical orders |
| Deep learning (DL) | ML using multilayer neural networks | Recognize objects in photographs |
| Generative AI | Models generate content | Produce a draft answer or image |
| Large language model (LLM) | A large model for processing and generating language | Summarize support conversations |
| AI agent | An application loop that lets a model select actions | Look up an order through an authorized tool |

ML is part of AI, and deep learning is part of ML. Generative AI describes a capability; deep learning describes a family of methods. They overlap rather than forming completely separate categories. A chatbot is an interface, and can use rules, retrieval, a language model, or a combination.

## Training versus inference

**Training** adjusts a model's parameters using examples and an objective. **Inference** uses the fitted model on new input. Updating an application's prompt is not the same as training the model.

```text
Training:  past orders + actual delivery times → learning algorithm → model
Inference: new order + saved model → estimated delivery time
```

A prediction is an estimate, not a promise. Changes in traffic, customers, or data collection can reduce accuracy after deployment.

## When should a developer use AI?

| Requirement | First approach to try | Why |
| --- | --- | --- |
| Calculate an invoice total | Regular code | Exact arithmetic and business rules |
| Find an order by its ID | Database query | Exact lookup with access checks |
| Predict a delivery duration | Regression baseline | Learn a relationship from examples |
| Categorize customer messages | Rules, then classifier or LLM | Compare quality against complexity |
| Answer questions about a handbook | Search, then RAG if needed | Find evidence before generating |
| Execute a refund | Authorized business workflow | Money movement must follow enforced rules |

For a bookstore, a recommendation model can rank books, but SQL still checks stock and regular code calculates payment. Useful AI products combine probabilistic predictions with deterministic software.

## A developer's responsibilities

1. Define the task and the cost of a wrong answer.
2. Check whether a simple rule or query already solves it.
3. Obtain suitable data and define a baseline.
4. Evaluate on examples kept out of development decisions.
5. Validate outputs and enforce permissions in application code.
6. Monitor failures and provide a fallback.

## Try it yourself

Choose three features in an app you already know. Write down whether each requires exact rules, learned prediction, or generated content. For each AI feature, name one failure and a measurable success criterion.

Example: “Suggest a support category” can use a classifier. A wrong category sends a ticket to the wrong queue. Measure per-category precision and recall, and allow an agent to correct the suggestion.

## Key takeaways

- AI is broader than chatbots or language models.
- Training learns parameters; inference uses them.
- Use ordinary code for exact rules and enforce those rules around AI outputs.
- Begin with a task, baseline, and evaluation rather than choosing a model first.
