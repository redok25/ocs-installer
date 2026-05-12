# Changelog

## [3.0.0] - 2026-05-05

### Changed

- Promoted the plugin into the `3.0.0` suite wave so native runtime/bootstrap changes and the refreshed buyer-facing bundle ship under one coordinated release.
- Aligned plugin-delivered runtime expectations with the suite’s native-first adjunct bootstrap, so release consumers get the same managed DCP path plus RTK/Caveman-aware runtime surfaces under one versioned wave.
- Synced plugin release metadata to the `3.0.0` suite line so managed release automation, buyer assets, and installer assets all point at the same version boundary.

## [2.3.6] - 2026-05-04

### Changed

- Synced the plugin-owned provider catalogs so Gemini text models expose video input, `qwen3.5-plus` advertises image/video input, and `glm-5` / `glm-5.1` stay text-only.
- Added regression coverage for typed model definitions and updater sync so runtime provider catalogs stay aligned with the shipped modality metadata.

## [2.3.5] - 2026-04-19

### Fixed

- Hardened startup auth loader behavior so unreadable account storage no longer gets auto-clobbered by fallback single-account snapshots during fresh session bootstrap.
- Added startup-save guardrails to avoid writing replacement account state when disk load is in an error state.
- Updated provider-auth clearing policy tests to preserve storage on load-error states while still clearing when storage is genuinely missing.

### Changed

- Refactored persistence and cold-start regressions into provider-separated suites (`antigravity` and `openai`) for clearer ownership and easier future-provider extension.
- Added shared provider persistence test-support helpers and excluded them from runtime build output.

## [2.1.13] - 2026-03-30

### Added

- Officially released ChatGPT multi-account support lane in `v2.1.13` (session-based multi-account auth, failover, and quota-aware switching in staging).
- Added `openai_quota_buffer_percent` configuration (schema/default/env/prefs/docs) so OpenAI switch buffer can be tuned like Gemini.
- Added `sanity:openai-accounts` script to validate `openai-accounts.json` for malformed payloads, missing refresh tokens, and account collision anomalies before runtime.
- Added EXA MCP parity wiring (`mcp.exa`) for staging lane defaults with schema-compatible `"{env:EXA_API_KEY}"` header token mapping so plugin-bundled config matches EXA onboarding flow.

### Fixed

- Improved OpenAI post-login reliability by ensuring refreshed credentials re-enable accounts and clear stale verification blocks.
- Added session-auth safe request coercion for native surfaces to avoid scope mismatch failures in real WSL runtime.
- Stripped unsupported Codex output-token request fields (`max_output_tokens` / `maxOutputTokens`) on session-codex payloads to avoid OpenAI bad-request rejections.
- Hardened OpenAI account upsert matching so add-account flow cannot overwrite a distinct account when identity keys collide across different/missing emails.
- Persisted auth refresh updates to disk immediately after `updateFromAuth` token rotation to reduce lost-credentials risk across runtime restarts.
- Parsed nested OpenAI token refresh error payloads (`error.code`/`error.type`/`detail`/`message`) so verification failures surface actionable causes.
- Normalized `refresh_token_reused` failures to an explicit re-authentication message for the current environment.
- Rendered OpenAI quota reset output in local timezone with always forward-looking remaining-duration context (`in Xh Ym`) for clearer operator feedback.
- Updated OpenAI quota check display to be realtime-only in the check flow (no cached quota fallback labels/values during live refresh output).
- Fixed EXA MCP validation incompatibility by enforcing string-only remote header values and dropping EXA oauth emission in staged defaults/setup flow.

### Changed

- Exposed clearer auth-unavailable diagnostics for blocked/verification-required account conditions.
- Documented OpenAI auth-state safety policy (no stale JSON restore, no Windows↔WSL token-state sharing for the same account).

## [2.1.12] - 2026-03-16

### Fixed

- Added bundled plugin self-copy guard so setup skips duplicate copy operations when source and target plugin directories are already identical.
- Hardened interactive fallback path with `/dev/tty`-first handling for safer behavior in WSL/Linux/non-interactive shells.

### Changed

- Synced plugin-facing install/version examples to `2.1.12` for buyer and installer release parity.

## [2.1.11] - 2026-03-15

### Changed

- Synced plugin release metadata and beta documentation framing for the `v2.1.11` parity line.
- Kept setup/runtime plugin packaging aligned with buyer bundle refresh and verification flow.

## [2.1.10] - 2026-03-13

### Fixed

- Hardened setup and environment checks used by plugin-integrated onboarding (including EXA/MCP reliability paths).

