---
title: Python and Math Foundations with Runnable Examples
summary: "Practice features, vectors, normalization, similarity, probability, and evaluation with Python's standard library."
level: Beginner
tags: [ai, python, math, vectors, hands-on]
---

## What you need

These exercises use Python 3 and its standard library: no account, paid API, or third-party package is needed. Save each complete code block to its own file and run it with `python3 filename.py`.

Learn functions, lists, dictionaries, files, exceptions, and basic tests first. SQL helps you select training examples; HTTP and JSON help you integrate models into an application. A web developer can keep a TypeScript frontend while using Python for model experiments.

## Features are measurable inputs

A delivery might have distance, number of items, and rain as features. A **vector** is an ordered list of numbers. The order matters: swapping rain and distance changes the meaning.

```python
features = [8.0, 3.0, 1.0]  # distance_km, item_count, rain_indicator
weights = [2.0, 0.5, 4.0]
bias = 5.0

prediction = sum(x * w for x, w in zip(features, weights)) + bias
print(prediction)  # 26.5 minutes
```

This is a linear model with illustrative weights chosen by us. Training would estimate weights from examples. The dot product multiplies matching components and adds them; the bias supplies an offset.

## Normalize using training data

Features measured in very different units can make some optimization methods harder to use. Standardization transforms a value using a training mean and standard deviation.

```python
from statistics import mean, pstdev

training_distances = [2.0, 4.0, 6.0, 8.0]
center = mean(training_distances)
scale = pstdev(training_distances)

def transform(distance):
    return (distance - center) / scale if scale else 0.0

print(round(transform(6.0), 3))  # 0.447
print(round(transform(10.0), 3))  # 2.236
```

Keep `center` and `scale` with the model. Use those same values for future data. Recomputing them using test data or each incoming batch changes the representation and can introduce leakage.

## Compare vectors with cosine similarity

Cosine similarity compares direction. It divides a dot product by both vector lengths. For nonzero vectors, its range is from -1 to 1. It is a geometric score, not a probability of correctness.

```python
from math import sqrt

def cosine(left, right):
    if len(left) != len(right):
        raise ValueError("Vector dimensions must match")
    dot = sum(a * b for a, b in zip(left, right))
    lengths = sqrt(sum(a * a for a in left)) * sqrt(sum(b * b for b in right))
    return dot / lengths if lengths else 0.0

print(round(cosine([1, 1, 0], [1, 0, 0]), 3))  # 0.707
print(cosine([1, 0], [0, 1]))  # 0.0
```

Real text embeddings are learned representations. These hand-written vectors demonstrate the calculation without pretending to provide semantic understanding.

## Count classification mistakes

Suppose a fraud detector raises five alerts, of which three are actual fraud, and misses one additional fraudulent payment.

```python
true_positive = 3
false_positive = 2
false_negative = 1

precision = true_positive / (true_positive + false_positive)
recall = true_positive / (true_positive + false_negative)
print(precision, recall)  # 0.6 0.75
```

Precision answers how many alerts are correct. Recall answers how much actual fraud was found. In production, handle zero denominators explicitly and report results for relevant classes and groups.

## What math should you learn next?

| Topic | Use in AI | Practice |
| --- | --- | --- |
| Vectors and matrices | Features, embeddings, layer operations | Dot products and shapes |
| Probability | Uncertainty and distributions | Conditional probability using counts |
| Statistics | Sampling and performance estimates | Mean, variance, confidence intervals |
| Derivatives | Direction of parameter updates | Differentiate a squared error |
| Optimization | Reduce training loss | Follow the next training lab |

## Try it yourself

Change the weights in the delivery example and explain why the prediction changes. Add a zero-vector case to the cosine example. Build a confusion matrix for a small labeled dataset and explain why high accuracy could hide poor recall.

## Key takeaways

- Features have names, units, and an order that must remain consistent.
- Fit preprocessing on training examples and reuse it at inference.
- Similarity, probability, and evaluation scores mean different things.
