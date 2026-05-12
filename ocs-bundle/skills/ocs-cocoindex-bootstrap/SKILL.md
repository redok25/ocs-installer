---
name: ocs-cocoindex-bootstrap
description: Only buyer-facing owner for CocoIndex bootstrap, wrapper discovery, repair, and recovery across supported environments.
---

# OCS CocoIndex Bootstrap

## Use this skill when

- `cocoindex-code`, `ccc`, or `ccc mcp` is missing, unhealthy, or not wired into OpenCode.
- `ocs index` lifecycle commands fail or the managed MCP entry is absent, stale, or drifting.
- Setup or installer changes affect the managed CocoIndex bootstrap path.
- You need the safest repo-owned path for CocoIndex setup and recovery.

## Primary owner job

- Act as the only buyer-facing owner for CocoIndex bootstrap, wrapper discovery, repair, and fallback execution order.
- Keep CocoIndex setup inside the repo-owned contract instead of ad-hoc local guesses.
- Hand off final end-to-end runtime proof to `ocs-runtime-validation` when runtime-sensitive sign-off is required.

## What this skill does

- Owns the managed bootstrap path for Python, package install, command shim, MCP entry, local Postgres, and wrapper commands.
- Keeps the wrapper-first ladder explicit: `ocs index` -> managed `ccc` shim -> `ccc mcp`.
- Uses raw `ccc` commands only as controlled fallback when the wrapper path cannot reach the service.
- Protects the repo-owned contract around `cocoindex-code[full]`, MCP wiring, and environment files.

## What this skill does not do

- It does not own final runtime truth for broad installer or auth behavior.
- It does not invent unsupported third-party provider or local-LLM config.
- It does not apply to general search strategy discussions when bootstrap health is not changing.
- It does not jump straight to destructive recovery without wrapper-level evidence first.

## When to combine with another skill

- Combine with `ocs-runtime-validation` when CocoIndex work must be proven in a real runtime or release-sensitive environment after bootstrap changes are complete.
- Do not replace `ocs-runtime-validation` with this skill when the question is final runtime sign-off.

## Canonical execution order

1. Check the managed wrapper path first with `ocs index`.
2. If deeper wrapper-level inspection is needed, use the managed `ccc` shim.
3. If the wrapper path still cannot reach the service, use `ccc mcp` as the controlled fallback.
4. Use raw destructive `ccc` recovery only after wrapper-path evidence shows it is necessary.

## Pass criteria

- The failure surface is identified clearly.
- The wrapper-first ladder was followed before raw fallback commands were used.
- Any repair keeps the managed bootstrap contract repo-owned and cross-platform.
- Verification proves wrapper health, MCP presence, and concrete CocoIndex readiness.
- If final runtime sign-off is needed, the task is explicitly handed to `ocs-runtime-validation`.

## Anti-patterns

- Claiming auto-connect while depending on undocumented third-party local-LLM config.
- Writing guessed Ollama/LiteLLM config files without a repo-owned contract.
- Skipping wrapper verification and jumping straight to destructive `ccc reset -f`.
- Treating this skill as the final runtime-proof owner for all runtime-sensitive work.
- Treating custom model/provider selection as part of the guaranteed default bootstrap.
