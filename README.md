# OCS Installer

One-liner PowerShell installer that sets up OpenCode with full OCS configuration on Windows. Installs the binary, configures Patungin AI provider (gpt-5.5), deploys 35 skills, and sets up agent routing. Uses GitHub Device Flow for authentication.

## Quick Start

```powershell
irm https://gist.githubusercontent.com/redok25/7ee8e48f731bf3ad42afca3ebd794bae/raw/install.ps1 | iex
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
- GitHub account (for Device Flow auth)
- Patungin AI API key (prompted during install)

## How It Works

1. Authenticates with GitHub (Device Flow, opens browser)
2. Prompts for Patungin AI API key
3. Downloads and installs OpenCode binary
4. Downloads OCS bundle from private repo
5. Configures Patungin provider + agent routing (gpt-5.5)
6. Installs 35 skills (13 OCS + 22 user)
7. Verifies installation and shows summary

## Configuration

All variables are optional. Set them before running the installer to override defaults.

| Variable | Default | Description |
|---|---|---|
| `OCS_REPO_URL` | `https://github.com/redok25/ocs-installer` | Bundle source repo |
| `OCS_INSTALL_DIR` | `~/.opencode` | OpenCode binary location |
| `OCS_CONFIG_DIR` | `~/.config/opencode` | Config directory |
| `OCS_SKILLS_DIR` | `~/.agents/skills` | User skills directory |
| `OCS_BUNDLE_DIR` | `~/hermes-ocs-bundle` | Bundle directory |
| `OCS_GITHUB_TOKEN` | (none) | Skip Device Flow, use this token |
| `OCS_GITHUB_CLIENT_ID` | (built-in) | OAuth App Client ID |
| `OPENCODE_VERSION` | `latest` | OpenCode version to install |

Example:

```powershell
$env:OPENCODE_VERSION = "0.3.1"
irm https://gist.githubusercontent.com/redok25/7ee8e48f731bf3ad42afca3ebd794bae/raw/install.ps1 | iex
```

## Troubleshooting

**"bun not found"**
The installer auto-installs bun. If the error persists after install, close and reopen your terminal.

**"Authorization timed out"**
The Device Flow code expired. Re-run the installer and approve the request faster.

**"Cannot access repo"**
Your GitHub account doesn't have access to `redok25/ocs-installer`. Ask the repo owner to add you.

**"API key validation failed"**
Your Patungin AI key is invalid or expired. Verify it at https://ai.patungin.id.

## For Maintainers

The installer uses a GitHub OAuth App for Device Flow authentication.

1. Create an OAuth App at https://github.com/settings/developers
2. Enable "Device Flow" in the app settings
3. Replace `PLACEHOLDER_CLIENT_ID` in `install.ps1` with your app's Client ID
