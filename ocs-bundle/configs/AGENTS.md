# CONFIGS — KNOWLEDGE BASE

## OVERVIEW

Profile definition source for setup/runtime selection. Changes here directly affect generated user config.

## WHERE TO LOOK

| Task | File |
|------|------|
| Add/update profile payload | `*.json` in this directory |
| Keep profile order/aliases in sync | `../scripts/constants/profile-catalog.json` |
| Check setup fallbacks/runtime injection | `../scripts/constants/setup-fallbacks.json`, `../scripts/constants/setup-runtime.json` |

## CONVENTIONS

- Profile file names must align with keys expected by setup/catalog mapping
- Keep schema shape consistent across profiles (providers/models/plugins blocks)
- Preserve stable key naming to avoid breaking setup merge logic

## ANTI-PATTERNS

- Adding a new profile JSON without updating `profile-catalog.json`
- Renaming profile files without adjusting alias/display mapping
- Diverging structure between profiles without setup/runtime support

## NOTES

- `scripts/setup.js` consumes these files and writes merged output to user config directory
- Treat this directory as source-of-truth inputs, not generated output
