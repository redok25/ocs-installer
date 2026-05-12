---
name: ocs-lsp-bootstrap
description: Install, wire, and verify missing language servers for OpenCode safely across Windows, macOS, and Linux.
---

# OCS LSP Bootstrap

## Use this skill when

- A required language server is missing, broken, or not on PATH.
- OpenCode or editor diagnostics, completions, or definition jumps are failing because the LSP is not installed or not configured.
- You are adding support for a new language or file extension.
- A setup or runtime config change affects how language servers are installed, resolved, or merged.

## Primary owner job

- Own installation, wiring, and language-level verification for missing or broken language-server support.
- Keep LSP fixes tied to the real source of truth that installs or configures the server.

## What this skill does

- Defines the exact behavior contract for the target language, binary, command arguments, config entry, and verification surface.
- Inspects the runtime config and any repo-owned setup/bootstrap path before changing anything.
- Installs the server through the narrowest safe managed path.
- Adds or fixes the LSP config entry with the real executable, arguments, and file extensions.
- Verifies shell resolution, config presence, and real editor/runtime behavior on an actual file.

## What this skill does not do

- It does not own final runtime truth for broader installer or environment-sensitive sign-off.
- It does not apply to issues unrelated to language servers.
- It does not treat formatter or linter tools as if they were language servers.
- It does not stop at installation without language-level verification.

## When to combine with another skill

- Combine with `ocs-runtime-validation` when the LSP change affects installed runtime behavior and needs end-to-end proof in the target environment.
- Do not replace `ocs-runtime-validation` with this skill when the question is broader than LSP installation and wiring.

## Pass criteria

- The required server is installed through the correct managed path.
- The runtime config points to the intended server command.
- The affected language has a real verification result, not just a file diff.
- If setup/bootstrap owns the LSP surface, rerunning it preserves the fix.

## Installation heuristics

- Rust: prefer `rustup component add rust-analyzer`.
- TypeScript / JavaScript: prefer `typescript-language-server` plus `typescript`.
- Python: use the project-selected server intentionally (`pylsp`, `pyright`, etc.), do not guess.
- Go: prefer `gopls` from the Go toolchain.
- Markdown / TOML: prefer `marksman` and `taplo` where those are already the project defaults.
- If the project already has a setup script that manages LSPs, patch that source of truth instead of only editing a user runtime file.

## Anti-patterns

- Editing only a local runtime file when the real source of truth is a repo-owned setup/bootstrap script.
- Installing a server without updating the config entry that actually invokes it.
- Guessing a package name or binary without checking upstream docs.
- Treating lint/formatter tools as if they were language servers.
- Declaring success after install without a real language-level verification step.
