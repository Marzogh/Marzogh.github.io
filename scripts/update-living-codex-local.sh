#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[living-codex] syncing submodule URL metadata"
git submodule sync --recursive

echo "[living-codex] updating vendor/the-living-codex to latest origin/main"
git submodule update --init --remote --recursive vendor/the-living-codex

echo "[living-codex] mirroring into public/living-codex"
node scripts/sync-living-codex.mjs

echo "[living-codex] done"
