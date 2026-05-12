---
name: ocs-markdown-autofix
description: Auto-fix and verify task-touched markdown files without turning the skill into a general writing lane.
---

# OCS Markdown Auto-Fix

## Use this skill when

- Editing `.md` files for plans, docs, READMEs, changelogs, or workflow/rules text.
- Agent/user collaboration depends on clean markdown structure in generated output.
- You see markdownlint rules like `MD029`, `MD036`, `MD051`, or `MD060`.

## Primary owner job

- Own markdown auto-fix and markdown verification for task-touched `.md` files.
- Keep markdown quality explicit and separate from copywriting, planning, or runtime validation.

## What this skill does

- Runs targeted markdown auto-fix on task-touched files.
- Re-runs targeted markdown verification on the same files.
- Expands to repo-level markdown verification only when the scope is broad enough to justify it.
- Keeps heading structure, list continuity, and link integrity readable after fixes.
- Prefers repository-local markdown lint scripts when the target repo already defines them.
- Falls back to direct `markdownlint-cli2` execution only when repository-local scripts are absent.

## What this skill does not do

- It does not write the copy strategy for a page or document.
- It does not replace runtime validation or regression testing.
- It does not excuse skipping the verify pass after `--fix`.

## When to combine with another skill

- Combine with `ocs-technical-copy-seo` after editing install, onboarding, docs, or buyer-facing markdown surfaces.
- Combine with other writing or planning skills only after those skills produce the content that needs markdown cleanup.

## Pass criteria

- All task-touched `.md` files return 0 errors through the chosen verify path.
- Any repo-wide pre-existing markdown debt outside scope is called out explicitly.
- Documentation remains readable and semantically consistent after auto-fix.

## Execution contract

Use this order unless the target repository has a clearly documented project-specific markdown workflow that must override it:

1. Prefer repo-local script execution when available:
   - `bun run lint:md:fix -- <files>` then `bun run lint:md -- <files>`
   - or the repository's equivalent markdown fix and verify scripts
2. If repo-local scripts are absent, prefer direct `markdownlint-cli2` execution through an available runner:
   - `bunx markdownlint-cli2 --fix <files>` then `bunx markdownlint-cli2 <files>`
   - otherwise `npx markdownlint-cli2 --fix <files>` then `npx markdownlint-cli2 <files>`
3. If neither repo-local scripts nor a supported direct runner are available, stop and report an actionable failure instead of pretending markdown verification passed.

Direct fallback is allowed to fetch `markdownlint-cli2` on first use when the target repository does not provide its own markdown scripts. That tradeoff is acceptable only when the chosen runner is explicit and the follow-up verify pass still runs.

Platform expectation:

- On Windows, macOS, Linux, and WSL, apply the same ordered policy: repo-local scripts first, then `bunx` if available on PATH, then `npx` if available on PATH, otherwise fail clearly.
- The chosen command path should be visible in the task output so the user can tell which route actually ran.

The workflow is always:

1. run targeted fix on the touched markdown files,
2. run targeted verify on the same files,
3. report any out-of-scope repo markdown debt separately.

## Clarification (tooling roles)

- `marksman` = Markdown language-server behavior (symbols, refs, structural checks).
- `markdownlint-cli2` = markdown style/lint rules and auto-fix.

## Boundaries

- This skill is an OCS-distributed markdown workflow helper, not a universal OpenCode built-in markdown primitive.
- Use it only for markdown-touching work.
- If the task does not touch `.md` files, do not load this skill unless markdown verification is still explicitly required.

## Anti-patterns

- Running `--fix` without a follow-up verify pass.
- Declaring done while task-touched markdown files still fail lint.
- Assuming Marksman warnings and markdownlint warnings are the same layer.
- Disabling additional lint rules ad-hoc without clear repository policy rationale.
- Assuming this repo's `bun run lint:md*` scripts exist in every user repository.
- Claiming success when no supported markdown runner exists and no verify step actually ran.
