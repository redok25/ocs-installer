# Hermes OCS Bundle

Bundle ini adalah snapshot aset OCS/OpenCode untuk dipakai Hermes sebagai sumber konfigurasi utama di Windows, Linux, atau macOS.

## Tujuan

- Menyimpan plugin, skill, config, script, dan policy OCS dalam satu folder.
- Memudahkan sinkronisasi ke repo GitHub pribadi secara manual.
- Menjadi baseline yang mudah dibaca Hermes tanpa bergantung ke path absolut OS tertentu.
- Menyediakan script verifikasi dan sinkronisasi untuk PowerShell serta POSIX shell.

## Struktur

- `plugins/` - plugin OCS/OpenCode.
- `skills/` - skill OCS yang dimanaged.
- `configs/` - preset model, routing, dan profile.
- `scripts/` - helper setup dan integrasi dari OCS.
- `cocoindex/` - integrasi CocoIndex; secret lokal harus tetap di `.env` dan tidak dicommit.
- `extensions/` - extension assets.
- `bin/` - runtime helper yang dibundel dari OCS.
- `tools/` - script sync dan verify untuk Windows/Linux/macOS.
- root JSON/MD - policy, routing, metadata, manifest.

## Source of Truth

Default source OCS/OpenCode adalah config home OpenCode:

- Linux/macOS: `~/.config/opencode`
- Windows: `%USERPROFILE%\.config\opencode`

Jika source ada di lokasi lain, set environment variable berikut sebelum sync:

```bash
export OPENCODE_CONFIG_HOME=/path/to/opencode
```

```powershell
$env:OPENCODE_CONFIG_HOME = "C:\path\to\opencode"
```

## Cara Verifikasi

Linux/macOS:

```bash
./tools/verify-bundle.sh
```

Windows PowerShell:

```powershell
.\tools\verify-bundle.ps1
```

## Cara Sinkronisasi

Linux/macOS:

```bash
OPENCODE_CONFIG_HOME="$HOME/.config/opencode" ./tools/sync-from-opencode.sh
```

Windows PowerShell:

```powershell
$env:OPENCODE_CONFIG_HOME = "$env:USERPROFILE\.config\opencode"
.\tools\sync-from-opencode.ps1
```

Script sync akan menyalin aset OCS yang relevan, menghapus `cocoindex/.env` jika ikut tersalin, memastikan `cocoindex/.env.example` tersedia, lalu menjalankan verifikasi.

## Aturan Repo

- Push ke GitHub dilakukan manual oleh user, bukan otomatis oleh script ini.
- Jangan commit file secret atau runtime lokal.
- Jangan simpan cache, dependency install lokal, atau backup editor.
- Jalankan verify sebelum push manual.

## File Penting

1. `hermes-bundle-manifest.json`
2. `README.md`
3. `opencode.json`
4. `oh-my-opencode.json`
5. `ocs-compression.json`
6. `configs/AGENTS.md`
7. `skills/.ocs-managed-skills.json`
8. `tools/verify-bundle.sh`
9. `tools/verify-bundle.ps1`
