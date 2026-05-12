---
name: ocs-test-regression-guard
description: Behavior-proof skill for adding or strengthening targeted regression guards for important feature integrations and bug fixes.
---

# OCS Test + Regression Guard

## Use this skill when

- A new feature changes real behavior that users, APIs, installers, or runtime flows depend on.
- A bug fix must stay fixed and needs a regression guard.
- A refactor changes branching, state transitions, routing, persistence, or cross-file contracts.
- A release-critical change needs stronger confidence than ad-hoc manual checking.

## Primary owner job

- Own behavior-proof and regression-protection for important changes.
- Turn important behavior claims into explicit executable guards.

## What this skill does

- Defines the behavior contract before writing or changing tests.
- Maps the highest-risk regression surfaces.
- Adds or updates the nearest meaningful guard such as unit, integration, CLI, runtime smoke, or fixture-based assertions.
- Prefers narrow deterministic proof over broad vague coverage.

## What this skill does not do

- It does not apply to docs-only, copy-only, or formatting-only work.
- It does not replace final runtime proof when real target-environment validation is required.
- It does not justify adding broad tests that do not assert the changed behavior directly.

## When to combine with another skill

- Combine with `ocs-runtime-validation` when a behavior change also needs live target-environment proof.
- Do not substitute runtime proof with regression tests alone when the real risk is environment-sensitive behavior.

## Pass criteria

- The important changed behavior has at least one explicit regression guard.
- The protected behavior and the covered risk are named clearly.
- The verification commands are concrete.
- The chosen test surface matches the actual risk instead of the easiest nearby file.

## Guard design heuristics

- For feature integration:
  - cover one success path,
  - cover one boundary or unsupported path,
  - cover one persistence or configuration invariant if state is involved.
- For bug fixes:
  - reproduce the old failure with a fixture or assertion,
  - prove the fixed behavior,
  - keep the test name explicit about the regression being prevented.
- For runtime/install flows:
  - add deterministic setup/unit guards first,
  - then add live smoke only when the code path truly depends on the real environment.

## Anti-patterns

- Adding broad tests that do not assert the changed behavior directly.
- Declaring “covered by existing tests” without naming the exact existing guard.
- Shipping a bug fix with no reproduction or regression assertion when one is feasible.
- Using only manual QA for a behavior that can be checked deterministically.
- Writing a flaky end-to-end test when a stable narrower guard would prove the claim better.
