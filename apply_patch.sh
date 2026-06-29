#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"

copy_file() {
  local rel="$1"
  mkdir -p "$ROOT/$(dirname "$rel")"
  cp "$PATCH_DIR/$rel" "$ROOT/$rel"
  echo "patched $rel"
}

copy_file "components/TvRemoteNavigator.tsx"
copy_file "components/TvDashboard.tsx"
copy_file "components/TvSearchBox.tsx"
copy_file "components/FilterPanel.tsx"
copy_file "components/MovieGrid.tsx"
copy_file "components/Pagination.tsx"
copy_file "components/MovieCard.tsx"

echo "Done. Run: npm run lint && npm run build"
