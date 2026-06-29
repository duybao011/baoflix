#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"

if [ -z "$TARGET" ]; then
  echo "Usage: ./apply_patch.sh /path/to/baoflix"
  exit 1
fi

if [ ! -d "$TARGET" ]; then
  echo "Target folder not found: $TARGET"
  exit 1
fi

mkdir -p "$TARGET/app" "$TARGET/components"

cp app/layout.tsx "$TARGET/app/layout.tsx"
cp components/TvRemoteNavigator.tsx "$TARGET/components/TvRemoteNavigator.tsx"
cp components/TvPlayerCommandBridge.tsx "$TARGET/components/TvPlayerCommandBridge.tsx"
cp components/TvWatchOverlay.tsx "$TARGET/components/TvWatchOverlay.tsx"
cp components/TvSearchBox.tsx "$TARGET/components/TvSearchBox.tsx"

# Bản remote mới gộp logic seek bridge vào TvRemoteNavigator.
# Nếu file cũ còn tồn tại thì xóa để tránh nhầm lẫn.
rm -f "$TARGET/components/TvSeekFocusBridge.tsx"

echo "Applied BảoFlix TV remote best drop-in."
echo "Next:"
echo "  cd \"$TARGET\""
echo "  npm run lint"
echo "  npm run build"