### Changed

- Updated release packaging behavior so plugin-delivered parity assets remain consistent across source, buyer, and installer lanes.

## [2.1.9] - 2026-03-12

### Changed

- Aligned plugin parity line with staged buyer release prep and documentation synchronization.

## [2.1.8] - 2026-03-12

### Fixed

- Refined plugin setup/recovery paths for safer fallback handling in mixed interactive/non-interactive sessions.

## [2.1.7] - 2026-03-12

### Changed

- Updated plugin-oriented release notes and bundle metadata to track the staged parity baseline.

## [2.1.6] - 2026-03-12

### Fixed

- Hardened plugin-related setup validation and auth recovery edges observed during lane synchronization.

## [2.1.5] - 2026-03-12

### Changed

- Established early `2.1.x` plugin parity trail used by buyer/installer staging rollout.

## [2.1.4] - 2026-03-11

### Changed

- Synced plugin release framing to `2.1.4` during initial parity sweep before the complete `2.1.12` chain was finalized.

## [2.1.3] - 2026-03-08

### Fixed

- Updated setup release behavior so generated runtime config no longer falls back to a raw `file:///.../dist/index.js` plugin spec, restoring `OAuth with Google (Antigravity)` visibility on Linux, macOS, and WSL.

### Changed

- Bumped the suite and bundled plugin release line to `2.1.3` so source dev metadata, buyer beta bundle metadata, installer templates, and public release guidance stay synchronized for the plugin fallback hotfix.

## [2.1.2] - 2026-03-08

### Changed

- Bumped the suite and bundled plugin release line to `2.1.2` so source dev, buyer beta bundle metadata, installer templates, and public release guidance all point to the same published version again.
- Added cross-repo version-sync guardrails for source, buyer beta, and public installer lanes so future release examples do not advance independently.

## [2.1.1] - 2026-03-08

### Fixed

- Restored stable `opencode auth login -> Google -> OAuth with Google (Antigravity)` behavior for new installs by pinning the auth-critical plugin stack during setup deployment, while keeping source plugin declarations on `@latest`.
- Added setup-time protection so future install/update flows keep the OAuth-compatible plugin versions even when source config continues tracking latest plugin channels.

### Changed

- Bumped suite and bundled plugin patch release line to `2.1.1`.

## [2.1.0] - 2026-03-07

### Changed

- Corrected semver from `2.0.15` to `2.1.0` because this release adds new GPT-5.4 setup profiles, `ocs doctor`, installer version pinning guidance, and other user-facing minor features.
- Published `2.1.0` as the semver-correct minor release without deleting the existing `2.0.15` beta artifact.

## [2.0.15] - 2026-03-07

> Beta artifact released before semver correction. Feature set is superseded by `2.1.0`.

### Added

- Added new setup profile `gpt-5.4-best-perform` for GPT-5.4 quality-first Codex workflows.
- Added new setup profile `gpt-5.4-token-saver` for GPT-5.4 core + Codex mini worker lanes to reduce token burn.
- Added profile wiring and labels so both profiles appear directly in `ocs setup profile`.
- Added `ocs doctor` mini diagnostics to quickly inspect `bun`, `ocs`, `opencode`, PATH entries, and shim visibility.

### Changed

- Updated installer description template (`scripts/templates/public-installer-README.md`) with GPT-5.4 highlights and best-use guidance for both new profiles.
- Updated user docs (`README.md`, `docs/quick-start-en.md`, `docs/quick-start-id.md`, `docs/deep-dive-profiles.md`) to document use cases, selection flow, and trade-offs for both GPT-5.4 setup options.
- Hardened current Codex token-saver mapping to OAuth-validated fast lane behavior (`openai/gpt-5.1-codex-mini`) for stable runtime compatibility.
- Added installer version-pin guidance for Bash (`--version`) and PowerShell (`OCS_VERSION`).

### Fixed

- `ocs setup profile` no longer aborts on invalid interactive resource mode input; it falls back to the default mode with a warning.
- Hardened Linux installer path persistence so `ocs` and `opencode` remain discoverable more reliably across new shell sessions.

## [2.0.14] - 2026-03-07

### Fixed

- Stabilized `opencode` post-install command detection by enforcing cross-shell PATH activation and lightweight shim-first recovery in installer flows.
- Hardened Linux/WSL GitHub auth and bundle retrieval to avoid false 401 failures when `gh` session authentication is valid.
- Eliminated redundant heavy `opencode` auto-recovery after successful setup to prevent long hang-like post-install behavior.

### Changed

