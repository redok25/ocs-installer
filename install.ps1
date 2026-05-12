<#
.SYNOPSIS
    OCS Installer - OpenCode Setup for Windows
.DESCRIPTION
    Installs OpenCode and OCS configuration (skills, agents, hooks) to your machine.
    Can be run directly or piped from a remote URL:
        irm https://example.com/install.ps1 | iex
.PARAMETER FunctionsOnly
    Load functions without executing the main install flow. Useful for testing.
.VERSION
    1.0.0
#>
param(
    [switch]$FunctionsOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# PowerShell version check (minimum 5.1)
if ($PSVersionTable.PSVersion.Major -lt 5 -or
    ($PSVersionTable.PSVersion.Major -eq 5 -and $PSVersionTable.PSVersion.Minor -lt 1)) {
    Write-Host "ERROR: PowerShell 5.1 or higher is required. Current: $($PSVersionTable.PSVersion)" -ForegroundColor Red
    throw "PowerShell 5.1+ required"
}

# ---------------------------------------------------------------------------
# Configuration Variables (override via environment variables)
# ---------------------------------------------------------------------------
$OCS_REPO_URL     = if ($env:OCS_REPO_URL)     { $env:OCS_REPO_URL }     else { "https://github.com/redok25/ocs-installer" }
$OPENCODE_VERSION = if ($env:OPENCODE_VERSION)  { $env:OPENCODE_VERSION } else { "latest" }
$INSTALL_DIR      = if ($env:OCS_INSTALL_DIR)   { $env:OCS_INSTALL_DIR }  else { Join-Path $HOME ".opencode" }
$CONFIG_DIR       = if ($env:OCS_CONFIG_DIR)    { $env:OCS_CONFIG_DIR }   else { Join-Path $HOME ".config/opencode" }
$SKILLS_DIR       = if ($env:OCS_SKILLS_DIR)    { $env:OCS_SKILLS_DIR }   else { Join-Path $HOME ".agents/skills" }
$BUNDLE_DIR       = if ($env:OCS_BUNDLE_DIR)    { $env:OCS_BUNDLE_DIR }   else { Join-Path $HOME "hermes-ocs-bundle" }

$PATUNGIN_BASE_URL          = "https://ai.patungin.id/v1"
$EXPECTED_OCS_SKILLS_COUNT  = 13
$EXPECTED_USER_SKILLS_COUNT = 22
$TOTAL_INSTALL_STEPS        = 8

# ---------------------------------------------------------------------------
# UI / Display Functions
# ---------------------------------------------------------------------------
function Write-Step {
    param(
        [Parameter(Mandatory)][int]$Number,
        [Parameter(Mandatory)][int]$Total,
        [Parameter(Mandatory)][string]$Message
    )
    Write-Host "[$Number/$Total] $Message..." -ForegroundColor Cyan
}

function Write-Success {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [WARN] $Message" -ForegroundColor Yellow
}

function Write-Fatal {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "  [ERROR] $Message" -ForegroundColor Red
    throw $Message
}

function Write-Banner {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║   OCS Installer - OpenCode Setup    ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "This will install OpenCode + OCS configuration to your machine." -ForegroundColor White
}

function Write-Summary {
    param([Parameter(Mandatory)][hashtable]$Components)
    Write-Host ""
    Write-Host "Installation Summary:" -ForegroundColor Cyan
    Write-Host "─────────────────────────────────────────" -ForegroundColor DarkGray
    foreach ($key in $Components.Keys) {
        $status = $Components[$key]
        $color = if ($status -eq 'OK') { 'Green' } else { 'Yellow' }
        Write-Host ("  {0,-30} {1}" -f $key, $status) -ForegroundColor $color
    }
    Write-Host "─────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Prerequisite Detection Functions
# ---------------------------------------------------------------------------
function Test-Prerequisite {
    param([Parameter(Mandatory)][string]$Command)
    $found = Get-Command $Command -ErrorAction SilentlyContinue
    return ($null -ne $found)
}

function Install-Bun {
    if (Test-Prerequisite 'bun') {
        Write-Success "bun already installed: $(bun --version)"
        return
    }
    Write-Host "  Installing bun..." -ForegroundColor DarkGray
    try {
        Invoke-Expression (Invoke-RestMethod 'https://bun.sh/install.ps1')
    } catch {
        Write-Fatal "Failed to install bun: $_"
    }
    # Refresh PATH for current session
    $userPath    = [System.Environment]::GetEnvironmentVariable('PATH', 'User')
    $machinePath = [System.Environment]::GetEnvironmentVariable('PATH', 'Machine')
    $env:PATH    = $userPath + ';' + $machinePath
    if (-not (Test-Prerequisite 'bun')) {
        Write-Fatal "bun installation completed but 'bun' command not found. Restart your terminal and re-run."
    }
    Write-Success "bun installed: $(bun --version)"
}

function Test-NodeAvailable {
    $nodeOk = Test-Prerequisite 'node'
    $npxOk  = Test-Prerequisite 'npx'
    if (-not $nodeOk) {
        Write-Warn "node not found in PATH. Some features may not work."
    }
    if (-not $npxOk) {
        Write-Warn "npx not found in PATH. Some features may not work."
    }
    return ($nodeOk -and $npxOk)
}

function Test-DiskSpace {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][int]$RequiredMB
    )
    try {
        $drive = Split-Path -Qualifier $Path
        $disk  = Get-PSDrive -Name ($drive.TrimEnd(':')) -ErrorAction SilentlyContinue
        if ($null -eq $disk) {
            Write-Warn "Could not determine disk space for path: $Path"
            return $true
        }
        $freeMB = [math]::Floor($disk.Free / 1MB)
        if ($freeMB -lt $RequiredMB) {
            Write-Warn "Low disk space: ${freeMB}MB free, ${RequiredMB}MB recommended on $drive"
            return $false
        }
        return $true
    } catch {
        Write-Warn "Disk space check failed: $_"
        return $true
    }
}

