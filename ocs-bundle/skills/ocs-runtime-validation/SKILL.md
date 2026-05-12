---
name: ocs-runtime-validation
description: Final runtime-proof owner for target-environment validation of installer, auth, quota, and runtime-sensitive behavior.
---

# OCS Runtime Validation

## Use this skill when

- Any installer, setup, auth, quota, or runtime-loading behavior changes.
- The user asks for proof from a real local or target environment.
- You need confidence that packaged behavior matches source intent.

## Primary owner job

- Own final end-to-end runtime proof for target-environment behavior.
- Prove that runtime-sensitive work actually behaves as intended outside static inspection.

## What this skill does

- Runs the real installer or update flow for the exact branch or version under test.
- Verifies installed plugin/version state plus key runtime commands such as `ocs` and `opencode`.
- Checks auth-path behavior, quota-path behavior, reinstall persistence, and runtime configuration behavior when relevant.
- Captures concise but concrete evidence from the environment that was actually tested.
- Applies project runtime rules such as WSL-first validation when the task falls under those rules.

## What this skill does not do

- It does not own CocoIndex bootstrap, wrapper recovery, or fallback execution order; that belongs to `ocs-cocoindex-bootstrap`.
- It does not own LSP installation and wiring; that belongs to `ocs-lsp-bootstrap`.
- It does not replace behavior-specific regression tests when deterministic executable guards are feasible.
- It does not allow runtime-sensitive work to be signed off with static inspection alone.

## When to combine with another skill

- Combine with `ocs-cocoindex-bootstrap` after CocoIndex bootstrap or recovery work is complete and final runtime proof is needed.
- Combine with `ocs-lsp-bootstrap` when LSP changes alter installed runtime behavior and need target-environment proof.
- Combine with `ocs-test-regression-guard` when runtime-sensitive work also needs deterministic regression coverage.

## Environment rules

- Read the runtime config from the environment actually under test.
- If you compare two environments, state clearly which config path belongs to which runtime.
- Respect package-manager boundaries during validation (`bun` at root, `pnpm` in the plugin) and report any cross-manager `node_modules` contention.

## Mandatory checks

1. Run the installer or update flow for the exact branch/version being validated and capture the resolved branch/version markers.
2. Verify installed plugin/version state plus key runtime commands such as `ocs` and `opencode`.
3. Validate auth-path behavior when relevant.
4. Validate quota/check paths when relevant.
5. Validate reinstall credential persistence for runtime API config when relevant.
6. Keep logs and evidence concise but concrete.

## Mandatory post-release runtime guard

For release or high-risk runtime sign-off, include these proofs from the real target environment:

1. Installer output contains `Antigravity OAuth integrity check passed`.
2. `opencode auth login -p openai` shows the expected managed-account login path.
3. A one-shot OpenAI runtime succeeds (`opencode run -m openai/gpt-5.3-codex "reply exactly: oauth-ok"`).

Do not mark runtime-sensitive work complete without equivalent live-runtime markers when auth/runtime paths were touched.

## Pass criteria

- The tested installer or update flow resolves the intended branch/version with no silent fallback.
- Runtime commands reach the intended flow without regression.
- Required live-runtime markers are captured for auth/runtime-sensitive work.
- Environment evidence is clearly attributed to the runtime under test.
- No final claim is made until real target-environment proof exists.

## Anti-patterns

- Declaring a fix complete without runtime proof.
- Using only static code inspection for runtime regressions.
- Mixing environment evidence without stating which runtime/path it came from.
- Mixing root/plugin install tools in one tree without clean boundary checks.
- Treating this skill as the owner of bootstrap work that belongs to another skill.
