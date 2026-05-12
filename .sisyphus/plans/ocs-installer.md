# OCS One-Liner PowerShell Installer

## TL;DR

> **Quick Summary**: Build a single PowerShell script (`irm <url> | iex`) that fully installs OpenCode + OCS config bundle + all skills + CocoIndex on Windows, prompting only for the patungin.id API key.
> 
> **Deliverables**:
> - `install.ps1` - Main installer script (hosted, fetched via `irm`)
> - Modified `opencode.json` template with patungin as default provider
> - Modified `oh-my-openagent.json` template with patungin model routing
> - Post-install verification output
> 
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (scaffold) → Task 3 (core installer logic) → Task 5 (config templating) → Task 7 (integration test)

---

## Context

### Original Request
Build a one-liner PowerShell installer (`irm | iex` style) for friends to auto-install OpenCode with full OCS config. Platform: Windows only. Provider: ai.patungin.id as default.

### Interview Summary
**Key Discussions**:
- Platform: Windows only, PowerShell 5.1+ compatible
- Provider: patungin.id (OpenAI-compatible, baseURL: `https://ai.patungin.id/v1`)
- Skills: ALL 35 skills (13 OCS-managed + 22 user-level)
- CocoIndex: Include full setup
- Source: Configurable repo URL (user sets up hosting later)
- API Key: Prompt during install, inject into config

**Research Findings**:
- hermes-ocs-bundle is a self-contained git repo with all configs
- Existing `tools/verify-bundle.ps1` can be reused for post-install verification
- `scripts/setup.js` and `scripts/prefs-wizard.js` exist but are JS-based (need bun)
- Package deps require `bun install` (bun.lock present)
- MCP servers need npx (Node.js dependency)

### Metis Review
**Identified Gaps** (addressed):
- Prerequisites (bun, git, node) - Installer will auto-install bun via official installer if missing; use zip download (not git clone) to avoid git dependency; node/npx assumed present or installed via bun
- Idempotency - Detect existing install, prompt before overwrite
- API key validation - Hit patungin.id health endpoint to verify key works
- EXA_API_KEY - Skip during install, note in completion message
- No admin privileges required - Install to user directories only
- Progress feedback - Show clear step-by-step progress during install
- Error recovery - Each step validates before proceeding, clear error messages

---

## Work Objectives

### Core Objective
Create a single PowerShell script that, when fetched via `irm <url> | iex`, fully provisions a Windows machine with OpenCode + OCS configuration ready to use.

### Concrete Deliverables
- `install.ps1` - Main installer script (~200-400 lines)
- Config templates with patungin.id as default provider
- Post-install verification logic (reuse verify-bundle.ps1 patterns)

### Definition of Done
- [ ] `irm <local-test-url> | iex` completes without errors on clean Windows
- [ ] OpenCode binary installed at `~/.opencode/bin/rtk.exe`
- [ ] Config at `~/.config/opencode/` with patungin provider active
- [ ] All 35 skills present at correct locations
- [ ] CocoIndex binary + bridge script functional
- [ ] `opencode --version` returns valid output after install

### Must Have
- Single script execution (no manual steps after running one-liner)
- Patungin.id API key prompt with validation
- All 35 skills installed correctly
- Model routing configured for patungin models
- CocoIndex setup (ccc.exe + bridge)
- Progress indicators during install
- Idempotency detection (warn if existing install found)
- Error handling with clear messages at each step
- No admin/elevated privileges required
- PowerShell 5.1+ compatibility

### Must NOT Have (Guardrails)
- NO system PATH modifications without user consent
- NO admin privilege requirements
- NO silent overwrite of existing config (must prompt)
- NO hardcoded repo URLs (must be configurable at top of script)
- NO bundled binaries in the script itself (download at runtime)
- NO interactive prompts beyond API key (and overwrite confirmation if existing)
- NO dependency on git being installed (use zip/tar download)
- NO storing secrets in git-tracked locations
- NO touching files outside `~/.opencode/`, `~/.config/opencode/`, `~/.agents/`, `~/hermes-ocs-bundle/`

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (this is a standalone PowerShell script)
- **Automated tests**: Tests-after (verification built into the script itself + QA scenarios)
- **Framework**: PowerShell Pester (for script unit tests) + Bash/curl for API validation

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Script Logic**: Use Bash (PowerShell) - Run script sections, validate output
- **API/Backend**: Use Bash (curl) - Verify patungin.id endpoint responds
- **File System**: Use Bash (PowerShell) - Verify files exist at expected paths

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation - can all start immediately):
├── Task 1: Script scaffold + config variables [quick]
├── Task 2: Prerequisite detection functions (bun, node) [quick]
├── Task 3: Download/extract utility functions [quick]
└── Task 4: UI/progress display functions [quick]

Wave 2 (Core Logic - depends on Wave 1):
├── Task 5: OpenCode binary installer section [unspecified-high]
├── Task 6: Bundle download + extraction section [unspecified-high]
├── Task 7: Config templating (patungin provider + routing) [deep]
├── Task 8: Skills installation section [quick]
└── Task 9: CocoIndex setup section [unspecified-high]

Wave 3 (Integration - depends on Wave 2):
├── Task 10: API key prompt + validation [quick]
├── Task 11: Post-install verification + summary [unspecified-high]
└── Task 12: Full script assembly + end-to-end test [deep]

Wave FINAL (After ALL tasks):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | - | 5,6,7,8,9,10,11,12 | 1 |
| 2 | - | 5,6,9,12 | 1 |
| 3 | - | 5,6,8,9,12 | 1 |
| 4 | - | 5,6,7,8,9,10,11,12 | 1 |
| 5 | 1,2,3,4 | 11,12 | 2 |
| 6 | 1,2,3,4 | 7,8,9,11,12 | 2 |
| 7 | 1,6 | 10,11,12 | 2 |
| 8 | 1,3,6 | 11,12 | 2 |
| 9 | 1,2,3,6 | 11,12 | 2 |
| 10 | 1,4,7 | 11,12 | 3 |
| 11 | 5,6,7,8,9,10 | 12 | 3 |
| 12 | ALL | F1-F4 | 3 |

### Agent Dispatch Summary

- **Wave 1**: 4 tasks - T1→`quick`, T2→`quick`, T3→`quick`, T4→`quick`
- **Wave 2**: 5 tasks - T5→`unspecified-high`, T6→`unspecified-high`, T7→`deep`, T8→`quick`, T9→`unspecified-high`
- **Wave 3**: 3 tasks - T10→`quick`, T11→`unspecified-high`, T12→`deep`
- **FINAL**: 4 tasks - F1→`oracle`, F2→`unspecified-high`, F3→`unspecified-high`, F4→`deep`

---

## TODOs