# ---------------------------------------------------------------------------
# Download / Extract Utility Functions
# ---------------------------------------------------------------------------
function Get-RemoteFile {
    param(
        [Parameter(Mandatory)][string]$Url,
        [Parameter(Mandatory)][string]$OutPath,
        [hashtable]$Headers = @{}
    )
    $maxAttempts = 2
    $attempt     = 0
    while ($attempt -lt $maxAttempts) {
        $attempt++
        try {
            $leaf = Split-Path $OutPath -Leaf
            Write-Host "  Downloading $leaf (attempt $attempt)..." -ForegroundColor DarkGray
            if ($Headers.Count -gt 0) {
                Invoke-WebRequest -Uri $Url -OutFile $OutPath -UseBasicParsing -Headers $Headers
            } else {
                Invoke-WebRequest -Uri $Url -OutFile $OutPath -UseBasicParsing
            }
            Write-Success "Downloaded to $OutPath"
            return
        } catch {
            if ($attempt -lt $maxAttempts) {
                Write-Warn "Download failed, retrying in 3s... ($_)"
                Start-Sleep -Seconds 3
            } else {
                throw "Failed to download '$Url' after $maxAttempts attempts: $_"
            }
        }
    }
}

function Expand-Bundle {
    param(
        [Parameter(Mandatory)][string]$ZipPath,
        [Parameter(Mandatory)][string]$DestPath
    )
    try {
        if (-not (Test-Path -LiteralPath $ZipPath)) {
            throw "Zip file not found: $ZipPath"
        }
        Expand-Archive -LiteralPath $ZipPath -DestinationPath $DestPath -Force
        Write-Success "Extracted to $DestPath"
        return $DestPath
    } catch {
        throw "Failed to extract '$ZipPath': $_"
    }
}

