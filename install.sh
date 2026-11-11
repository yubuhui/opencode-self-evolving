#!/usr/bin/env bash
# OpenCode Self-Evolving Kit — one-line installer (macOS / Linux)
# Usage: curl -fsSL https://raw.githubusercontent.com/yubuhui/opencode-self-evolving/main/install.sh | bash
set -euo pipefail

TARGET="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Downloading opencode-self-evolving kit..."
curl -fsSL "https://github.com/yubuhui/opencode-self-evolving/archive/refs/heads/main.tar.gz" -o "$TMP/kit.tar.gz"
tar -xzf "$TMP/kit.tar.gz" -C "$TMP"
SRC="$TMP/opencode-self-evolving-main"

mkdir -p "$TARGET/skills"

# 1. AGENTS.md — backup existing before overwriting
if [ -f "$TARGET/AGENTS.md" ]; then
  BAK="$TARGET/AGENTS.md.bak-$(date +%Y%m%d-%H%M%S)"
  cp "$TARGET/AGENTS.md" "$BAK"
  echo "Backed up existing AGENTS.md -> $BAK"
fi
cp "$SRC/AGENTS.md" "$TARGET/AGENTS.md"
echo "Installed AGENTS.md"

# 2. skills/ (merge over existing global skills)
cp -r "$SRC/skills/." "$TARGET/skills/"
echo "Installed skills/"

# 3. self-check tooling (npm test = check-rules L1-L7 + node --test)
cp "$SRC/check-rules.mjs" "$TARGET/check-rules.mjs"
cp "$SRC/audit-docs.mjs" "$TARGET/audit-docs.mjs"
mkdir -p "$TARGET/test" "$TARGET/git-hooks"
cp -r "$SRC/test/." "$TARGET/test/"
cp -r "$SRC/git-hooks/." "$TARGET/git-hooks/"
cp "$SRC/package.json" "$TARGET/package.json"
echo "Installed self-check tooling (npm test); git-hooks copied but not enabled"

# 4. opencode.json — safety permission rules only; never overwrite an existing config
if [ ! -f "$TARGET/opencode.json" ]; then
  cp "$SRC/opencode.json.example" "$TARGET/opencode.json"
  echo "Created opencode.json (safety permission rules). Your model/API key is managed by opencode itself — this kit does not touch it."
else
  echo "Skipped opencode.json (already exists)"
fi

echo ""
echo "Done! Restart opencode to take effect."