- [x] 1. Script Scaffold + Configuration Variables

  **What to do**:
  - Create `install.ps1` with header comment block explaining usage (`irm <url> | iex`)
  - Define configurable variables at top of script:
    - `$OCS_REPO_URL` - Base URL for downloading bundle (default: empty, overridable via env var)
    - `$OPENCODE_VERSION` - Version to install (default: "latest")
    - `$INSTALL_DIR` - OpenCode binary location (default: `$HOME/.opencode`)
    - `$CONFIG_DIR` - Config location (default: `$HOME/.config/opencode`)
    - `$SKILLS_DIR` - User skills location (default: `$HOME/.agents/skills`)
    - `$BUNDLE_DIR` - Bundle location (default: `$HOME/hermes-ocs-bundle`)
  - Add PowerShell strict mode (`Set-StrictMode -Version Latest`, `$ErrorActionPreference = 'Stop'`)
  - Add minimum PS version check (5.1+)
  - Define script-wide constants (patungin baseURL, expected file counts, etc.)

  **Must NOT do**:
  - No hardcoded repo URLs in the variable defaults
  - No execution logic yet (just declarations)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file creation with variable declarations, no complex logic
  - **Skills**: []
    - No specialized skills needed for PowerShell scaffolding
  - **Skills Evaluated but Omitted**:
    - `senior-devops`: Overkill for variable declarations

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 5, 6, 7, 8, 9, 10, 11, 12
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `~/hermes-ocs-bundle/tools/verify-bundle.ps1` - PowerShell script structure and variable naming conventions used in OCS
  - `~/hermes-ocs-bundle/tools/sync-from-opencode.ps1` - How OCS scripts handle path variables and config

  **API/Type References**:
  - `~/hermes-ocs-bundle/opencode.json` (providers.patungin section) - baseURL and model definitions to reference

  **External References**:
  - PowerShell `Set-StrictMode`: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/set-strictmode

  **WHY Each Reference Matters**:
  - verify-bundle.ps1: Shows the existing PowerShell coding style (variable naming, error handling patterns) to match
  - opencode.json providers section: Contains the exact patungin config structure that the installer will template

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Script loads without syntax errors
    Tool: Bash (PowerShell)
    Preconditions: install.ps1 exists in project root
    Steps:
      1. Run: pwsh -NoProfile -Command "& { $null = [System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw './install.ps1'), [ref]$null) ; Write-Output 'SYNTAX_OK' }"
      2. Assert output contains "SYNTAX_OK"
    Expected Result: No parse errors, output is "SYNTAX_OK"
    Failure Indicators: Parse errors listed, no "SYNTAX_OK" output
    Evidence: .sisyphus/evidence/task-1-syntax-check.txt

  Scenario: Config variables have correct defaults
    Tool: Bash (PowerShell)
    Preconditions: install.ps1 exists
    Steps:
      1. Run: pwsh -NoProfile -Command "Select-String -Path './install.ps1' -Pattern '^\$INSTALL_DIR|^\$CONFIG_DIR|^\$SKILLS_DIR|^\$BUNDLE_DIR' | ForEach-Object { $_.Line }"
      2. Assert each variable references $HOME or $env:USERPROFILE
      3. Assert no hardcoded absolute paths
    Expected Result: 4 variables found, all using $HOME-relative paths
    Failure Indicators: Missing variables, hardcoded paths like "C:\Users\..."
    Evidence: .sisyphus/evidence/task-1-config-vars.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Message: `feat(installer): scaffold install.ps1 with config variables`
  - Files: `install.ps1`
  - Pre-commit: `pwsh -NoProfile -Command "[System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw './install.ps1'), [ref]$null)"`

- [x] 2. Prerequisite Detection Functions

  **What to do**:
  - Write function `Test-Prerequisite` that checks if a command exists in PATH
  - Write function `Install-Bun` that:
    - Checks if `bun` is available via `Get-Command bun -ErrorAction SilentlyContinue`
    - If missing: downloads and runs official bun installer (`irm bun.sh/install.ps1 | iex`)
    - Verifies bun is available after install
  - Write function `Test-NodeAvailable` that:
    - Checks if `node` and `npx` are available
    - If missing: warns user that MCP servers requiring npx won't work (non-blocking)
  - Write function `Test-DiskSpace` that:
    - Checks available disk space on target drive (need ~500MB)
    - Warns if insufficient

  **Must NOT do**:
  - No auto-installing Node.js (too complex, just warn)
  - No requiring admin privileges for any prerequisite install
  - No modifying system PATH (bun installer handles its own PATH)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Utility functions with straightforward logic, well-documented PowerShell patterns
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `senior-devops`: These are simple detection functions, not infrastructure automation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Tasks 5, 6, 9, 12
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `~/hermes-ocs-bundle/tools/verify-bundle.ps1` - How existing OCS scripts check for tool availability

  **External References**:
  - Bun official Windows installer: `https://bun.sh/install.ps1` - The exact command to install bun on Windows
  - PowerShell `Get-Command`: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/get-command

  **WHY Each Reference Matters**:
  - verify-bundle.ps1: Shows how OCS already checks for prerequisites (pattern to follow)
  - Bun installer URL: The exact URL the function will call if bun is missing

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Bun detection works when bun is installed
    Tool: Bash (PowerShell)
    Preconditions: bun is installed on the test machine
    Steps:
      1. Dot-source install.ps1 functions: pwsh -NoProfile -Command ". ./install.ps1 -FunctionsOnly; Test-Prerequisite 'bun'"
      2. Assert return value is $true
    Expected Result: Function returns $true, no error output
    Failure Indicators: Returns $false, throws exception
    Evidence: .sisyphus/evidence/task-2-bun-detection.txt

  Scenario: Node detection warns gracefully when node is missing
    Tool: Bash (PowerShell)
    Preconditions: Simulated environment without node in PATH
    Steps:
      1. Run: pwsh -NoProfile -Command "$env:PATH = 'C:\Windows\System32'; . ./install.ps1 -FunctionsOnly; Test-NodeAvailable"
      2. Assert output contains warning message (not error/exception)
      3. Assert function does NOT throw or halt execution
    Expected Result: Warning message displayed, execution continues (non-blocking)
    Failure Indicators: Script throws terminating error, no warning shown
    Evidence: .sisyphus/evidence/task-2-node-warning.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Message: `feat(installer): add prerequisite detection functions`
  - Files: `install.ps1`
  - Pre-commit: syntax check