function Copy-DirectoryRecursive {
    param(
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination,
        [switch]$SkipExisting
    )
    if (-not (Test-Path -LiteralPath $Source)) {
        throw "Source directory not found: $Source"
    }
    if (-not (Test-Path -LiteralPath $Destination)) {
        New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    }
    $files = Get-ChildItem -LiteralPath $Source -Recurse -File
    $count = 0
    foreach ($file in $files) {
        $relative  = $file.FullName.Substring($Source.Length).TrimStart('\', '/')
        $target    = Join-Path $Destination $relative
        $targetDir = Split-Path $target -Parent
        if (-not (Test-Path -LiteralPath $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }
        if ($SkipExisting -and (Test-Path -LiteralPath $target)) {
            continue
        }
        Copy-Item -LiteralPath $file.FullName -Destination $target -Force
        $count++
    }
    return $count
}

# ---------------------------------------------------------------------------
# OpenCode Binary Installation Functions
# ---------------------------------------------------------------------------
function Test-ExistingInstall {
    $binaryPath = Join-Path $INSTALL_DIR "bin\rtk.exe"
    if (-not (Test-Path -LiteralPath $binaryPath)) {
        return $true
    }
    $answer = Read-Host "Existing installation found at '$binaryPath'. Overwrite? [Y/n]"
    if ($answer -eq '' -or $answer -match '^[Yy]') {
        return $true
    }
    return $false
}

function Install-OpenCodeBinary {
    $binDir     = Join-Path $INSTALL_DIR "bin"
    $binaryPath = Join-Path $binDir "rtk.exe"
    $binaryUrl  = "https://raw.githubusercontent.com/redok25/ocs-installer/master/bin/rtk.exe"

    # Ensure bin directory exists
    if (-not (Test-Path -LiteralPath $binDir)) {
        New-Item -ItemType Directory -Path $binDir -Force | Out-Null
    }

    # Install opencode-ai CLI globally via npm
    Write-Host "  Installing opencode-ai CLI..." -ForegroundColor DarkGray
    try {
        $npmOutput = npm install -g opencode-ai 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed: $npmOutput"
        }
        Write-Host "  opencode-ai CLI installed globally" -ForegroundColor DarkGray
    } catch {
        Write-Fatal "Failed to install opencode-ai: $_"
    }

    # Download rtk proxy binary
    Write-Host "  Downloading rtk proxy binary..." -ForegroundColor DarkGray
    try {
        Get-RemoteFile -Url $binaryUrl -OutPath $binaryPath
    } catch {
        Write-Fatal "Failed to download rtk binary: $_"
    }

    # Set up ~/.opencode/package.json for plugin
    $packageJsonPath = Join-Path $INSTALL_DIR "package.json"
    if (-not (Test-Path -LiteralPath $packageJsonPath)) {
        $packageJson = @{ dependencies = @{ "@opencode-ai/plugin" = "1.14.48" } }
        $packageJson | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $packageJsonPath -Encoding UTF8
        Write-Host "  Running npm install in $INSTALL_DIR..." -ForegroundColor DarkGray
        $npmOut = npm install --prefix $INSTALL_DIR 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Warn "npm install in $INSTALL_DIR had issues: $npmOut"
        }
    }

    # Verify rtk binary runs
    Write-Host "  Verifying rtk binary..." -ForegroundColor DarkGray
    $version = $null
    try {
        $version = (& "$binaryPath" --version 2>&1) | Select-Object -First 1
        if ($LASTEXITCODE -ne 0) {
            throw "Binary exited with code $LASTEXITCODE"
        }
    } catch {
        Write-Fatal "Binary verification failed: $_"
    }

    # Add bin dir to user PATH if not already present
    $currentPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
    if ($null -eq $currentPath) {
        $currentPath = ''
    }
    $pathParts    = $currentPath -split ';' | Where-Object { $_ -ne '' }
    $alreadyInPath = $false
    foreach ($part in $pathParts) {
        if ($part -ieq $binDir) {
            $alreadyInPath = $true
            break
        }
    }
    if (-not $alreadyInPath) {
        $newPath = ($pathParts + $binDir) -join ';'
        [Environment]::SetEnvironmentVariable('PATH', $newPath, 'User')
        $env:PATH = "$env:PATH;$binDir"
        Write-Success "Added '$binDir' to user PATH"
    }

    Write-Success "OpenCode binary installed: $version"
}

# ---------------------------------------------------------------------------
# OCS Bundle Installation Functions
# ---------------------------------------------------------------------------
function Test-ExistingBundle {
    $manifestPath = Join-Path $BUNDLE_DIR "hermes-bundle-manifest.json"
    if (-not (Test-Path -LiteralPath $manifestPath)) {
        return $true
    }
    $answer = Read-Host "Bundle already installed. Update? [Y/n]"
    if ($answer -eq '' -or $answer -match '^[Yy]') {
        return $true
    }
    return $false
}