- Bumped suite and plugin release line to `2.0.14`.
- Rebuilt production release artifact as `opencode-config-suites-v2.0.14.tar.gz` and synced buyer beta channel metadata/releases.
- Added release governance and changelog/release-note guardrails in installer repository to keep dev/buyer/installer release narratives aligned.

## [2.0.13] - 2026-03-07

### Fixed

- Hardened shell installer auth/dependency flow to prevent false local-source detection and non-interactive prompt hangs.
- Updated PowerShell auto-setup execution to use direct headless invocation and remove false fallback warnings.

### Changed

- Reduced installer-mode setup log noise by skipping optional/non-blocking checks and downgrading non-fatal warnings to informational logs.
- Synced public-installer source templates (`install-plugin.sh`, `install-plugin.ps1`) with the latest installer fixes.

## [2.0.12] - 2026-03-06

### Fixed

- Restored valid `opencode-multi-auth` plugin source/build artifacts so runtime plugin loading no longer crashes on malformed bundle output.
- Verified OAuth menu visibility in `opencode auth login` for Google provider (`OAuth with Google (Antigravity)` appears again) after setup/reinstall flow.
- Hardened setup/install sync path to keep `google_auth: false` and deploy plugin spec in a format that Bun can install reliably (`opencode-multi-auth@file:C:/...tgz` on Windows).

## [2.0.11] - 2026-03-06

### Fixed

- Patched plugin installer setup path to enforce `google_auth: false` after reinstall, preventing Gemini/Google OAuth options from disappearing.
- Updated plugin setup flow to resolve `opencode-multi-auth` plugin spec as bundled package dependency (`opencode-multi-auth@file:...`) instead of raw `file:///.../dist/index.js` path.
- Reordered plugin setup deployment so bundled payload sync happens before plugin spec rewrite and plugin install, ensuring newest artifact resolution.

## [2.0.10] - 2026-03-06

### Fixed

- Setup now syncs bundled multi-auth payload before rewriting plugin specs, so deployed `opencode.json` always resolves the latest local artifact instead of stale tarball references.
- Multi-auth plugin spec resolution is now artifact-aware with a safe fallback to local bundled directory when tarball packaging is unavailable.
- Strengthened OAuth visibility guard by enforcing `google_auth: false` in generated runtime config and installer post-setup checks.

## [2.0.9] - 2026-03-06

### Fixed

- Corrected OCS command resolution so `ocs` no longer falls through to `opencode` when a conflicting shim/script already exists on PATH.
- Installer now validates that detected `ocs` is the OpenCode Config Suites CLI and auto-repairs local shims when mismatch is found (including PowerShell precedence on Windows).
- `ocs --version` now follows current suite version from root package metadata (`2.0.9`).

## [2.0.8] - 2026-03-05

### Fixed

- Hardened bundled multi-auth plugin spec generation with cross-platform fallback: when tarball artifact is unavailable, setup now points plugin spec to local bundled package directory instead of a missing `.tgz` file.
- Prevented auth runtime failures such as `BunInstallFailedError` during `opencode auth login` on macOS/Linux environments that do not produce tarball artifacts reliably.

## [2.0.7] - 2026-03-04

### Added

- Dynamic Gemini CLI-first routing policy for plugin runtime with mode controls (`off`, `conservative`, `aggressive`).
- Account-level CLI capability handling (`unknown`/`capable`/`unavailable`) with TTL recovery and automatic CLI bypass for unavailable accounts.
- Natural request pacing controls (`request_jitter_min_ms`, `request_jitter_max_ms`, `request_concurrency_spread_ms`) for high-concurrency traffic.
- Preset tuning guidance and 5-minute checklist in plugin configuration docs.

### Changed

- Extended plugin resolver metadata and route observability for dynamic policy/fallback decisions.
- Updated plugin config schema/env surface and regenerated published schema asset.

### Fixed

- Stabilized plugin floating-point token bucket test assertion.
- Hardened plugin storage migration fixture typing in tests.

## [2.0.6] - 2026-03-04

### Fixed

- `ocs setup:profile:update` now self-heals corrupted Bun global manifest/lock states caused by duplicate `opencode-config-suites` keys.
- Managed global tool bootstrap no longer pollutes Bun global dependencies with local workspace entries, eliminating duplicate-path parse errors and follow-on EPERM/ENOENT failures.

## [2.0.5] - 2026-03-04

### Fixed

- `ocs prefs` now resolves antigravity schema robustly in both repo and installed layouts, preventing schema backend lookup failures from blocking valid edits.
- Hybrid profile now keeps Gemini on plugin OAuth/proxy auth flow by forcing `google_auth: false` so built-in auth cannot hide OAuth options.

