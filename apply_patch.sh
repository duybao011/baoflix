#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
echo "Applying BảoFlix TV pause logic fix..."
if [ ! -d "$ROOT/components" ]; then
  echo "ERROR: Run this from the baoflix project root." >&2
  exit 1
fi
cp "$(dirname "$0")/components/NativeVideoPlayer.tsx" "$ROOT/components/NativeVideoPlayer.tsx"
echo "Done. Run: npm run lint && npm run build"