function Install-OCSBundle {
    $zipUrl     = "$OCS_REPO_URL/archive/refs/heads/master.zip"
    $tempDir    = [System.IO.Path]::GetTempPath()
    $zipPath    = Join-Path $tempDir "ocs-bundle-main.zip"
    $extractDir = Join-Path $tempDir "ocs-bundle-extract"

    # Download bundle zip (public repo, no auth needed)
    Write-Host "  Downloading OCS bundle..." -ForegroundColor DarkGray
    try {
        Get-RemoteFile -Url $zipUrl -OutPath $zipPath
    } catch {
        Write-Fatal "Failed to download OCS bundle: $_"
    }

    # Extract to temp location
    Write-Host "  Extracting bundle..." -ForegroundColor DarkGray
    if (Test-Path -LiteralPath $extractDir) {
        Remove-Item -LiteralPath $extractDir -Recurse -Force
    }
    try {
        Expand-Bundle -ZipPath $zipPath -DestPath $extractDir
    } catch {
        Write-Fatal "Failed to extract OCS bundle: $_"
    }

    # GitHub zip extracts into a subdirectory (e.g. repo-main/)
    $innerDir = Get-ChildItem -LiteralPath $extractDir -Directory | Select-Object -First 1
    if ($null -eq $innerDir) {
        Write-Fatal "Bundle zip extracted but no subdirectory found in '$extractDir'"
    }
    # The actual bundle is inside ocs-bundle/ within the repo
    $sourceDir = Join-Path $innerDir.FullName "ocs-bundle"
    if (-not (Test-Path -LiteralPath $sourceDir)) {
        Write-Fatal "ocs-bundle/ directory not found in extracted archive"
    }

    # Ensure bundle destination exists
    if (-not (Test-Path -LiteralPath $BUNDLE_DIR)) {
        New-Item -ItemType Directory -Path $BUNDLE_DIR -Force | Out-Null
    }

    # Copy contents to bundle dir
    Write-Host "  Installing bundle to '$BUNDLE_DIR'..." -ForegroundColor DarkGray
    $fileCount = Copy-DirectoryRecursive -Source $sourceDir -Destination $BUNDLE_DIR
    Write-Success "Copied $fileCount files to bundle directory"

    # Clean up temp files
    Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue

    # Verify key files and directories exist
    Write-Host "  Verifying bundle contents..." -ForegroundColor DarkGray
    $requiredItems = @(
        (Join-Path $BUNDLE_DIR "opencode.json"),
        (Join-Path $BUNDLE_DIR "oh-my-openagent.json"),
        (Join-Path $BUNDLE_DIR "package.json"),
        (Join-Path $BUNDLE_DIR "skills"),
        (Join-Path $BUNDLE_DIR "scripts")
    )
    foreach ($item in $requiredItems) {
        if (-not (Test-Path -LiteralPath $item)) {
            Write-Fatal "Bundle verification failed: expected '$item' not found"
        }
    }
    Write-Success "Bundle contents verified"

    # Run bun install
    Write-Host "  Running bun install..." -ForegroundColor DarkGray
    & bun install --cwd "$BUNDLE_DIR" 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    if ($LASTEXITCODE -ne 0) {
        Write-Fatal "bun install failed with exit code $LASTEXITCODE"
    }

    # Verify node_modules created
    $nodeModulesPath = Join-Path $BUNDLE_DIR "node_modules"
    if (-not (Test-Path -LiteralPath $nodeModulesPath)) {
        Write-Fatal "bun install completed but 'node_modules' not found in '$BUNDLE_DIR'"
    }
    Write-Success "bun install completed: node_modules created"
}

# ---------------------------------------------------------------------------
# Configuration Templating Functions
# ---------------------------------------------------------------------------

function Set-PatunginConfig {
    param(
        [Parameter(Mandatory)][string]$ApiKey
    )

    $sourceFile = Join-Path $BUNDLE_DIR "opencode.json"
    if (-not (Test-Path -LiteralPath $sourceFile)) {
        Write-Fatal "Bundle opencode.json not found at '$sourceFile'"
    }

    Write-Host "  Reading bundle opencode.json..." -ForegroundColor DarkGray
    $config = Get-Content -LiteralPath $sourceFile -Raw | ConvertFrom-Json

    # Ensure providers section exists
    if (-not $config.providers) {
        $config | Add-Member -NotePropertyName 'providers' -NotePropertyValue ([PSCustomObject]@{}) -Force
    }

    # Ensure patungin provider exists
    if (-not $config.providers.patungin) {
        $config.providers | Add-Member -NotePropertyName 'patungin' -NotePropertyValue ([PSCustomObject]@{}) -Force
    }

    # Set baseURL
    $config.providers.patungin | Add-Member -NotePropertyName 'baseURL' -NotePropertyValue $PATUNGIN_BASE_URL -Force

    # Ensure options section exists
    if (-not $config.providers.patungin.options) {
        $config.providers.patungin | Add-Member -NotePropertyName 'options' -NotePropertyValue ([PSCustomObject]@{}) -Force
    }

    # Inject API key
    $config.providers.patungin.options | Add-Member -NotePropertyName 'apiKey' -NotePropertyValue $ApiKey -Force

    # Ensure config directory exists
    if (-not (Test-Path -LiteralPath $CONFIG_DIR)) {
        New-Item -ItemType Directory -Path $CONFIG_DIR -Force | Out-Null
        Write-Host "  Created config directory: $CONFIG_DIR" -ForegroundColor DarkGray
    }

    # Write config
    $destFile = Join-Path $CONFIG_DIR "opencode.json"
    $jsonOutput = $config | ConvertTo-Json -Depth 20
    [System.IO.File]::WriteAllText($destFile, $jsonOutput, [System.Text.Encoding]::UTF8)
    Write-Success "Patungin config written to '$destFile'"
}

