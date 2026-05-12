# OCS Installer

One-liner PowerShell installer that sets up OpenCode with full OCS configuration on Windows. Installs the binary, configures Patungin AI provider (gpt-5.5), deploys 35 skills, and sets up agent routing.

## Quick Start

```powershell
irm https://raw.githubusercontent.com/redok25/ocs-installer/master/install.ps1 | iex
```

## What Gets Installed

- OpenCode binary (`~/.opencode/bin/rtk.exe`)
- OCS config (`~/.config/opencode/`)
- 13 OCS-managed skills + 22 user-level skills (`~/.agents/skills/`)
- Agent routing (10 agents via Patungin AI, gpt-5.5)
- Bundle resources (`~/hermes-ocs-bundle/`)

## Prerequisites

- Windows 10/11
- PowerShell 5.1+ (built-in)
- Internet connection
- Patungin AI API key (prompted during install)

## How It Works

1. Prompts for Patungin AI API key
2. Downloads and installs OpenCode binary
3. Downloads OCS bundle from public repo
4. Configures Patungin provider + agent routing (gpt-5.5)
5. Installs 35 skills (13 OCS + 22 user)
6. Verifies installation and shows summary

## Configuration

All variables are optional. Set them before running the installer to override defaults.

| Variable | Default | Description |
|---|---|---|
| `OCS_REPO_URL` | `https://github.com/redok25/ocs-installer` | Bundle source repo |
| `OCS_INSTALL_DIR` | `~/.opencode` | OpenCode binary location |
| `OCS_CONFIG_DIR` | `~/.config/opencode` | Config directory |
| `OCS_SKILLS_DIR` | `~/.agents/skills` | User skills directory |
| `OCS_BUNDLE_DIR` | `~/hermes-ocs-bundle` | Bundle directory |
| `OPENCODE_VERSION` | `latest` | OpenCode version to install |

Example:

```powershell
$env:OPENCODE_VERSION = "0.3.1"
irm https://raw.githubusercontent.com/redok25/ocs-installer/master/install.ps1 | iex
```

## Troubleshooting

**"bun not found"**
The installer auto-installs bun. If the error persists after install, close and reopen your terminal.

**"Failed to download OCS bundle"**
Check your internet connection. The bundle is downloaded from GitHub — make sure github.com is accessible.

**"API key validation failed"**
Your Patungin AI key is invalid or expired. Verify it at https://ai.patungin.id.


