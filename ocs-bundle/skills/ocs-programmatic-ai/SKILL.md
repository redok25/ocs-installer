---
name: ocs-programmatic-ai
description: Buyer-facing skill for invoking OpenCode programmatically from Go or scripts with structured prompts, machine-readable output, and safe automation patterns.
---

# OCS Programmatic AI

## Use this skill when

- A Go tool, script, worker, or CI step needs to call OpenCode without a human in the loop.
- You need structured JSON output from AI reasoning so downstream code can parse it deterministically.
- A workflow needs session continuity, repeated follow-up prompts, or server attach mode.
- You are building a domain-specific automation layer and need a reusable OpenCode invocation contract underneath it.

## Primary owner job

- Own the reusable invocation contract for programmatic OpenCode usage.
- Keep the automation pattern generic, portable, and separate from project-specific business logic.

## What this skill does

- Standardizes one-shot, session-continuation, and server-attach execution modes.
- Pushes callers toward machine-readable output (`--format json`) and explicit structured prompt contracts.
- Encourages wrapper-level helpers in Go so timeout handling, argument building, and output parsing stay testable.
- Keeps domain-specific reasoning in local extension skills instead of bloating the global buyer-facing skill bundle.

## What this skill does not do

- It does not own reverse-engineering, binary extraction, or any project-specific pipeline by itself.
- It does not justify free-form prose responses when downstream code needs deterministic parsing.
- It does not replace environment-specific runtime proof when a task still needs live validation.

## When to combine with another skill

- Combine with a project-local execution skill when the workflow has domain-specific steps, fixtures, or artifacts.
- Example: `ocs-extract-pipeline` should own reverse-engineering flow, while this skill owns the OpenCode invocation contract inside that flow.

## Canonical invocation modes

### One-shot

Use for isolated analysis or single-step automation.

```bash
opencode run --format json "reply PONG"
opencode run --format json --agent oracle --file src/main.go "find type-safety issues and return JSON"
```

### Session continuity

Use when later steps build on prior findings.

```bash
opencode run --format json --title audit-pipeline "analyze the codebase and return JSON"
opencode run --format json -s <session_id> "now fix the top 3 issues and return JSON"
```

### Server attach

Use for high-throughput repeated calls after a server is already running.

```bash
opencode run --attach http://localhost:4096 --format json --password pipeline-secret -p "prompt"
```

## Automation contract

- Default to `--format json` for any machine-consumed workflow.
- Ask for explicit JSON schemas inside the prompt, not just “be structured.”
- Set a timeout in the caller so permission prompts or tool hangs do not stall the pipeline forever.
- Keep the caller directory explicit when project context matters.
- Treat AI output validation as part of the workflow, not as a nice-to-have.

## Go wrapper guidance

A reusable wrapper should usually own:

- argument construction,
- timeout handling,
- stdout/stderr capture,
- JSON event parsing,
- last-text extraction,
- JSON unmarshalling into target structs,
- test doubles or a runner interface for deterministic unit tests.

## Pass criteria

- The automation path can invoke OpenCode without manual terminal interaction.
- Output is machine-readable and validated against an expected shape.
- Timeout and error handling are explicit.
- Domain-specific logic stays outside this global skill and inside the appropriate local extension skill.

## Anti-patterns

- Using free-form text output in a pipeline that expects deterministic parsing.
- Omitting timeout protection on long-running or permission-sensitive calls.
- Hiding project context and assuming the CLI will infer the right working directory.
- Mixing reusable invocation guidance with project-specific artifact knowledge.
- Treating a global buyer-facing skill as the home for repo-local reverse-engineering rules.