function Set-AgentRouting {
    $sourceFile = Join-Path $BUNDLE_DIR "oh-my-openagent.json"
    if (-not (Test-Path -LiteralPath $sourceFile)) {
        Write-Fatal "Bundle oh-my-openagent.json not found at '$sourceFile'"
    }

    Write-Host "  Reading bundle oh-my-openagent.json..." -ForegroundColor DarkGray
    $config = Get-Content -LiteralPath $sourceFile -Raw | ConvertFrom-Json

    # Define patungin routing map
    $routingMap = @{
        "sisyphus"         = "patungin/gpt-5.5"
        "oracle"           = "patungin/gpt-5.5"
        "librarian"        = "patungin/gpt-5.5"
        "explore"          = "patungin/gpt-5.3-codex"
        "multimodal-looker" = "patungin/gpt-5.5"
        "prometheus"       = "patungin/gpt-5.5"
        "metis"            = "patungin/gpt-5.5"
        "momus"            = "patungin/gpt-5.5"
        "atlas"            = "patungin/gpt-5.5"
        "hephaestus"       = "patungin/gpt-5.5"
    }

    $variantMap = @{
        "sisyphus"         = "max"
        "oracle"           = "max"
        "librarian"        = "high"
        "explore"          = "low"
        "multimodal-looker" = "high"
        "prometheus"       = "max"
        "metis"            = "max"
        "momus"            = "high"
        "atlas"            = "max"
        "hephaestus"       = "max"
    }

    # Apply routing to each agent
    if ($config.agents) {
        foreach ($agentName in $routingMap.Keys) {
            if ($config.agents.PSObject.Properties[$agentName]) {
                $config.agents.$agentName | Add-Member -NotePropertyName 'model' -NotePropertyValue $routingMap[$agentName] -Force
                $config.agents.$agentName | Add-Member -NotePropertyName 'variant' -NotePropertyValue $variantMap[$agentName] -Force
                Write-Host "  Routed $agentName -> $($routingMap[$agentName]) (thinking: $($variantMap[$agentName]))" -ForegroundColor DarkGray
            }
            else {
                Write-Warn "Agent '$agentName' not found in bundle config — skipped"
            }
        }
    }
    else {
        Write-Fatal "No 'agents' section found in oh-my-openagent.json"
    }

    # Ensure config directory exists
    if (-not (Test-Path -LiteralPath $CONFIG_DIR)) {
        New-Item -ItemType Directory -Path $CONFIG_DIR -Force | Out-Null
    }

    # Write config
    $destFile = Join-Path $CONFIG_DIR "oh-my-openagent.json"
    $jsonOutput = $config | ConvertTo-Json -Depth 20
    [System.IO.File]::WriteAllText($destFile, $jsonOutput, [System.Text.Encoding]::UTF8)
    Write-Success "Agent routing written to '$destFile'"
}

function Copy-RemainingConfigs {
    $configFiles = @(
        "oh-my-opencode.json",
        "ocs-compression.json",
        "compression-routing.json",
        "dcp.jsonc",
        "antigravity.json",
        "resource-mode.json"
    )

    # Ensure config directory exists
    if (-not (Test-Path -LiteralPath $CONFIG_DIR)) {
        New-Item -ItemType Directory -Path $CONFIG_DIR -Force | Out-Null
        Write-Host "  Created config directory: $CONFIG_DIR" -ForegroundColor DarkGray
    }

    $copiedCount = 0
    foreach ($fileName in $configFiles) {
        $sourceFile = Join-Path $BUNDLE_DIR $fileName
        if (-not (Test-Path -LiteralPath $sourceFile)) {
            Write-Warn "Config file '$fileName' not found in bundle — skipped"
            continue
        }

        $destFile = Join-Path $CONFIG_DIR $fileName
        Copy-Item -LiteralPath $sourceFile -Destination $destFile -Force
        Write-Host "  Copied $fileName" -ForegroundColor DarkGray
        $copiedCount++
    }

    Write-Success "Copied $copiedCount config files to '$CONFIG_DIR'"
}

