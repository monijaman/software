---
title: Train Your First Model from Scratch
summary: "Run a complete linear-regression experiment, compare a baseline, inspect loss, and evaluate on unseen examples."
level: Beginner
tags: [ai, python, regression, training, hands-on]
---

## The problem

Estimate delivery minutes from distance in kilometers. We will learn a slope and intercept for `minutes = slope × distance + intercept`. This small synthetic dataset demonstrates the training process; it is not evidence that a real delivery business can be modeled using distance alone.

Create `delivery_model.py`, paste the following complete program, and run `python3 delivery_model.py`. Only Python's standard library is required.

```python
from statistics import mean

# Synthetic training observations; later distances are held out.
train = [(1.0, 7.0), (2.0, 9.0), (3.0, 11.0), (4.0, 13.0)]
test = [(5.0, 15.0), (6.0, 17.0)]

slope, intercept = 0.0, 0.0
learning_rate = 0.01

def mse(rows, predict):
    return mean((predict(x) - y) ** 2 for x, y in rows)

for epoch in range(4000):
    errors = [(x, slope * x + intercept - y) for x, y in train]
    slope_gradient = 2 * mean(x * error for x, error in errors)
    intercept_gradient = 2 * mean(error for _, error in errors)
    slope -= learning_rate * slope_gradient
    intercept -= learning_rate * intercept_gradient

    if epoch in (0, 99, 999, 3999):
        loss = mse(train, lambda x: slope * x + intercept)
        print(f"epoch={epoch + 1}, training_mse={loss:.4f}")

baseline = mean(y for _, y in train)
baseline_error = mse(test, lambda x: baseline)
model_error = mse(test, lambda x: slope * x + intercept)

print(f"slope={slope:.3f}, intercept={intercept:.3f}")
print(f"baseline_test_mse={baseline_error:.3f}")
print(f"model_test_mse={model_error:.3f}")
print(f"prediction_for_7km={slope * 7 + intercept:.2f} minutes")
```

## Understand each step

1. **Initialize:** start with zero-valued parameters.
2. **Predict:** calculate minutes using the current slope and intercept.
3. **Measure error:** subtract the observed minutes from each prediction.
4. **Calculate gradients:** estimate how changing each parameter changes mean squared error.
5. **Update:** subtract the learning rate times the gradient.
6. **Evaluate:** compare the trained model and baseline on held-out rows.

The slope should approach 2 and the intercept 5. The training-average baseline is 10 minutes, giving test MSE of 37. The trained model's test MSE should be close to zero because this synthetic data follows an exact straight line.

## Why square the error?

Mean squared error averages the squared prediction differences. Squaring prevents positive and negative errors from canceling and penalizes larger misses more strongly. It has units of minutes squared here. Mean absolute error would be easier to read directly in minutes.

For one example, squared error is `(slope × x + intercept - y)²`. Its derivative with respect to slope is `2 × x × error`, and with respect to intercept is `2 × error`. Averaging those derivatives gives the gradients in the program.

## Turn the toy into a trustworthy experiment

Actual delivery times depend on traffic, weather, pickup delays, and route conditions. Add representative data before adding a bigger model. Keep future information, such as actual arrival time, out of input features.

Use separate training, validation, and test sets. Choose learning rate and other settings using validation data. Once you repeatedly inspect this example's test results to change your model, those rows no longer provide an independent final estimate.

## Exercises

- Add small positive and negative noise to training times. Explain why loss no longer approaches zero.
- Increase the learning rate substantially. Watch for unstable loss; restore a smaller value.
- Replace the target with a curved relationship and compare errors at different distances.
- Calculate mean absolute error alongside MSE.
- Predict at 100 kilometers. Explain why extrapolation outside observed distances deserves extra caution.

## Key takeaways

- Training is a repeated predict, measure, differentiate, and update loop.
- Compare against a baseline on examples the model did not train on.
- A perfect result on synthetic data is a learning demonstration, not production validation.