- [x] 3. Download/Extract Utility Functions

  **What to do**:
  - Write function `Get-RemoteFile` that:
    - Downloads a file from URL to local path using `Invoke-WebRequest` (PS5.1 compatible)
    - Shows download progress (file size if available)
    - Handles HTTP errors with clear messages
    - Supports retry (1 retry with 3s delay)
    - Returns the local file path on success
  - Write function `Expand-Bundle` that:
    - Extracts a .zip archive to target directory
    - Uses `Expand-Archive` (built-in PS5.1+)
    - Handles extraction errors (corrupt zip, disk full)
    - Returns extracted directory path
  - Write function `Copy-DirectoryRecursive` that:
    - Copies directory tree preserving structure
    - Optionally skips existing files (for idempotency)
    - Reports count of files copied

  **Must NOT do**:
  - No dependency on external tools (7zip, tar) - use built-in Expand-Archive only
  - No git clone (avoid git dependency)
  - No downloading without progress indication

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard PowerShell utility functions with well-known patterns
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `senior-devops`: Simple file operations, not infrastructure

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Tasks 5, 6, 8, 9, 12
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `~/hermes-ocs-bundle/tools/sync-from-opencode.ps1` - How OCS handles file copying between directories

  **External References**:
  - `Invoke-WebRequest` PS5.1 docs: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/invoke-webrequest
  - `Expand-Archive` docs: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.archive/expand-archive

  **WHY Each Reference Matters**:
  - sync-from-opencode.ps1: Shows the file copy patterns already used in OCS (match the style)
  - Invoke-WebRequest: Must use PS5.1-compatible syntax (not PS7-only features)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Download function retrieves a file successfully
    Tool: Bash (PowerShell)
    Preconditions: Internet access available
    Steps:
      1. Run: pwsh -NoProfile -Command ". ./install.ps1 -FunctionsOnly; Get-RemoteFile -Url 'https://raw.githubusercontent.com/nicolo-ribaudo/tc39-proposal-structs/main/README.md' -OutPath '$env:TEMP/test-download.md'"
      2. Assert file exists at $env:TEMP/test-download.md
      3. Assert file size > 0
    Expected Result: File downloaded, size > 0 bytes
    Failure Indicators: File missing, size 0, exception thrown
    Evidence: .sisyphus/evidence/task-3-download-success.txt

  Scenario: Download function handles invalid URL gracefully
    Tool: Bash (PowerShell)
    Preconditions: None
    Steps:
      1. Run: pwsh -NoProfile -Command ". ./install.ps1 -FunctionsOnly; try { Get-RemoteFile -Url 'https://invalid.example.com/nonexistent' -OutPath '$env:TEMP/fail.txt' } catch { Write-Output \"CAUGHT: $($_.Exception.Message)\" }"
      2. Assert output contains "CAUGHT:" with meaningful error message
      3. Assert no file created at output path
    Expected Result: Exception caught with descriptive message, no partial file
    Failure Indicators: Unhandled exception, partial file left behind, generic error
    Evidence: .sisyphus/evidence/task-3-download-error.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Message: `feat(installer): add download and extract utility functions`
  - Files: `install.ps1`
  - Pre-commit: syntax check

- [x] 4. UI/Progress Display Functions

  **What to do**:
  - Write function `Write-Step` that displays a numbered step with emoji/symbol indicator:
    - `[1/9] Installing OpenCode binary...` format
    - Color-coded: green for success, yellow for warning, red for error
    - Uses `Write-Host` with `-ForegroundColor` (PS5.1 compatible)
  - Write function `Write-Success` for completion messages (green checkmark)
  - Write function `Write-Warning` for non-blocking warnings (yellow)
  - Write function `Write-Fatal` for blocking errors (red, then exit 1)
  - Write function `Write-Banner` that displays:
    - OCS installer ASCII art header (simple, 3-4 lines max)
    - Version info
    - "This will install OpenCode + OCS to your machine"
  - Write function `Write-Summary` for post-install summary:
    - Lists what was installed and where
    - Shows next steps (how to launch opencode)

  **Must NOT do**:
  - No complex ASCII art (keep it minimal, 3-4 lines)
  - No external dependencies for colors (use built-in Write-Host)
  - No clearing the screen or hiding previous output

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple display functions, no complex logic
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: This is terminal output, not web UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Tasks 5, 6, 7, 8, 9, 10, 11, 12
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL):

  **Pattern References**:
  - `~/hermes-ocs-bundle/scripts/progress-messenger.cjs` - How OCS displays progress (adapt pattern to PowerShell)

  **External References**:
  - PowerShell `Write-Host` color options: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/write-host

  **WHY Each Reference Matters**:
  - progress-messenger.cjs: Shows the UX pattern OCS uses for progress (step numbering, status indicators)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Step display shows correct formatting
    Tool: Bash (PowerShell)
    Preconditions: install.ps1 with UI functions exists
    Steps:
      1. Run: pwsh -NoProfile -Command ". ./install.ps1 -FunctionsOnly; Write-Step -Number 1 -Total 9 -Message 'Installing OpenCode binary...'"
      2. Assert output contains "[1/9]"
      3. Assert output contains "Installing OpenCode binary..."
    Expected Result: Formatted step output with number and message
    Failure Indicators: Missing formatting, exception, no output
    Evidence: .sisyphus/evidence/task-4-step-display.txt

  Scenario: Fatal error exits with code 1
    Tool: Bash (PowerShell)
    Preconditions: install.ps1 with UI functions exists
    Steps:
      1. Run: pwsh -NoProfile -Command ". ./install.ps1 -FunctionsOnly; Write-Fatal 'Something broke'; Write-Output 'SHOULD_NOT_REACH'"
      2. Assert exit code is 1
      3. Assert output does NOT contain "SHOULD_NOT_REACH"
    Expected Result: Script exits immediately with code 1, no further execution
    Failure Indicators: Exit code 0, "SHOULD_NOT_REACH" appears in output
    Evidence: .sisyphus/evidence/task-4-fatal-exit.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Message: `feat(installer): add UI and progress display functions`
  - Files: `install.ps1`
  - Pre-commit: syntax check

