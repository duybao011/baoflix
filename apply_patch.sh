#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "Nhap duong dan project baoflix:"
  read -r TARGET
fi

if [ ! -d "$TARGET" ]; then
  echo "Khong thay thu muc: $TARGET"
  exit 1
fi

if [ ! -f "$TARGET/package.json" ]; then
  echo "Thu muc nay khong co package.json: $TARGET"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Copy patch vao: $TARGET"
mkdir -p "$TARGET/app/xem/[slug]" "$TARGET/components"
cp "$SCRIPT_DIR/app/layout.tsx" "$TARGET/app/layout.tsx"
cp "$SCRIPT_DIR/app/xem/[slug]/page.tsx" "$TARGET/app/xem/[slug]/page.tsx"
cp "$SCRIPT_DIR/components/WatchClient.tsx" "$TARGET/components/WatchClient.tsx"

rm -f "$TARGET/components/TvSeekFocusBridge.tsx"

echo "Done. Nen chay: npm run build"
