---
title: AI Specialties and Real-World Examples
summary: "Explore vision, language, speech, recommendations, anomaly detection, forecasting, reinforcement learning, and generative systems."
level: Intermediate
tags: [ai, computer-vision, nlp, recommendations, reinforcement-learning]
---

## Choose a branch by its input and outcome

The AI field is too broad to master in one project. Learn shared foundations, then select a specialty that fits a problem you can evaluate. The following map covers major application areas; it is not an exhaustive list of research topics.

| Area | Input → output | Practical example | What to learn |
| --- | --- | --- | --- |
| Computer vision | Pixels → labels, boxes, or masks | Detect damaged parcels | Image preprocessing, CNNs, vision transformers, augmentation |
| Natural language processing | Text → labels or structured information | Route tickets to teams | Tokenization, classification, embeddings, transformers |
| Speech | Audio → text, or text → audio | Transcribe a recorded meeting | Sampling, spectrograms, speech recognition, synthesis |
| Recommendations | User and item history → ranked items | Suggest relevant books | Ranking, collaborative filtering, cold start, feedback bias |
| Forecasting | Past observations → future estimates | Forecast daily orders | Temporal splits, seasonality, lag features, uncertainty |
| Anomaly detection | Observations → unusualness score | Flag unexpected server behavior | Baselines, unsupervised methods, alert thresholds |
| Reinforcement learning | State and reward → action policy | Control a simulated robot | Environments, rewards, exploration, policy evaluation |
| Generative systems | Prompt or context → new content | Draft an explanation or product image | Model conditioning, quality checks, content evaluation |

## Vision: classification is different from detection

Image classification gives an image a label, such as “damaged.” Object detection finds locations and categories, such as boxes around damaged regions. Segmentation assigns a category to individual pixels. Choose the output your workflow actually needs.

For a warehouse camera, split data by relevant conditions such as camera or capture period. Near-duplicate frames in training and test can exaggerate performance. Evaluate under dim light and different packaging, not only clean sample photographs.

## Language and speech: measure the actual task

A ticket classifier can return a category, while an extraction system identifies fields such as order ID and requested action. Generating a response is a separate task. Score classification against labels and extraction against verified fields.

A speech pipeline might transcribe audio, identify speakers, then summarize text. Errors in names or amounts can propagate into the summary. Word error rate helps measure transcription, but also check task-critical fields and the relevant languages or accents.

## Recommendations: feedback is part of the system

A bookstore can start with popular titles or shared genres. A learned ranker can use browsing history and item relationships later. Clicks are influenced by what users were shown, so they are not unbiased evidence of preference.

Evaluate ranking quality on held-out interactions and check new users, new books, and diversity. Offline ranking metrics do not automatically prove that a change improves the user experience.

## Forecasting: keep time in order

To predict tomorrow's demand, train on earlier dates and evaluate on later dates. Features might include weekday and recent order counts. A simple baseline predicts the same weekday from the previous week.

Avoid randomly mixing future observations into training when the deployed task predicts the future. Check errors during holidays and demand spikes separately; an overall average can hide operationally important failures.

## Reinforcement learning: the reward defines behavior

An agent selects an action, receives a reward, and observes the next state. A warehouse robot might earn reward for successful placement and lose reward for collisions.

If you reward only speed, the learned behavior may become unsafe. Start in a simulation with explicit constraints and compare to a deterministic policy. This approach differs from an LLM agent calling application tools, even though both use the word “agent.”

## Try it yourself

Pick one branch. Write a one-page project brief with the input, output, baseline, data source, split strategy, metric, and three failure cases. If you cannot describe how you will judge the result, narrow the problem before selecting an architecture.

## Key takeaways

- Similar AI terminology can describe very different tasks and outputs.
- Data splits and metrics should match the way the system will be used.
- A specialty becomes easier to learn when attached to a small measurable project.