- [x] 5. OpenCode Binary Installer Section

  **What to do**:
  - Write function `Install-OpenCodeBinary` that:
    - Creates `$INSTALL_DIR/bin/` directory if not exists
    - Downloads OpenCode binary (rtk.exe) from `$OCS_REPO_URL/bin/rtk.exe` (or release URL)
    - Places binary at `$INSTALL_DIR/bin/rtk.exe`
    - Verifies binary runs: `& "$INSTALL_DIR/bin/rtk.exe" --version`
    - Adds `$INSTALL_DIR/bin` to user PATH if not already present (via `[Environment]::SetEnvironmentVariable`)
    - Displays success with version number
  - Write function `Test-ExistingInstall` that:
    - Checks if rtk.exe already exists at expected path
    - If exists: prompts user "Existing installation found. Overwrite? [Y/n]"
    - Returns boolean for proceed/skip

  **Must NOT do**:
  - No modifying system-level PATH (user-level only via `[Environment]::SetEnvironmentVariable('PATH', ..., 'User')`)
  - No downloading if binary already exists and user says no to overwrite
  - No admin privileges

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Binary installation with PATH manipulation requires careful error handling and platform awareness
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `senior-devops`: Not infrastructure automation, just file placement + PATH

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 9)
  - **Blocks**: Tasks 11, 12
  - **Blocked By**: Tasks 1, 2, 3, 4

  **References** (CRITICAL):

  **Pattern References**:
  - `~/.opencode/package.json` - Shows current OpenCode package structure and binary location
  - `~/.opencode/bin/rtk.exe` - The actual binary that needs to be replicated

  **API/Type References**:
  - `[Environment]::SetEnvironmentVariable` - .NET method for persistent PATH changes at user level

  **External References**:
  - PowerShell PATH modification: https://learn.microsoft.com/en-us/dotnet/api/system.environment.setenvironmentvariable

  **WHY Each Reference Matters**:
  - ~/.opencode/ structure: Shows exactly what the installed state should look like (target state)
  - SetEnvironmentVariable: The safe way to modify user PATH without admin

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Binary installation creates correct directory structure
    Tool: Bash (PowerShell)
    Preconditions: Clean test directory, Wave 1 functions available
    Steps:
      1. Set $INSTALL_DIR to temp test path
      2. Run Install-OpenCodeBinary function
      3. Assert: Test-Path "$INSTALL_DIR/bin/rtk.exe" returns True
      4. Run: & "$INSTALL_DIR/bin/rtk.exe" --version
      5. Assert output matches version pattern (e.g., "opencode v\d+\.\d+")
    Expected Result: Binary exists, executes, returns version
    Failure Indicators: Directory not created, binary missing, execution error
    Evidence: .sisyphus/evidence/task-5-binary-install.txt

  Scenario: Existing install detection prompts correctly
    Tool: Bash (PowerShell)
    Preconditions: rtk.exe already exists at target path
    Steps:
      1. Create dummy file at $INSTALL_DIR/bin/rtk.exe
      2. Run Test-ExistingInstall with simulated "n" input
      3. Assert function returns $false (skip installation)
      4. Assert existing file is NOT deleted
    Expected Result: User prompted, "n" response skips install, file preserved
    Failure Indicators: File deleted without prompt, no prompt shown, crash
    Evidence: .sisyphus/evidence/task-5-existing-detect.txt
  ```

  **Commit**: YES (group with Wave 2)
  - Message: `feat(installer): add OpenCode binary installation logic`
  - Files: `install.ps1`
  - Pre-commit: syntax check

- [x] 6. Bundle Download + Extraction Section

  **What to do**:
  - Write function `Install-OCSBundle` that:
    - Downloads bundle zip from `$OCS_REPO_URL/archive/main.zip` (or configured URL)
    - Extracts to `$BUNDLE_DIR` (~/hermes-ocs-bundle/)
    - Verifies key files exist after extraction:
      - `opencode.json`
      - `oh-my-openagent.json`
      - `package.json`
      - `skills/` directory
      - `scripts/` directory
    - Runs `bun install` in the bundle directory to install dependencies
    - Verifies `node_modules/` created and key packages present
  - Handle the case where bundle already exists:
    - Check for `$BUNDLE_DIR/hermes-bundle-manifest.json`
    - If exists: prompt "Bundle already installed. Update? [Y/n]"
    - If update: backup old config files, extract new, restore user customizations

  **Must NOT do**:
  - No git clone (use zip download to avoid git dependency)
  - No deleting user customizations on update
  - No proceeding if bun install fails (fatal error)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex extraction logic with idempotency handling and dependency installation
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `senior-devops`: Not CI/CD or infrastructure, just file extraction + npm-like install

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7, 8, 9)
  - **Blocks**: Tasks 7, 8, 9, 11, 12
  - **Blocked By**: Tasks 1, 2, 3, 4

  **References** (CRITICAL):

  **Pattern References**:
  - `~/hermes-ocs-bundle/hermes-bundle-manifest.json` - Manifest file that confirms valid bundle extraction
  - `~/hermes-ocs-bundle/package.json` - Dependencies that bun install must resolve
  - `~/hermes-ocs-bundle/tools/verify-bundle.ps1` - Existing verification logic to reuse/adapt

  **External References**:
  - Bun install docs: https://bun.sh/docs/cli/install

  **WHY Each Reference Matters**:
  - hermes-bundle-manifest.json: The "canary" file that proves bundle is correctly extracted
  - package.json: Shows exact deps that must be installed (bun install success criteria)
  - verify-bundle.ps1: Has existing checks we can call or adapt for post-extraction validation

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Bundle extracts with all required files
    Tool: Bash (PowerShell)
    Preconditions: Bundle zip available at configured URL
    Steps:
      1. Run Install-OCSBundle with test $BUNDLE_DIR
      2. Assert: Test-Path "$BUNDLE_DIR/opencode.json" -eq $true
      3. Assert: Test-Path "$BUNDLE_DIR/oh-my-openagent.json" -eq $true
      4. Assert: Test-Path "$BUNDLE_DIR/package.json" -eq $true
      5. Assert: Test-Path "$BUNDLE_DIR/skills" -eq $true (directory)
      6. Assert: Test-Path "$BUNDLE_DIR/node_modules" -eq $true (after bun install)
    Expected Result: All key files present, node_modules populated
    Failure Indicators: Missing files, bun install failure, empty node_modules
    Evidence: .sisyphus/evidence/task-6-bundle-extract.txt

  Scenario: Existing bundle triggers update prompt
    Tool: Bash (PowerShell)
    Preconditions: hermes-bundle-manifest.json exists at $BUNDLE_DIR
    Steps:
      1. Create $BUNDLE_DIR with manifest file
      2. Run Install-OCSBundle
      3. Assert prompt appears asking about update
      4. Simulate "n" response
      5. Assert existing bundle is NOT modified
    Expected Result: Prompt shown, "n" preserves existing bundle
    Failure Indicators: No prompt, existing files overwritten, crash
    Evidence: .sisyphus/evidence/task-6-bundle-existing.txt
  ```

  **Commit**: YES (group with Wave 2)
  - Message: `feat(installer): add bundle download and extraction logic`
  - Files: `install.ps1`
  - Pre-commit: syntax check