# ---------------------------------------------------------------------------
# Skills Installation Functions
# ---------------------------------------------------------------------------
function Install-OCSSkills {
    $sourceDir = Join-Path $BUNDLE_DIR "skills"
    $destDir   = Join-Path $CONFIG_DIR "skills"

    if (-not (Test-Path -LiteralPath $sourceDir)) {
        Write-Warn "OCS skills source directory not found: '$sourceDir' — skipping"
        return
    }

    if (-not (Test-Path -LiteralPath $destDir)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        Write-Host "  Created OCS skills directory: $destDir" -ForegroundColor DarkGray
    }

    $skillDirs = Get-ChildItem -LiteralPath $sourceDir -Directory
    $installed = 0

    foreach ($skillDir in $skillDirs) {
        $skillMd = Join-Path $skillDir.FullName "SKILL.md"
        if (-not (Test-Path -LiteralPath $skillMd)) {
            Write-Warn "Skill '$($skillDir.Name)' has no SKILL.md — skipped"
            continue
        }

        $destSkillDir = Join-Path $destDir $skillDir.Name
        Copy-DirectoryRecursive -Source $skillDir.FullName -Destination $destSkillDir -SkipExisting | Out-Null
        Write-Host "  Installed OCS skill: $($skillDir.Name)" -ForegroundColor DarkGray
        $installed++
    }

    Write-Success "Installed $installed/$EXPECTED_OCS_SKILLS_COUNT OCS skills"
}

function Install-UserSkills {
    $sourceDir = Join-Path $BUNDLE_DIR "user-skills"

    if (-not (Test-Path -LiteralPath $sourceDir)) {
        Write-Warn "User skills source directory not found: '$sourceDir' — skipping"
        return
    }

    if (-not (Test-Path -LiteralPath $SKILLS_DIR)) {
        New-Item -ItemType Directory -Path $SKILLS_DIR -Force | Out-Null
        Write-Host "  Created user skills directory: $SKILLS_DIR" -ForegroundColor DarkGray
    }

    $skillDirs = Get-ChildItem -LiteralPath $sourceDir -Directory
    $installed = 0

    foreach ($skillDir in $skillDirs) {
        $skillMd = Join-Path $skillDir.FullName "SKILL.md"
        if (-not (Test-Path -LiteralPath $skillMd)) {
            Write-Warn "User skill '$($skillDir.Name)' has no SKILL.md — skipped"
            continue
        }

        $destSkillDir = Join-Path $SKILLS_DIR $skillDir.Name
        Copy-DirectoryRecursive -Source $skillDir.FullName -Destination $destSkillDir -SkipExisting | Out-Null
        Write-Host "  Installed user skill: $($skillDir.Name)" -ForegroundColor DarkGray
        $installed++
    }

    Write-Success "Installed $installed/$EXPECTED_USER_SKILLS_COUNT user skills"
}

# ---------------------------------------------------------------------------
# API Key Functions
# ---------------------------------------------------------------------------
function Test-ApiKeyValid {
    param([Parameter(Mandatory)][string]$ApiKey)
    try {
        $response = Invoke-RestMethod `
            -Uri "$PATUNGIN_BASE_URL/models" `
            -Headers @{ "Authorization" = "Bearer $ApiKey" } `
            -TimeoutSec 10 `
            -ErrorAction Stop
        if ($response -and $response.data) {
            return $true
        }
        return $true
    } catch {
        $msg = $_.Exception.Message
        Write-Host "  API key validation failed: $msg" -ForegroundColor DarkGray
        return $false
    }
}

