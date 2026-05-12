---
name: ocs-parallel-orchestration-grooming
description: Advanced orchestration skill for safe parallel sub-agent execution, monitoring, and context grooming.
---

# OCS Parallel Orchestration + Context Grooming

## Use this skill when

- The task has multiple independent workstreams such as exploration, implementation, verification, or docs.
- Throughput matters and parallel execution can reduce delivery time.
- The session is long-running and context growth can degrade response quality.

## Primary owner job

- Own advanced coordination for multi-stream work where parallel execution is genuinely beneficial.
- Keep sub-agents aligned, non-overlapping, and recoverable in long-running sessions.

## What this skill does

- Decomposes work into independent units with clear ownership.
- Launches sub-agents only when workstreams are safe to run in parallel.
- Tracks status, evidence, blockers, and next steps across sub-agents.
- Rebalances ownership when one unit is overloaded, blocked, or drifting.
- Grooms context so long sessions stay lean without losing decision-critical anchors.

## What this skill does not do

- It does not apply to trivial or single-path tasks.
- It does not make parallelization a default for ordinary work.
- It does not allow multiple agents to own the same editable scope at once.
- It does not replace final verification of the merged result.

## When to combine with another skill

- Combine with `ocs-test-regression-guard` when a parallelized implementation changes important behavior that needs explicit executable proof.
- Combine with `ocs-runtime-validation` when the orchestrated work changes runtime-sensitive behavior that must be proven in the target environment.

## Pass criteria

- Work is decomposed into independent units with one owner per unit.
- Parallelization is used only where coordination cost is lower than the speed gain.
- Evidence exists for each unit before outcomes are merged.
- Critical context anchors remain intact during grooming.
- The final merged result is verified end-to-end.

## Monitoring and load-balancing rules

- Track each agent by: unit, status, evidence, next step.
- Rebalance when one agent is overloaded or blocked.
- Prefer short feedback loops over large unsupervised runs.
- Escalate immediately when two agents report conflicting conclusions.

## Context grooming protocol

- Run periodic grooming for long sessions:
  - remove irrelevant artifacts,
  - summarize long threads into decision-grade bullets,
  - retain only active execution context.
- Never prune core execution anchors:
  - workflow steps,
  - rulesets/policies,
  - skillsets in use,
  - current approved plan and acceptance criteria.
- Keep context usage under ~50% whenever possible.
- Preserve recovery metadata (what was removed, why, where to restore).

## Anti-patterns

- Using this skill for a trivial one-path task.
- Parallelizing dependent steps without synchronization.
- Letting multiple agents edit the same scope at the same time.
- Keeping stale context that no longer affects the execution path.
- Merging outputs before each critical unit has evidence.