### Changed

- Preferences defaults and generated antigravity JSON schema were synchronized with current backend config logic, including schema generator API updates and regenerated schema asset.

## [2.0.4] - 2026-03-04

### Fixed

- Restored Antigravity OAuth login option visibility during `opencode auth login` by correcting setup plugin deployment to a reliably loadable local bundle.

### Changed

- Setup now packs and references `opencode-multi-auth-<version>.tgz` in target config, ensuring installer deployments load the bundled multi-auth plugin version directly.

## [2.0.3] - 2026-03-04

### Changed

- Restored default interactive behavior for `ocs setup profile`/`ocs setup:profile` when no non-interactive flags are passed.
- Added update command aliases `ocs setup update` and `ocs setup:update`, mapped to the same update flow as `ocs setup:profile:update`.

### Commits

- `d838837` fix(cli): restore interactive setup default and add update aliases

## [2.0.2] - 2026-03-04

### Changed

- Release bundling now includes both root and plugin changelog files in artifacts (`CHANGELOG.md` and `PLUGIN_CHANGELOG.md`).
- Finalized changelog cleanup for released sections and commit-trail consistency.

### Commits

- `2e9a5b9` build(release): include changelogs in bundled artifacts
- `da47524` chore(release): finalize 2.0.1 notes and metadata
  
## [2.0.1] - 2026-03-04

### Changed

- `ocs prefs` wizard now enforces strict schema validation before apply: invalid non-empty inputs are rejected with field-specific feedback, empty input still keeps current value, and apply is blocked when final antigravity validation fails.
- `opencode-multi-auth` runtime now has phased status-policy hardening across `401/403/404/429/5xx`, including adaptive 5xx handling, status floors, model-family lock normalization, storage migration cleanup, and circuit-breaker payload contracts.
- Removed manual `verify account` / `verify all` login menu actions in plugin auth flow to eliminate no-op UX paths.

### Commit Ledger (since 2.0.0)

- `ad3ed96` feat(cli): add global ocs dispatcher and prefs wizard
- `dae1057` feat(prefs): enforce strict schema validation in wizard
- `120c6a9` docs(prefs): document strict validation apply behavior
- `b25c385` feat(plugin): add phase-0 policy rollout guardrails
- `96302de` feat(plugin): harden phase-1 retry and quota classification
- `f510011` feat(plugin): extend cooldown duration fallback parsing
- `42fc708` test(plugin): add 429 dedup storm coverage
- `0362157` feat(plugin): normalize model-family cooldown lock keys
- `7ab7e15` feat(plugin): add rest-until-full soft quota lock flow
- `b1a451b` feat(plugin): harden storage migration and save coordination
- `81a00b9` feat(plugin): add 401 escalation and 404 cooldown routing
- `3ff6130` feat(plugin): add adaptive 5xx retry and switching path
- `cbdfa6e` feat(plugin): enforce status floors in cooldown backoff
- `03d72b7` refactor(plugin): remove manual verify-account menu flow
- `32354da` docs(plugin): record unreleased wave-2 commit trail
- `da47524` chore(release): finalize 2.0.1 notes and metadata

## [2.0.0] - 2026-03-03

### Added
- Global OCS dispatcher and preferences wizard for faster first-run setup (`ad3ed96`).
- Landing refresh with new Hero Lab page and updated brand assets for launch content (`19fef61`).
- Finalized pro hybrid logo system and profile scaffolding for broader deployment coverage (`33dda63`, `3770ae3`).

### Changed
- Setup now defaults to hybrid profile + performance mode and includes antigravity config fallback seeding from template when missing (`aedcabb`, `2b49027`).
- Multi-auth runtime now aligns CLI quota fallback and image model routing with stricter Claude request shaping and diagnostics (`3904771`, `de9553f`).
- Repository structure and workflow docs are reorganized for apps/archive split and release pipeline clarity (`46ebc6a`, `61798eb`, `77bc2e0`, `8923a8b`).

### Fixed
- Windows/public installer flow hardened across auth gating, tar extraction, shell handoff, dependency retries, path normalization, and setup bootstrap reliability (`0bb5631`, `450be68`, `84f07c3`, `6c068d0`, `2a21f68`, `709b036`, `b001538`, `608e71c`, `1246c2c`, `5d0e2a7`, `b7d8513`, `d886420`, `11a42b9`, `28c9458`, `d1ccf00`).
- Sonnet/Opus INVALID_ARGUMENT mitigation now includes payload normalization, non-thinking guards, and schema/tool compatibility enforcement (`de9553f`, `a3f3d9b`, `5cc69bc`).