- [x] 7. Config Templating (Patungin Provider + Model Routing)

  **What to do**:
  - Write function `Set-PatunginConfig` that:
    - Reads `$BUNDLE_DIR/opencode.json` as JSON
    - Sets patungin as the active/default provider:
      - Ensures `providers.patungin` section exists with correct baseURL (`https://ai.patungin.id/v1`)
      - Injects the user's API key into `providers.patungin.options.apiKey`
    - Writes modified JSON to `$CONFIG_DIR/opencode.json`
    - Preserves all other config (MCP servers, plugins, other providers)
  - Write function `Set-AgentRouting` that:
    - Reads `$BUNDLE_DIR/oh-my-openagent.json`
    - Ensures all agents route through patungin models:
      - sisyphus → patungin/gpt-5.4 (max)
      - oracle → patungin/gpt-5.5 (max)
      - librarian → patungin/gpt-5.4 (high)
      - explore → patungin/gpt-5.3-codex (low)
      - multimodal-looker → patungin/gpt-5.4 (high)
      - prometheus → patungin/gpt-5.4 (max)
      - metis → patungin/gpt-5.4 (max)
      - momus → patungin/gpt-5.5 (high)
      - atlas → patungin/gpt-5.4 (max)
      - hephaestus → patungin/gpt-5.5 (max)
    - Writes to `$CONFIG_DIR/oh-my-openagent.json`
  - Write function `Copy-RemainingConfigs` that:
    - Copies all other JSON configs from bundle to config dir:
      - `oh-my-opencode.json`
      - `ocs-compression.json`
      - `compression-routing.json`
      - `dcp.jsonc`
      - `antigravity.json`
      - `resource-mode.json`
    - Does NOT modify these (straight copy)

  **Must NOT do**:
  - No removing other providers from opencode.json (keep them, just set patungin as active)
  - No hardcoding the API key in the script
  - No modifying agent routing beyond what's specified (preserve fallback configs)
  - No pretty-printing JSON differently than source (preserve formatting where possible)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: JSON manipulation with careful preservation of existing structure requires precision; multiple config files with interdependencies
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `senior-devops`: Not infrastructure config, just JSON file manipulation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 8, 9) — but depends on Task 6 completing first for bundle files
  - **Blocks**: Tasks 10, 11, 12
  - **Blocked By**: Tasks 1, 6

  **References** (CRITICAL):

  **Pattern References**:
  - `~/hermes-ocs-bundle/opencode.json` (full file) - The source config with all providers, MCP servers, plugins. Lines ~50-150 contain the providers section with patungin definition
  - `~/hermes-ocs-bundle/oh-my-openagent.json` (full file) - Agent routing definitions with model assignments and fallbacks
  - `~/hermes-ocs-bundle/scripts/prefs-wizard.js` - Existing preference/config modification logic (adapt pattern to PowerShell)

  **API/Type References**:
  - Patungin provider structure: `{ "npm": "@ai-sdk/openai-compatible", "name": "Patungin AI", "options": { "baseURL": "https://ai.patungin.id/v1", "apiKey": "" }, "models": {...} }`
  - Agent routing structure: Each agent has `{ "provider": "patungin", "model": "gpt-5.4", "thinking": "max" }`

  **External References**:
  - PowerShell JSON handling: `ConvertFrom-Json` / `ConvertTo-Json -Depth 20` (must use -Depth to preserve nested objects)

  **WHY Each Reference Matters**:
  - opencode.json: The EXACT structure that must be preserved — one wrong key and OpenCode won't start
  - oh-my-openagent.json: Contains the precise agent→model mapping that defines OCS behavior
  - prefs-wizard.js: Shows how OCS already handles config modification (logic to port)
  - -Depth 20: Critical — PowerShell's default ConvertTo-Json depth is 2, which DESTROYS nested config

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Patungin provider correctly injected with API key
    Tool: Bash (PowerShell)
    Preconditions: Bundle extracted, API key "test-key-123" available
    Steps:
      1. Run Set-PatunginConfig with test API key "test-key-123"
      2. Read $CONFIG_DIR/opencode.json
      3. Parse JSON: $config = Get-Content "$CONFIG_DIR/opencode.json" | ConvertFrom-Json
      4. Assert: $config.providers.patungin.options.apiKey -eq "test-key-123"
      5. Assert: $config.providers.patungin.options.baseURL -eq "https://ai.patungin.id/v1"
      6. Assert: $config.providers.google still exists (not deleted)
      7. Assert: $config.mcpServers still exists (not deleted)
    Expected Result: API key injected, baseURL correct, other config preserved
    Failure Indicators: Missing apiKey, wrong baseURL, other providers deleted, MCP servers gone
    Evidence: .sisyphus/evidence/task-7-patungin-config.txt

  Scenario: Agent routing maps all agents to patungin models
    Tool: Bash (PowerShell)
    Preconditions: Set-AgentRouting has been called
    Steps:
      1. Read $CONFIG_DIR/oh-my-openagent.json
      2. Parse JSON
      3. Assert: oracle uses patungin/gpt-5.5
      4. Assert: explore uses patungin/gpt-5.3-codex
      5. Assert: sisyphus uses patungin/gpt-5.4
      6. Assert all 10 agents have patungin as provider
    Expected Result: All agents correctly routed to patungin models
    Failure Indicators: Any agent missing, wrong model assignment, provider not "patungin"
    Evidence: .sisyphus/evidence/task-7-agent-routing.txt

  Scenario: JSON depth preservation (regression guard)
    Tool: Bash (PowerShell)
    Preconditions: Config written by Set-PatunginConfig
    Steps:
      1. Read $CONFIG_DIR/opencode.json raw
      2. Parse with ConvertFrom-Json
      3. Navigate to deeply nested path: $config.providers.patungin.models."gpt-5.5".thinking
      4. Assert value is an array (not null or flattened string)
    Expected Result: Deep nesting preserved (depth > 5 levels intact)
    Failure Indicators: Nested objects become null, arrays become strings, structure flattened
    Evidence: .sisyphus/evidence/task-7-json-depth.txt
  ```

  **Commit**: YES (group with Wave 2)
  - Message: `feat(installer): add config templating for patungin provider and agent routing`
  - Files: `install.ps1`
  - Pre-commit: syntax check

- [x] 8. Skills Installation Section

  **What to do**:
  - Write function `Install-OCSSkills` that:
    - Copies 13 OCS-managed skills from `$BUNDLE_DIR/skills/` to `$CONFIG_DIR/skills/`
    - Skills: caveman, frontend-ui-ux, impeccable-style, ocs-cocoindex-bootstrap, ocs-lsp-bootstrap, ocs-markdown-autofix, ocs-parallel-orchestration-grooming, ocs-product-marketing-context, ocs-programmatic-ai, ocs-runtime-validation, ocs-seo-audit, ocs-technical-copy-seo, ocs-test-regression-guard
  - Write function `Install-UserSkills` that:
    - Creates `$SKILLS_DIR` (~/.agents/skills/) if not exists
    - Copies 22 user-level skills from bundle's user-skills archive/directory
    - Skills: agent-development, browser-use, cavecrew, caveman-commit, caveman-compress, caveman-help, caveman-review, caveman-stats, caveman, claude-opus-4-5-migration, command-development, db-verifier, find-skills, frontend-design, hook-development, mcp-integration, plugin-settings, plugin-structure, senior-devops, skill-development, ui-ux-pro-max, writing-hookify-rules
    - Verifies each skill directory has a SKILL.md file
  - Report total skills installed: "Installed 35/35 skills"

  **Must NOT do**:
  - No overwriting existing skill customizations without prompt
  - No partial installation (all or nothing per skill set)
  - No downloading skills from external sources (all from bundle)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward directory copy operations with verification count
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - None relevant

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7, 9) — depends on Task 6 for bundle files
  - **Blocks**: Tasks 11, 12
  - **Blocked By**: Tasks 1, 3, 6

  **References** (CRITICAL):

  **Pattern References**:
  - `~/hermes-ocs-bundle/skills/` - Source directory for OCS-managed skills (13 subdirectories, each with SKILL.md)
  - `~/.agents/skills/` - Target directory structure for user-level skills (22 subdirectories)
  - `~/.config/opencode/skills/` - Target for OCS-managed skills

  **WHY Each Reference Matters**:
  - Bundle skills/: The exact source to copy from — each subdirectory is one skill
  - ~/.agents/skills/: The target structure that OpenCode expects for user-level skills
  - ~/.config/opencode/skills/: The target for OCS plugin-managed skills

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All 35 skills installed with SKILL.md present
    Tool: Bash (PowerShell)
    Preconditions: Bundle extracted, Install-OCSSkills and Install-UserSkills called
    Steps:
      1. Count directories in $CONFIG_DIR/skills/: (Get-ChildItem -Directory).Count
      2. Assert count -eq 13
      3. Count directories in $SKILLS_DIR: (Get-ChildItem -Directory).Count
      4. Assert count -eq 22
      5. Check each has SKILL.md: Get-ChildItem -Recurse -Filter "SKILL.md" | Measure-Object
      6. Assert SKILL.md count -eq 35
    Expected Result: 13 OCS skills + 22 user skills = 35 total, each with SKILL.md
    Failure Indicators: Count mismatch, missing SKILL.md in any skill directory
    Evidence: .sisyphus/evidence/task-8-skills-count.txt

  Scenario: Specific critical skills verified
    Tool: Bash (PowerShell)
    Preconditions: Skills installed
    Steps:
      1. Assert: Test-Path "$CONFIG_DIR/skills/caveman/SKILL.md"
      2. Assert: Test-Path "$CONFIG_DIR/skills/ocs-parallel-orchestration-grooming/SKILL.md"
      3. Assert: Test-Path "$SKILLS_DIR/ui-ux-pro-max/SKILL.md"
      4. Assert: Test-Path "$SKILLS_DIR/senior-devops/SKILL.md"
    Expected Result: All 4 specific skills present at correct locations
    Failure Indicators: Any path returns False
    Evidence: .sisyphus/evidence/task-8-skills-specific.txt
  ```

  **Commit**: YES (group with Wave 2)
  - Message: `feat(installer): add skills installation logic`
  - Files: `install.ps1`
  - Pre-commit: syntax check

