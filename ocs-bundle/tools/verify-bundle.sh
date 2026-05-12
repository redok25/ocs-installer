#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
bundle_root=${BUNDLE_ROOT:-$(CDPATH= cd -- "$script_dir/.." && pwd)}

required='README.md
.gitignore
hermes-bundle-manifest.json
opencode.json
oh-my-opencode.json
ocs-compression.json
configs
skills
plugins
tools/sync-from-opencode.sh
tools/verify-bundle.sh
tools/sync-from-opencode.ps1
tools/verify-bundle.ps1'

for item in $required; do
  if [ ! -e "$bundle_root/$item" ]; then
    printf 'Missing required bundle item: %s\n' "$item" >&2
    exit 1
  fi
done

blocked=$(find "$bundle_root" \
  \( -path '*/node_modules/*' -o \
     -path '*/.git/*' -o \
     -name '*.bak' -o \
     -name '*.tmp' -o \
     -path '*/cocoindex/.env' \) \
  -print)

if [ -n "$blocked" ]; then
  printf 'Bundle contains blocked files:\n%s\n' "$blocked" >&2
  exit 1
fi

printf 'Bundle verification passed.\n'