### Docs
- Expanded installer and script guidance including cache-buster command standardization and antigravity fallback behavior documentation (`ee0a386`, `1d9e448`).

### Verified
- Added regression coverage for Sonnet/Opus payload edge cases and triage playbook for 400 vs 403 failures (`a3f3d9b`, `5cc69bc`).

### Commit Ledger (c91d2a9..1d9e448)
- `0bb5631` fix(installer): add resilient token and gh dependency fallbacks
- `450be68` fix(installer): persist bun path and improve access-denied flow
- `84f07c3` fix(installer): keep terminal open after pwsh handoff
- `6c068d0` fix(installer): avoid false handoff short-circuit in ps5
- `46ebc6a` refactor(structure): migrate ocs app and archive legacy web paths
- `61798eb` docs(workflow): clarify multi-remote push model and ignore noise
- `77bc2e0` docs: organize guidance and repository workflow references
- `8923a8b` chore(runtime): update setup flow and archive legacy cli entry
- `3770ae3` feat(plugin): add profile configs and stabilize plugin test scaffolding
- `2a21f68` fix(installer): prevent token output pollution and enforce access gate
- `709b036` fix(installer): make windows tar extraction fail-fast and compatible
- `b001538` fix(installer): prefer system tar.exe and normalize extraction paths
- `608e71c` fix(installer): avoid false local-source detection and use plugin setup path
- `1246c2c` fix(installer): normalize COMSPEC before setup execution
- `5d0e2a7` fix(installer): harden ps7 relaunch and bun retry diagnostics
- `b7d8513` fix(installer): continue in current shell when pwsh relaunch fails
- `d886420` fix(installer): resolve relative plugin path during bun install
- `11a42b9` fix(installer): harden dependency install retries and fallback
- `28c9458` fix(installer): enforce bun-only dependency retries
- `7c7ba91` chore(installer): refine next-steps guidance text
- `d1ccf00` fix(installer): default to codex hybrid performance
- `33dda63` feat(branding): add final pro hybrid logo system
- `ee0a386` docs(installer): standardize pwsh cache-buster command
- `aedcabb` feat(setup): default to hybrid profile and performance mode
- `3904771` feat(multi-auth): align CLI quota fallback and image model routing
- `ad3ed96` feat(cli): add global ocs dispatcher and prefs wizard
- `de9553f` fix(multi-auth): harden claude payload normalization and thinking guards
- `a3f3d9b` test(multi-auth): add regression coverage for sonnet opus payload edges
- `5cc69bc` docs(multi-auth): add sonnet opus 400 vs 403 triage playbook
- `19fef61` feat(landing): refresh hero section and add hero lab page
- `2b49027` fix(setup): seed antigravity config from template fallback
- `1d9e448` docs(scripts): document antigravity fallback behavior

## [1.10.5] - 2026-02-21

### Fixed
- Setup script no longer overwrites the local repository's `oh-my-opencode.json`. This prevents the git working tree from becoming dirty and fixes the `error: Your local changes would be overwritten by merge` issue during `git pull`.
- Updated `package.json` license identifier to properly reflect commercial/proprietary status (`SEE LICENSE IN LICENSE`).

## [1.10.4] - 2026-02-21

### Docs
- `quick-start-en.md` + `quick-start-id.md`: added concurrent agents column to resource mode table, fixed `performance` mode description, updated plugin count from 4 to 5 (tokenscope added to main table), added plugin auto-install note.

## [1.10.3] - 2026-02-21

### Fixed
- `installPlugins`: exclude `@opencode-ai/*` internal SDK packages from generated `package.json` dependencies — prevents noise in plugin install output.
- `enforcePureConfig`: now also removes `opencode-mem.jsonc` on each deploy — cleans up legacy config from removed plugin.

## [1.10.2] - 2026-02-21

### Fixed
- Plugin installation now generates a `package.json` in `~/.config/opencode` from the deployed `opencode.json` plugin list before running `bun install` — fixes "Bun could not find a package.json" error caused by `enforcePureConfig()` wiping it on each deploy.

## [1.10.1] - 2026-02-21

### Fixed
- Plugin installation after deploy: setup now runs `bun install` in `~/.config/opencode` after copying `opencode.json`, ensuring plugins like `@tarquinen/opencode-dcp` and `cc-safety-net` are actually installed and active.

## [1.10.0] - 2026-02-21

