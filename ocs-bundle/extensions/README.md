# OCS User Extensions

This directory is reserved for your custom OCS behavior layers.

## What goes where

- `rulesets/` → custom rules and policy constraints
- `skills/` → custom skills you want agents to load
- `workflow/` → task flow templates and execution playbooks

## Adaptive loading strategy

Use **minimum-sufficient loading**:

1. Load only the skills needed for the current task domain.
2. Add extra skills only when explicit risk/trigger conditions appear.
3. Re-evaluate skill load when task scope changes.

## Important

- OCS managed skills are synced into `~/.config/opencode/skills`.
- Your extension files here are user-owned and safe to customize.
- Keep files concise and action-oriented for fast agent parsing.
