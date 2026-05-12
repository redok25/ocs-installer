#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
target_root=${TARGET_ROOT:-$(CDPATH= cd -- "$script_dir/.." && pwd)}
source_root=${OPENCODE_CONFIG_HOME:-${SOURCE_ROOT:-$HOME/.config/opencode}}

if [ ! -d "$source_root" ]; then
  printf 'Source OpenCode config directory not found: %s\n' "$source_root" >&2
  printf 'Set OPENCODE_CONFIG_HOME=/path/to/opencode and retry.\n' >&2
  exit 1
fi

items='plugins
skills
configs
scripts
cocoindex
extensions
bin
antigravity.json
BUILD_PROVENANCE.json
compression-routing.json
dcp.jsonc
ocs-compression.json
oh-my-openagent.json
oh-my-opencode.json
opencode.json
package.json
PLUGIN_CHANGELOG.md
resource-mode.json
SHA256SUMS'

copy_item() {
  src=$1
  dst=$2
  if [ -d "$src" ] && command -v rsync >/dev/null 2>&1; then
    mkdir -p "$dst"
    rsync -a --delete "$src/" "$dst/"
  elif [ -d "$src" ]; then
    mkdir -p "$dst"
    cp -R "$src/." "$dst/"
  else
    cp "$src" "$dst"
  fi
}

for item in $items; do
  src="$source_root/$item"
  dst="$target_root/$item"
  if [ -e "$src" ]; then
    copy_item "$src" "$dst"
  fi
done

if [ -f "$target_root/cocoindex/.env" ]; then
  mv "$target_root/cocoindex/.env" "$target_root/cocoindex/.env.local"
fi

mkdir -p "$target_root/cocoindex"

if [ ! -f "$target_root/cocoindex/.env.example" ]; then
  cat > "$target_root/cocoindex/.env.example" <<'ENVEOF'
# Copy to .env for local CocoIndex usage.
# Do not commit real credentials.

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=cocoindex
POSTGRES_USER=cocoindex
POSTGRES_PASSWORD=change-me
ENVEOF
fi

BUNDLE_ROOT="$target_root" "$target_root/tools/verify-bundle.sh"