### Added
- **Hardware-aware concurrent agent limiting**: Setup now detects CPU core count and automatically sets `background_task.defaultConcurrency` in `oh-my-opencode.json` based on spare capacity.
  - Formula: `spareCores = max(1, totalCores - 2)` (reserves 2 cores for OS + OpenCode)
  - `low` mode: `max(1, floor(spareCores × 0.4))`
  - `balanced` mode: `max(2, floor(spareCores × 0.8))`
  - `performance` mode: `max(3, spareCores - 1)`
- Setup log now shows the applied concurrency limit after profile deployment.

## [1.9.0] — 2026-02-21

### Changed
- `opencode-multi-auth` updated to @latest (v1.6.0) — now includes proactive context overflow guard for Claude models
  - Automatically detects when context exceeds ~195k tokens before sending to Antigravity
  - Triggers /compact automatically and prompts user to resend — no more session-locking HTTP 400 errors
- Removed `opencode-mem` plugin — fork project cancelled (Antigravity private API not replicable externally)
- Removed `opencode-mem` deployment from setup script — plugin removed from stack
- Fixed `performance` resource mode: now actively upgrades critical agents to `max`/`high` variants (previously identical to `balanced`)

### Fixed
- `opencode-multi-auth` version pin updated from `1.5.11` to @latest

## [1.8.0] - 2026-02-20

### Added
- **Plugin Stack**: Two new plugins added to base `opencode.json` config (zero config, zero API keys):
  - `@tarquinen/opencode-dcp@latest` — Dynamic Context Pruning. Automatically removes stale conversation history (duplicate reads, superseded writes, old errors) before each LLM request to reduce token usage. Fully compatible with oh-my-opencode; disabled for subagents by design.
  - `cc-safety-net@latest` — PreToolUse safety hook. Blocks destructive shell commands (`git reset --hard`, `rm -rf` outside cwd, `git push --force` to main/master, shell wrapper bypasses) before the LLM executes them.
- **Plugin Stack section** in `docs/quick-start-en.md`:
  - Plugin inventory table with role and API key requirements
  - DCP slash command reference (`/dcp context`, `/dcp stats`, `/dcp sweep`, `/dcp distill`)
  - Safety Net overview and verification command (`npx cc-safety-net doctor`)
  - Optional Plugins section: `opencode-mem` (local persistent memory, zero-API-key mode and full-auto mode) and `@ramtinj95/opencode-tokenscope` (token analytics) with full setup instructions
- **Bagian Plugin Stack** di `docs/quick-start-id.md` — terjemahan lengkap semua konten di atas ke Bahasa Indonesia.

### Research (Plan: feat-0da6)
- Audited 4 community-recommended plugins; decision document at `.flowcrate/plans/PLAN_FEAT_0DA6_PLUGIN_AUDIT.md`.
- `opencode-supermemory` superseded by `opencode-mem` (local SQLite + HNSW vector DB, no paid cloud API, contributor overlap with oh-my-opencode author).



### Added
- **Auto Resource Mode** in setup (`low` / `balanced` / `performance`).
  - After profile selection, setup now prompts for resource mode.
  - `low` mode applies deterministic variant downgrade policy: heavy agents (`sisyphus`, `oracle`, `atlas`) downgraded from `max`/`high` to `low`; fast workers (`explore`, `quick`, `unspecified-low`) set to `minimal`.
  - `balanced` (default) preserves profile defaults unchanged.
  - `performance` preserves full `max`/`high` quality on all critical roles.
  - Selected mode persisted to `~/.config/opencode/resource-mode.json` for transparency.
- Resource mode policy constants in `scripts/constants/setup-fallbacks.json` (`policies.low`, `policies.balanced`, `policies.performance`).
- Resource mode options and labels in `scripts/constants/setup-runtime.json`.
- `applyResourceModePolicy(config, resourceModeId)` transform function in `scripts/setup.js`.
- `resolveResourceModeSelection(rawInput)` for number or string input acceptance.
- Expanded **Resource Mode** section in `docs/quick-start-en.md` with behavior table, per-agent variant change matrix, and quick-pick guidance.
- Expanded **Mode Resource** section in `docs/quick-start-id.md` (same in Bahasa Indonesia).

### Changed
- Setup flow: profile selection now followed by resource mode selection before config deploy.
- Deploy line now prints: `📦 Deploying profile: <name> (resource mode: <mode>)`.

## [1.7.1] - 2026-02-20

### Added
- Quick start EN/ID now includes explicit **Load Project** onboarding for first-time users.
- Added cross-drive project loading guidance with copy-paste command examples for Windows paths:
  - `D:\\Projects`
  - `E:\\Work`