- [x] 9. CocoIndex Setup Section

  **What to do**:
  - Write function `Install-CocoIndex` that:
    - Creates `$BUNDLE_DIR/cocoindex/` directory if not exists
    - Downloads `ccc.exe` binary from bundle repo's `bin/` or release URL
    - Places at `$BUNDLE_DIR/bin/ccc.exe`
    - Verifies binary runs: `& "$BUNDLE_DIR/bin/ccc.exe" --version`
    - Copies `scripts/cocoindex-mcp-bridge.cjs` to correct location
    - Verifies the MCP server config in opencode.json references correct paths:
      - `cocoindex-code` server should point to the bridge script + ccc.exe
    - Updates paths in config if they use absolute paths (replace with user's actual home dir)
  - Handle platform-specific path separators (Windows backslash)

  **Must NOT do**:
  - No starting CocoIndex service during install (just place files)
  - No modifying cocoindex config beyond path corrections
  - No requiring network access for CocoIndex after initial download

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Binary placement + config path correction requires careful path handling on Windows
  - **Skills**: [`ocs-cocoindex-bootstrap`]
    - `ocs-cocoindex-bootstrap`: Contains exact knowledge of CocoIndex setup, wrapper discovery, and recovery patterns
  - **Skills Evaluated but Omitted**:
    - `senior-devops`: Not infrastructure, just binary placement

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7, 8) — depends on Task 6 for bundle
  - **Blocks**: Tasks 11, 12
  - **Blocked By**: Tasks 1, 2, 3, 6

  **References** (CRITICAL):

  **Pattern References**:
  - `~/hermes-ocs-bundle/cocoindex/` - CocoIndex directory structure and files
  - `~/hermes-ocs-bundle/scripts/cocoindex-mcp-bridge.cjs` - Bridge script that connects MCP to ccc.exe
  - `~/hermes-ocs-bundle/opencode.json` (mcpServers.cocoindex-code section) - MCP server config referencing CocoIndex

  **External References**:
  - CocoIndex docs (if available in bundle README)

  **WHY Each Reference Matters**:
  - cocoindex/ directory: Shows the expected file layout for CocoIndex integration
  - cocoindex-mcp-bridge.cjs: The bridge script that must be at the correct path for MCP to find it
  - opencode.json mcpServers: Contains the exact command + args that launch CocoIndex — paths must be correct

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: CocoIndex binary placed and executable
    Tool: Bash (PowerShell)
    Preconditions: Bundle extracted, Install-CocoIndex called
    Steps:
      1. Assert: Test-Path "$BUNDLE_DIR/bin/ccc.exe" -eq $true
      2. Run: & "$BUNDLE_DIR/bin/ccc.exe" --version
      3. Assert exit code 0 and output contains version info
    Expected Result: ccc.exe exists and returns version without error
    Failure Indicators: File missing, execution error, non-zero exit code
    Evidence: .sisyphus/evidence/task-9-cocoindex-binary.txt

  Scenario: MCP bridge script at correct path
    Tool: Bash (PowerShell)
    Preconditions: CocoIndex installed
    Steps:
      1. Assert: Test-Path "$BUNDLE_DIR/scripts/cocoindex-mcp-bridge.cjs" -eq $true
      2. Read opencode.json mcpServers.cocoindex-code config
      3. Assert the "args" array references the bridge script path that actually exists
      4. Assert path uses correct Windows separators or is platform-agnostic
    Expected Result: Bridge script exists, config points to it correctly
    Failure Indicators: Script missing, config points to wrong path, Unix paths on Windows
    Evidence: .sisyphus/evidence/task-9-cocoindex-bridge.txt
  ```

  **Commit**: YES (group with Wave 2)
  - Message: `feat(installer): add CocoIndex setup logic`
  - Files: `install.ps1`
  - Pre-commit: syntax check

- [x] 10. API Key Prompt + Validation

  **What to do**:
  - Write function `Get-PatunginApiKey` that:
    - Displays clear prompt: "Enter your Patungin AI API key (from ai.patungin.id):"
    - Reads input using `Read-Host` (NOT `-AsSecureString` — needs to be plaintext for JSON injection)
    - Validates key is non-empty and has reasonable format (starts with expected prefix or min length)
    - Calls patungin.id health/models endpoint to verify key works:
      - `Invoke-RestMethod -Uri "https://ai.patungin.id/v1/models" -Headers @{ "Authorization" = "Bearer $apiKey" }`
    - If validation fails: show error, allow retry (max 3 attempts)
    - If validation succeeds: show "API key verified ✓" and return key
    - If user wants to skip validation (offline): allow with warning
  - Write function `Test-ApiKeyValid` that:
    - Hits the models endpoint with the key
    - Returns $true if HTTP 200, $false otherwise
    - Handles network errors gracefully (timeout, DNS failure)

  **Must NOT do**:
  - No storing the API key in the script itself
  - No logging/echoing the full API key (mask it in output: `sk-...xxxx`)
  - No blocking install entirely if validation fails (allow skip with warning)
  - No SecureString (needs plaintext for JSON config file)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple prompt + HTTP call + retry logic, well-defined pattern
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - None relevant

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential — needs config from Task 7)
  - **Blocks**: Tasks 11, 12
  - **Blocked By**: Tasks 1, 4, 7

  **References** (CRITICAL):

  **Pattern References**:
  - `~/hermes-ocs-bundle/scripts/exa-setup.js` - How OCS handles API key prompting for Exa (similar pattern to adapt)

  **API/Type References**:
  - Patungin API endpoint: `GET https://ai.patungin.id/v1/models` with `Authorization: Bearer <key>` header
  - Expected success: HTTP 200 with JSON body containing model list

  **External References**:
  - OpenAI-compatible `/v1/models` endpoint spec: returns `{ "data": [...] }` on success

  **WHY Each Reference Matters**:
  - exa-setup.js: Shows how OCS already handles API key collection (UX pattern to match)
  - /v1/models endpoint: The cheapest endpoint to validate a key (no tokens consumed, just auth check)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Valid API key passes validation
    Tool: Bash (PowerShell/curl)
    Preconditions: Valid patungin.id API key available in test env
    Steps:
      1. Run Test-ApiKeyValid with a valid key
      2. Assert function returns $true
      3. Assert no error output
    Expected Result: Returns $true, models endpoint responds 200
    Failure Indicators: Returns $false with valid key, network error not handled
    Evidence: .sisyphus/evidence/task-10-valid-key.txt

  Scenario: Invalid API key fails gracefully with retry
    Tool: Bash (PowerShell)
    Preconditions: None
    Steps:
      1. Run Test-ApiKeyValid with key "invalid-key-12345"
      2. Assert function returns $false
      3. Assert error message is user-friendly (not raw HTTP exception)
      4. Assert masked key shown in output (not full key)
    Expected Result: Returns $false, friendly error message, key masked
    Failure Indicators: Unhandled exception, full key exposed in output, no retry offered
    Evidence: .sisyphus/evidence/task-10-invalid-key.txt

  Scenario: Network timeout handled gracefully
    Tool: Bash (PowerShell)
    Preconditions: Simulated network failure (unreachable host)
    Steps:
      1. Run Test-ApiKeyValid with valid key format but against unreachable endpoint
      2. Assert function returns $false (not throws)
      3. Assert output mentions network/connectivity issue
      4. Assert user is offered to skip validation
    Expected Result: Graceful failure with network error message, skip option
    Failure Indicators: Unhandled timeout exception, script hangs, no skip option
    Evidence: .sisyphus/evidence/task-10-network-error.txt
  ```

  **Commit**: YES (group with Wave 3)
  - Message: `feat(installer): add API key prompt with validation`
  - Files: `install.ps1`
  - Pre-commit: syntax check

- [x] 11. Post-Install Verification + Summary

  **What to do**:
  - Write function `Test-Installation` that verifies the ENTIRE install succeeded:
    - Binary check: `& "$INSTALL_DIR/bin/rtk.exe" --version` returns valid output
    - Config check: `$CONFIG_DIR/opencode.json` exists and is valid JSON
    - Routing check: `$CONFIG_DIR/oh-my-openagent.json` exists and contains patungin references
    - Skills check: Count skill directories (expect 35 total across both locations)
    - CocoIndex check: `$BUNDLE_DIR/bin/ccc.exe` exists
    - Dependencies check: `$BUNDLE_DIR/node_modules/` exists and has key packages
    - PATH check: `opencode` or `rtk` is findable via `Get-Command`
  - Write function `Show-InstallSummary` that displays:
    - ASCII checkmark + "Installation Complete!"
    - Table of what was installed:
      ```
      Component          Location                        Status
      ─────────          ────────                        ──────
      OpenCode binary    ~/.opencode/bin/rtk.exe         ✓
      OCS Config         ~/.config/opencode/             ✓
      OCS Bundle         ~/hermes-ocs-bundle/            ✓
      Skills (35)        ~/.agents/skills/ + config      ✓
      CocoIndex          ~/hermes-ocs-bundle/bin/ccc.exe ✓
      Provider           patungin.id                     ✓
      ```
    - Next steps section:
      - "Run `opencode` to start"
      - "Your API key is configured for patungin.id"
      - Note about EXA_API_KEY being optional (for web search MCP)
    - Warning section (if any non-critical issues):
      - Node.js not found (npx MCP servers won't work)
      - Any skipped components
  - Reuse patterns from existing `tools/verify-bundle.ps1` where applicable

  **Must NOT do**:
  - No failing the entire install if a non-critical check fails (warn instead)
  - No exposing the API key in the summary
  - No suggesting manual steps that should have been automated

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Comprehensive verification logic touching all installed components, formatted output
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `ocs-runtime-validation`: Close match but that skill is for runtime behavior validation, not install verification

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential — needs ALL prior tasks complete)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 5, 6, 7, 8, 9, 10

  **References** (CRITICAL):

  **Pattern References**:
  - `~/hermes-ocs-bundle/tools/verify-bundle.ps1` - Existing verification script with checks to reuse/adapt directly
  - `~/hermes-ocs-bundle/scripts/progress-messenger.cjs` - Output formatting patterns

  **WHY Each Reference Matters**:
  - verify-bundle.ps1: Has EXISTING verification checks (file existence, JSON validity, dependency checks) — don't reinvent, adapt
  - progress-messenger.cjs: Shows the summary/table formatting style OCS uses

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full verification passes on complete install
    Tool: Bash (PowerShell)
    Preconditions: All prior install steps completed successfully
    Steps:
      1. Run Test-Installation
      2. Assert all checks return $true
      3. Assert no error output
      4. Run Show-InstallSummary
      5. Assert output contains "Installation Complete"
      6. Assert output contains all 6 component rows with "✓"
    Expected Result: All checks pass, summary shows all green
    Failure Indicators: Any check fails, summary missing components, error thrown
    Evidence: .sisyphus/evidence/task-11-full-verify.txt

  Scenario: Partial install shows warnings (not errors)
    Tool: Bash (PowerShell)
    Preconditions: Install completed but node.js is missing
    Steps:
      1. Temporarily remove node from PATH
      2. Run Test-Installation
      3. Assert critical checks still pass (binary, config, skills)
      4. Assert node-related check shows WARNING (not ERROR)
      5. Assert Show-InstallSummary still shows "Installation Complete" (with warnings section)
    Expected Result: Non-critical failure = warning, install still considered successful
    Failure Indicators: Install marked as failed due to missing node, no warning section
    Evidence: .sisyphus/evidence/task-11-partial-verify.txt
  ```

  **Commit**: YES (group with Wave 3)
  - Message: `feat(installer): add post-install verification and summary`
  - Files: `install.ps1`
  - Pre-commit: syntax check

