#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  read -rp "Path to baoflix project: " TARGET
fi

if [[ ! -f "$TARGET/package.json" ]]; then
  echo "[ERROR] package.json not found in $TARGET" >&2
  exit 1
fi

PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"
rsync -a "$PATCH_DIR/app/" "$TARGET/app/"
rsync -a "$PATCH_DIR/components/" "$TARGET/components/"
rm -f "$TARGET/components/TvSeekFocusBridge.tsx"

echo "Done. Run: cd '$TARGET' && npm run build"