- Added home-limited picker workaround with link mapping examples:
  - Windows junction (`mklink /J`)
  - Linux symlink (`ln -s`)
  - macOS symlink (`ln -s`)
- Added **Agent Mode Selection** section (Sisyphus, Hephaestus, Prometheus, Atlas) with best-use-case mapping and prompt examples.
- Added quick FAQ in EN/ID for account operations:
  - temporary disable flow
  - when to change account
  - practical limit/rotation guidance

### Changed
- Refined quick-start headings, navigation hierarchy, and section discoverability.
- Added explicit guidance for Windows port-lock issue after `Ctrl+C`:
  - `taskkill /IM node.exe /F`
- Added changelog index link in `README.md` so users can immediately see new updates.
- Added recommendation to use **VS Code Explorer + integrated terminal** as the default execution path for new users.

## [1.7.0] - 2026-02-20

### Added
- `configs/opus-4.6-lead.json` and `configs/sonnet-4.6-lead.json` as explicit lead-profile canonicals; legacy aliases (`configs/opus-4.6.json`, `configs/sonnet-4.6.json`) are retained for compatibility.
- Setup runtime constants files:
  - `scripts/constants/profile-catalog.json`
  - `scripts/constants/setup-runtime.json`
  - `scripts/constants/setup-fallbacks.json`
- Setup startup update badge logic to check latest GitHub release and print:
  - `[New Update: vX.Y.Z]` with update command hint, or
  - `[Latest: vX.Y.Z]` when current.
- Profile selection guidance additions in quick-start docs:
  - table of contents
  - quick selection matrix (`Use case -> Profile -> Why`)
  - profile decision tree (EN/ID)

### Changed
- Migrated active Gemini Pro model references from `gemini-3-pro` to `gemini-3.1-pro` across profile configs and provider model keys.
- Pinned plugin and dependency alignment to `opencode-multi-auth@1.5.11` in `opencode.json`, `package.json`, and `bun.lock`.
- Refactored `scripts/setup.js` to consume centralized constants for profile ordering, alias mapping, scope hints, header/runtime metadata, model display labels, and fallback defaults.
- Clarified profile naming semantics in docs (`-lead` vs `-all`) to reduce misleading selection outcomes.
- Added `.gemini/` to `.gitignore` for local assistant state.

### Verified
- Isolated smoke test for all visible canonical profiles: `8/8` passed.
- Walkthrough report attached in Flowcrate: `WLKTH_TEST_1587_ISOLATED_PROFILE_SMOKE.md`.

## [1.6.1] - 2026-02-20

### Changed
- Quick start guides now require `gh auth login -h github.com -w` before cloning private repo access.
- Added explicit pre-clone access check using `gh repo view andyvandaric/andyvand-opencode-config`.
- Added troubleshooting for `GraphQL: Could not resolve to a Repository` (wrong account or invite not accepted).
- Added clear profile-switch restart flow: stop running `opencode web` (`Ctrl+C`) and relaunch using the same port.
- Added a structured Gemini Pro/Ultra activation guide for new Google Cloud accounts, including required API enablement and re-auth steps.

## [1.6.0] - 2026-02-20

### Added
- `configs/sonnet-4.6-all.json` - New Sonnet-only profile where all agents and categories run `google/antigravity-claude-sonnet-4-6-thinking`.
- `configs/codex-5.3-sonnet-4.6.json` - New two-model profile using only `openai/gpt-5.3-codex` and `google/antigravity-claude-sonnet-4-6-thinking`, with Codex as primary and Sonnet as quality-focused sub roles.

### Changed
- `README.md` model selection table now includes `sonnet-4.6-all` and `codex-5.3-sonnet-4.6` preset entries.

## [1.5.0] - 2026-02-19