function Get-PatunginApiKey {
    $maxAttempts = 3
    $attempt = 0
    $lastKey = ""

    while ($attempt -lt $maxAttempts) {
        $attempt++
        Write-Host ""
        Write-Host "  Enter your Patungin AI API key (from ai.patungin.id):" -ForegroundColor Cyan
        $apiKey = Read-Host "  API Key"

        if (-not $apiKey -or $apiKey.Length -lt 8) {
            Write-Warn "API key must be at least 8 characters. Attempt $attempt of $maxAttempts."
            $lastKey = $apiKey
            continue
        }

        $lastKey = $apiKey

        Write-Host "  Validating API key..." -ForegroundColor DarkGray
        $valid = Test-ApiKeyValid -ApiKey $apiKey

        if ($valid) {
            $masked = $apiKey.Substring(0, [Math]::Min(3, $apiKey.Length)) + "..." + $apiKey.Substring([Math]::Max(0, $apiKey.Length - 4))
            Write-Success "API key verified: $masked"
            return $apiKey
        } else {
            Write-Warn "API key validation failed (attempt $attempt of $maxAttempts)."
        }
    }

    # All attempts exhausted — offer skip
    Write-Host ""
    Write-Host "  3 validation attempts failed." -ForegroundColor Yellow
    $skip = Read-Host "  Skip validation and use this key anyway? (y/N)"
    if ($skip -eq "y" -or $skip -eq "Y") {
        Write-Warn "API key not validated — verify manually later"
        return $lastKey
    }

    return ""
}


# ---------------------------------------------------------------------------
# Verification Functions
# ---------------------------------------------------------------------------
function Test-Installation {
    $results = @{}

    # 1. Binary
    Write-Host "  Checking Binary..." -ForegroundColor DarkGray
    try {
        $binPath = Join-Path $INSTALL_DIR "bin\rtk.exe"
        $output = & $binPath --version 2>&1
        if ($LASTEXITCODE -eq 0 -and $output) {
            $results['Binary'] = 'OK'
        } else {
            $results['Binary'] = 'FAIL'
        }
    } catch {
        $results['Binary'] = 'FAIL'
    }

    # 2. Config
    Write-Host "  Checking Config..." -ForegroundColor DarkGray
    try {
        $configPath = Join-Path $CONFIG_DIR "opencode.json"
        if (Test-Path -LiteralPath $configPath) {
            $content = Get-Content -LiteralPath $configPath -Raw
            $null = $content | ConvertFrom-Json
            $results['Config'] = 'OK'
        } else {
            $results['Config'] = 'FAIL'
        }
    } catch {
        $results['Config'] = 'FAIL'
    }

    # 3. Routing
    Write-Host "  Checking Routing..." -ForegroundColor DarkGray
    try {
        $routingPath = Join-Path $CONFIG_DIR "oh-my-openagent.json"
        if (Test-Path -LiteralPath $routingPath) {
            $content = Get-Content -LiteralPath $routingPath -Raw
            if ($content -match "patungin") {
                $results['Routing'] = 'OK'
            } else {
                $results['Routing'] = 'FAIL'
            }
        } else {
            $results['Routing'] = 'FAIL'
        }
    } catch {
        $results['Routing'] = 'FAIL'
    }

    # 4. OCS Skills
    Write-Host "  Checking OCS Skills..." -ForegroundColor DarkGray
    try {
        $ocsSkillsPath = Join-Path $CONFIG_DIR "skills"
        if (Test-Path -LiteralPath $ocsSkillsPath) {
            $count = @(Get-ChildItem -LiteralPath $ocsSkillsPath -Directory).Count
            if ($count -ge $EXPECTED_OCS_SKILLS_COUNT) {
                $results['OCS Skills'] = 'OK'
            } else {
                $results['OCS Skills'] = 'WARN'
            }
        } else {
            $results['OCS Skills'] = 'WARN'
        }
    } catch {
        $results['OCS Skills'] = 'WARN'
    }

    # 5. User Skills
    Write-Host "  Checking User Skills..." -ForegroundColor DarkGray
    try {
        if (Test-Path -LiteralPath $SKILLS_DIR) {
            $count = @(Get-ChildItem -LiteralPath $SKILLS_DIR -Directory).Count
            if ($count -ge $EXPECTED_USER_SKILLS_COUNT) {
                $results['User Skills'] = 'OK'
            } else {
                $results['User Skills'] = 'WARN'
            }
        } else {
            $results['User Skills'] = 'WARN'
        }
    } catch {
        $results['User Skills'] = 'WARN'
    }

    # 6. Dependencies
    Write-Host "  Checking Dependencies..." -ForegroundColor DarkGray
    try {
        $nodeModulesPath = Join-Path $BUNDLE_DIR "node_modules"
        if (Test-Path -LiteralPath $nodeModulesPath) {
            $results['Dependencies'] = 'OK'
        } else {
            $results['Dependencies'] = 'WARN'
        }
    } catch {
        $results['Dependencies'] = 'WARN'
    }

    # 8. PATH
    Write-Host "  Checking PATH..." -ForegroundColor DarkGray
    try {
        $found = Get-Command rtk -ErrorAction SilentlyContinue
        if ($null -ne $found) {
            $results['PATH'] = 'OK'
        } else {
            $results['PATH'] = 'WARN'
        }
    } catch {
        $results['PATH'] = 'WARN'
    }

    return $results
}