- [x] 12. Full Script Assembly + End-to-End Test

  **What to do**:
  - Assemble all functions from Tasks 1-11 into a single cohesive `install.ps1` script with proper execution flow:
    ```
    1. Write-Banner (welcome message)
    2. Test-ExistingInstall (idempotency check)
    3. Test-Prerequisite checks (bun, node)
    4. Install-Bun (if missing)
    5. Get-PatunginApiKey (prompt + validate)
    6. Install-OpenCodeBinary (download + place binary)
    7. Install-OCSBundle (download + extract + bun install)
    8. Set-PatunginConfig (inject API key into config)
    9. Set-AgentRouting (configure model routing)
    10. Copy-RemainingConfigs (other JSON configs)
    11. Install-OCSSkills + Install-UserSkills (all 35 skills)
    12. Install-CocoIndex (binary + bridge)
    13. Test-Installation (verify everything)
    14. Show-InstallSummary (final output)
    ```
  - Add top-level try/catch wrapping the entire flow:
    - On error: show which step failed, what to do next, and how to retry
    - Clean up partial state if possible (or leave for retry)
  - Add `-FunctionsOnly` switch parameter for testing (dot-source without executing)
  - Add comment header with:
    - Usage: `irm <url> | iex`
    - Description of what the script does
    - Version number
    - Source URL placeholder
  - Ensure the script works when piped via `irm | iex`:
    - No `$PSScriptRoot` usage (won't work in piped context)
    - No file-relative paths (use absolute paths from variables)
    - Handle the fact that `$MyInvocation` differs in piped context
  - Run full end-to-end test: simulate the entire install flow

  **Must NOT do**:
  - No leaving debug/test code in final script
  - No `Write-Debug` or `Write-Verbose` without proper preference variable checks
  - No assumptions about current directory (use absolute paths everywhere)
  - No breaking the `irm | iex` execution model (script must work when streamed)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Integration task requiring careful ordering, error handling across all components, and `irm | iex` compatibility which has subtle gotchas
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `senior-devops`: Close but this is script assembly, not infrastructure automation

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final task, sequential)
  - **Blocks**: F1, F2, F3, F4
  - **Blocked By**: ALL Tasks 1-11

  **References** (CRITICAL):

  **Pattern References**:
  - `~/hermes-ocs-bundle/scripts/setup.js` - Existing OCS setup script showing the full installation flow order and error handling
  - `~/hermes-ocs-bundle/tools/verify-bundle.ps1` - PowerShell script structure with proper error handling patterns
  - Bun's official installer (`bun.sh/install.ps1`) - Reference for how a production `irm | iex` script is structured (no $PSScriptRoot, proper piped execution)

  **External References**:
  - PowerShell `irm | iex` gotchas: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/invoke-expression
  - `$MyInvocation` behavior in piped scripts differs from file-based execution

  **WHY Each Reference Matters**:
  - setup.js: Shows the canonical OCS install order (what depends on what) — port this logic
  - verify-bundle.ps1: The error handling and validation patterns to use in the wrapper try/catch
  - Bun installer: A real-world example of `irm | iex` that handles all the edge cases (study its structure)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full install completes on clean environment
    Tool: Bash (PowerShell)
    Preconditions: No existing OCS installation, bun available, internet access
    Steps:
      1. Set $OCS_REPO_URL to test bundle location
      2. Pipe script content to Invoke-Expression (simulating irm | iex)
      3. Provide test API key when prompted
      4. Wait for completion
      5. Assert exit code 0
      6. Assert "Installation Complete" in output
      7. Verify: Test-Path "~/.opencode/bin/rtk.exe"
      8. Verify: Test-Path "~/.config/opencode/opencode.json"
      9. Verify: (Get-ChildItem "~/.agents/skills" -Directory).Count -ge 22
    Expected Result: Full install succeeds, all files in place, summary shown
    Failure Indicators: Non-zero exit, missing files, error messages, hung prompt
    Evidence: .sisyphus/evidence/task-12-full-install.txt

  Scenario: Script works via irm | iex pattern (piped execution)
    Tool: Bash (PowerShell)
    Preconditions: Script hosted at accessible URL (or local file server)
    Steps:
      1. Host install.ps1 on local HTTP server (python -m http.server or similar)
      2. Run: Invoke-RestMethod "http://localhost:8000/install.ps1" | Invoke-Expression
      3. Assert script executes without "$PSScriptRoot is empty" errors
      4. Assert all path variables resolve correctly
      5. Assert prompt for API key appears
    Expected Result: Piped execution works identically to direct execution
    Failure Indicators: $PSScriptRoot errors, path resolution failures, different behavior than direct run
    Evidence: .sisyphus/evidence/task-12-piped-execution.txt

  Scenario: Error during install shows recovery instructions
    Tool: Bash (PowerShell)
    Preconditions: Simulate failure (e.g., invalid bundle URL)
    Steps:
      1. Set $OCS_REPO_URL to invalid URL
      2. Run install.ps1
      3. Assert script catches the error (doesn't crash with raw exception)
      4. Assert output contains: which step failed, what to check, how to retry
      5. Assert partial files are noted (not silently left behind)
    Expected Result: Friendly error with step number, diagnosis hint, retry instructions
    Failure Indicators: Raw PowerShell exception, no recovery guidance, silent failure
    Evidence: .sisyphus/evidence/task-12-error-recovery.txt

  Scenario: Idempotent re-run detects existing install
    Tool: Bash (PowerShell)
    Preconditions: Previous successful install exists
    Steps:
      1. Run install.ps1 again
      2. Assert prompt appears: "Existing installation found"
      3. Simulate "n" (don't overwrite)
      4. Assert script exits cleanly without modifying existing files
      5. Verify existing config unchanged (compare hash before/after)
    Expected Result: Existing install detected, user prompted, "n" preserves everything
    Failure Indicators: No detection, overwrites without asking, crashes on existing files
    Evidence: .sisyphus/evidence/task-12-idempotent.txt
  ```

  **Commit**: YES (final commit)
  - Message: `feat(installer): assemble complete install.ps1 with end-to-end flow`
  - Files: `install.ps1`
  - Pre-commit: `pwsh -NoProfile -Command "[System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw './install.ps1'), [ref]$null)" && pwsh -NoProfile -File ./install.ps1 -FunctionsOnly`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run PowerShell Script Analyzer on install.ps1. Review for: hardcoded secrets, missing error handling, unquoted paths, missing -ErrorAction, Write-Host without color coding, unreachable code. Check AI slop: excessive comments, over-abstraction, generic variable names.
  Output: `Analyzer [PASS/FAIL] | Issues [N] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Execute install.ps1 in a clean PowerShell session. Verify each installation step completes. Check all files land at correct paths. Verify opencode launches. Test with invalid API key (should fail gracefully). Test idempotency (run twice).
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual implementation. Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(installer): scaffold installer script with utility functions` - install.ps1
- **Wave 2**: `feat(installer): add core installation logic` - install.ps1
- **Wave 3**: `feat(installer): add API key validation and verification` - install.ps1
- **Final**: `feat(installer): complete one-liner OCS installer` - install.ps1, README section

---

## Success Criteria

### Verification Commands
```powershell
# Test the installer locally
$env:OCS_REPO_URL = "file:///C:/path/to/local/bundle"
.\install.ps1  # Should complete with only API key prompt

# Verify installation
Test-Path "~/.opencode/bin/rtk.exe"           # Expected: True
Test-Path "~/.config/opencode/opencode.json"  # Expected: True
Test-Path "~/.agents/skills"                  # Expected: True
& "~/.opencode/bin/rtk.exe" --version         # Expected: version string
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] Script runs without errors on clean Windows
- [ ] API key validation works (valid key accepted, invalid rejected)
- [ ] Idempotency handled (existing install detected and prompted)
- [ ] All 35 skills present at correct paths
- [ ] CocoIndex functional
- [ ] No admin privileges required at any step