### Added
- **Taplo TOML LSP** — `setup.js` now auto-installs and configures [Taplo](https://taplo.tamasfe.dev) for `.toml` file support. Installs via `cargo` or `brew`, falls back to manual install link.
- **Ghost Spectre / no-winget fallback** — `install.ps1` now tries `winget` → Chocolatey (auto-bootstrapped) → Scoop (auto-bootstrapped) → direct `.exe`/`.msi` download from GitHub releases. Users on stripped Windows ISOs no longer get stuck.
- **Multi-account safe login guide** — step-by-step instructions for adding multiple Google accounts safely: separate Chrome profiles, mobile hotspot tethering, airplane mode to rotate IP between accounts.
- **Account verification guide** — explains `[needs verification]`/`[disabled]` status, how to verify via Antigravity Manager, and the delete-and-re-add flow after successful verification.
- **Quota check guide** — full step-by-step for checking per-account Gemini CLI and Antigravity quota via `opencode auth login` → Check quotas.
- **Working directory note** — clarifies that `opencode web` should be launched from `~/Dev/` not deep subfolders.

### Fixed
- `install.ps1` parse error on PowerShell 5.1 — removed all non-ASCII characters (em dashes, box-drawing, emoji, arrows) from script body; file re-saved as UTF-8 without BOM.
- `install.ps1` pre-clean hang — replaced slow `npm list -g` check with direct uninstall call (~1s vs 10-30s).
- `opencode` command in all docs — corrected to `opencode web --port 8089` (with note that port is user-configurable).
- `Unable to connect` troubleshooting — corrected cause: OpenCode server not running or port changed, not a proxy issue.
- `Skill "skill_mcp" not found` troubleshooting — added fix: install `@kaitranntt/ccs`.

### Changed
- `install.ps1` Quick Start in README now links directly to full guides instead of duplicating steps.
- Quick start docs: added Ghost Spectre file selection table (which `.msi` to pick), loading warning on Antigravity login, and `winget: not found` troubleshooting entry.
- Removed stale `docs/user_guide_singkat.md` and all references to it (done in v1.4.0 cycle, now consolidated).



### Added

- **Strict Soft Quota Locking** - Accounts exceeding the soft quota threshold (confgurable, default 70%) are now strictly locked until their specific quota reset time, ignoring cache TTL. This prevents "leaky" usage where expiring cache allowed over-quota accounts to be reused before they were actually replenished.
- **Proxy Support** - Added support for `undici` ProxyAgent, allowing the plugin to work behind corporate proxies via standard environment variables.
- **Oh-My-OpenCode Integration** - integrated session recovery features from `oh-my-opencode`:
  - **Tool Crash Recovery**: Automatically fixes `tool_result_missing` errors when operations are cancelled.
  - **Thinking Block Recovery**: Fixes corrupted or out-of-order thinking blocks.
  - **Strip Illegal Thinking**: Automatically removes thinking blocks when switching to models that don't support them.
- **Interactive Quota Pause** - The `check` command now pauses after displaying the quota table, giving users time to read the stats before the command exits or proceeds.

### Changed
- `install.sh` / `install.ps1`: Pre-clean step runs as Step 0, before all other installation steps.

## [1.3.0] - 2026-02-19

### Added
- `docs/quick-start-en.md` — English quick start guide focused on one-command install.
- `docs/quick-start-id.md` — Indonesian quick start guide (Panduan Quick Start Bahasa Indonesia).

### Changed
- Simplified `README.md`: removed verbose Installation, Usage, Tools & CLI, and Troubleshooting sections now covered by the quick start docs. Added a clean Quick Start block and Documentation table linking to all guides.

## [1.2.0] - 2026-02-19

### Added
- `install.ps1` — One-command Windows installer (PowerShell). Automatically installs Git, Bun, GitHub CLI, clones repo, runs setup.
- `install.sh` — One-command Linux/macOS installer (Bash). Supports Ubuntu/Debian, Fedora, Arch, and macOS.
- Updated `docs/user_guide_singkat.md` to lead with one-liner install commands and a cleaner troubleshooting table.

## [1.1.0] - 2026-02-19

### Added
- New visual identity assets in `assets/` (logo.svg, AI prompts).
- Support for `task(category=...)` compatibility layer in `scripts/setup.js` to map legacy agent names to modern categories.
- Automatic installation of `@biomejs/biome` and `@code-yeongyu/comment-checker` in setup script.
- Improved `doctor` check in setup script to suppress known false-positive "Comment checker unavailable" warnings.
- Documentation for agent compatibility mapping.

### Changed
- Updated `README.md` with new branding and toolchain details.
- Standardized `oh-my-opencode.json` formatting and agent model mappings.
- Refined `scripts/setup.js` tool dependency management and profile description generation.

## [1.0.3] - 2026-02-18

### Changed
- Replaced all Sonnet 4.5 model references with Sonnet 4.6 across project configuration profiles.
- Renamed `configs/sonnet-4.5.json` to `configs/sonnet-4.6-lead.json` (legacy alias `configs/sonnet-4.6.json` retained).
- Updated provider model keys in `opencode.json` from `antigravity-claude-sonnet-4-5*` to `antigravity-claude-sonnet-4-6*`.
- Updated setup profile model label mapping in `scripts/setup.js` to show Sonnet 4.6.
- Updated README model selection note from Sonnet 4.5 to Sonnet 4.6.