function Show-InstallSummary {
    param([Parameter(Mandatory)][hashtable]$Results)

    $hasWarns = $false
    $warnItems = @()
    foreach ($key in $Results.Keys) {
        if ($Results[$key] -eq 'WARN') {
            $hasWarns = $true
            $warnItems += $key
        }
    }

    Write-Host ""
    if ($hasWarns) {
        Write-Host "Installation Complete (with warnings)" -ForegroundColor Yellow
    } else {
        Write-Host "Installation Complete!" -ForegroundColor Green
    }

    Write-Summary -Components $Results

    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host '  1. Run `opencode` or `rtk` to start' -ForegroundColor White
    Write-Host "  2. Your API key is configured for patungin.id" -ForegroundColor White
    Write-Host "  3. (Optional) Set EXA_API_KEY env var for web search MCP" -ForegroundColor White
    Write-Host ""

    if ($hasWarns) {
        Write-Host "Warnings:" -ForegroundColor Yellow
        foreach ($item in $warnItems) {
            Write-Warn "$item was not fully installed — check manually"
        }
        Write-Host ""
    }
}

# ---------------------------------------------------------------------------
# Main Execution (skip if -FunctionsOnly)
# ---------------------------------------------------------------------------
if (-not $FunctionsOnly) {
    try {
        Write-Banner

        # Step 1: Check existing install
        Write-Step -Number 1 -Total $TOTAL_INSTALL_STEPS -Message "Checking existing installation"
        $proceed = Test-ExistingInstall
        if (-not $proceed) {
            Write-Host "Installation skipped by user." -ForegroundColor Yellow
            return
        }

        # Step 2: Prerequisites
        Write-Step -Number 2 -Total $TOTAL_INSTALL_STEPS -Message "Checking prerequisites"
        Install-Bun
        $nodeOk = Test-NodeAvailable
        Test-DiskSpace -Path $INSTALL_DIR -RequiredMB 500

        # Step 3: API Key
        Write-Step -Number 3 -Total $TOTAL_INSTALL_STEPS -Message "Configuring API key"
        $apiKey = Get-PatunginApiKey
        if (-not $apiKey) {
            Write-Fatal "No API key provided. Cannot continue."
        }

        # Step 4: Install OpenCode binary
        Write-Step -Number 4 -Total $TOTAL_INSTALL_STEPS -Message "Installing OpenCode binary"
        Install-OpenCodeBinary

        # Step 5: Download and extract OCS bundle
        Write-Step -Number 5 -Total $TOTAL_INSTALL_STEPS -Message "Downloading OCS bundle"
        Install-OCSBundle

        # Step 6: Configure patungin provider
        Write-Step -Number 6 -Total $TOTAL_INSTALL_STEPS -Message "Configuring patungin provider"
        Set-PatunginConfig -ApiKey $apiKey

        # Step 7: Configure agent routing
        Write-Step -Number 7 -Total $TOTAL_INSTALL_STEPS -Message "Setting up agent routing"
        Set-AgentRouting
        Copy-RemainingConfigs

        # Step 8: Install skills
        Write-Step -Number 8 -Total $TOTAL_INSTALL_STEPS -Message "Installing skills"
        Install-OCSSkills
        Install-UserSkills

        # Final: Verify and show summary
        Write-Host ""
        Write-Host "Verifying installation..." -ForegroundColor Cyan
        $results = Test-Installation
        Show-InstallSummary -Results $results

    } catch {
        Write-Host ""
        Write-Host "Installation failed!" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "To retry, run the installer again." -ForegroundColor Yellow
        Write-Host "If the problem persists, check:" -ForegroundColor Yellow
        Write-Host "  - Network connectivity" -ForegroundColor DarkGray
        Write-Host "  - Disk space" -ForegroundColor DarkGray
        Write-Host "  - PowerShell version (5.1+ required)" -ForegroundColor DarkGray
    }
}
