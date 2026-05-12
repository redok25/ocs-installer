
## Wave 1 - install.ps1 Foundation (2026-05-13)

### Patterns established
- `param([switch]$FunctionsOnly)` at top — enables `irm | iex` usage AND testable function loading
- PS version guard uses `$PSVersionTable.PSVersion.Major/Minor` comparison (PS5.1 compat, no ternary)
- Config vars use `if ($env:VAR) { $env:VAR } else { default }` pattern (no `??` null-coalescing)
- All paths via `Join-Path $HOME "..."` — never string concat, never `$env:USERPROFILE`
- `Test-Path -LiteralPath` everywhere for existence checks
- `Get-ChildItem -LiteralPath` for directory traversal

### Naming decisions
- Custom warning function named `Write-Warn` (NOT `Write-Warning`) to avoid conflict with built-in cmdlet
- UI functions: Write-Step, Write-Success, Write-Warn, Write-Fatal, Write-Banner, Write-Summary

### Download function notes
- `Get-RemoteFile` uses `Invoke-WebRequest -UseBasicParsing` for PS5.1 compat (no `Invoke-RestMethod` for binary files)
- 2 attempts max, 3s delay between retries, throws on final failure

### Copy-DirectoryRecursive
- Uses `.Substring($Source.Length).TrimStart('\', '/')` for relative path calculation
- Returns file count (int) for caller reporting

### Syntax verification
- `[System.Management.Automation.PSParser]::Tokenize()` confirms clean parse
- File is ~240 lines — within the 300-line budget for Wave 1

## Wave 2 - Binary Install Functions (2026-05-13)

### Test-ExistingInstall
- Uses `Read-Host` for prompt (irm | iex compatible)
- Returns `$true` to proceed, `$false` to skip
- Empty input or Y/y = proceed (default yes)

### Install-OpenCodeBinary
- Creates `$INSTALL_DIR/bin/` via `New-Item -ItemType Directory -Force`
- Downloads via existing `Get-RemoteFile` (not Invoke-RestMethod)
- Verifies with `& "$binaryPath" --version` + `$LASTEXITCODE` check
- PATH dedup: splits on `;`, case-insensitive `-ieq` compare, joins back
- USER-level only: `[Environment]::SetEnvironmentVariable('PATH', $newPath, 'User')`
- Refreshes `$env:PATH` in current session after modification
- `$version` captured from `--version` output for success message

### Verification
- `pwsh -NoProfile -File install.ps1 -FunctionsOnly` → LOAD_OK

### Write-Step gotcha
- `Write-Step` requires `[int]$Number, [int]$Total, [string]$Message` — NOT a simple string call
- Inside utility functions called from the main flow, use `Write-Host "  msg..." -ForegroundColor DarkGray` instead (matches Install-Bun pattern at line 107)

## Wave 3 - OCS Bundle Install Functions (2026-05-13)

### Test-ExistingBundle
- Checks for `hermes-bundle-manifest.json` in `$BUNDLE_DIR` (not package.json — manifest is the sentinel)
- Same Read-Host / return bool pattern as Test-ExistingInstall
- Default yes: empty or Y/y = proceed

### Install-OCSBundle
- Uses `[System.IO.Path]::GetTempPath()` for temp dir (not `$env:TEMP` — more reliable cross-PS)
- GitHub archive zip extracts into a subdirectory (e.g. `repo-main/`) — must `Get-ChildItem -Directory | Select-Object -First 1` to find inner dir
- Cleans up both zip and extract dir after copy (ErrorAction SilentlyContinue on cleanup)
- `bun install --cwd "$BUNDLE_DIR"` — uses --cwd flag, not Set-Location
- Pipes bun output through ForEach-Object for indented DarkGray display
- Verifies node_modules after bun install (same pattern as binary --version check)
- Key files verified: opencode.json, oh-my-openagent.json, package.json, skills/, scripts/

### Verification
- `pwsh -NoProfile -File install.ps1 -FunctionsOnly` → EXIT:0

## Wave 4 - Skills Installation Functions (2026-05-13)

### Install-OCSSkills / Install-UserSkills patterns
- Source dirs: `$BUNDLE_DIR/skills/` (OCS) and `$BUNDLE_DIR/user-skills/` (user)
- Dest dirs: `$CONFIG_DIR/skills/` (OCS) and `$SKILLS_DIR` (user)
- Enumerate with `Get-ChildItem -LiteralPath $sourceDir -Directory`
- Warn-and-skip (not fail) when individual skill missing SKILL.md
- `Copy-DirectoryRecursive -SkipExisting` preserves user customizations
- Report format: "Installed X/$EXPECTED_*_COUNT skills"
- Both functions guard on missing source dir with Write-Warn + return (not Write-Fatal)

## Wave 11 - Test-Installation + Show-InstallSummary (2026-05-13)

### Test-Installation
- Returns hashtable with 8 keys: Binary, Config, Routing, OCS Skills, User Skills, CocoIndex, Dependencies, PATH
- OK/WARN/FAIL: Binary + Config + Routing are FAIL on miss; rest are WARN (non-critical)
- Each check wrapped in try/catch — never throws
- Progress via `Write-Host "  Checking X..." -ForegroundColor DarkGray`
- Binary check: `& (Join-Path $INSTALL_DIR "bin\rtk.exe") --version` + `$LASTEXITCODE -eq 0`
- Config check: `ConvertFrom-Json` inside try/catch to validate JSON
- Routing check: `-match "patungin"` on raw file content
- Skills counts: `@(Get-ChildItem -LiteralPath $path -Directory).Count` — array wrap ensures int even on 0/1 results
- PATH check: `Get-Command rtk -ErrorAction SilentlyContinue` + null check

### Show-InstallSummary
- Param: `[hashtable]$Results`
- Detects warns by iterating Keys, collecting WARN items into `$warnItems` array
- Header: Green "Installation Complete!" or Yellow "Installation Complete (with warnings)"
- Calls existing `Write-Summary -Components $Results` for the table
- Next Steps section uses single-quoted strings for backtick literals (avoids PS interpolation)
- Warnings section only rendered if `$hasWarns -eq $true`

### Verification
- `pwsh -NoProfile -File install.ps1 -FunctionsOnly` → no output, exit 0
