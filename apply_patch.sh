#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"

echo "Applying BảoFlix TV UI density patch..."

if [ ! -d "$ROOT/components" ]; then
  echo "ERROR: Run this from the BảoFlix project root."
  exit 1
fi

cp "$(dirname "$0")/components/TvDashboard.tsx" "$ROOT/components/TvDashboard.tsx"
cp "$(dirname "$0")/components/TvSearchBox.tsx" "$ROOT/components/TvSearchBox.tsx"
cp "$(dirname "$0")/components/TvMovieDetailShell.tsx" "$ROOT/components/TvMovieDetailShell.tsx"
cp "$(dirname "$0")/app/tv/page.tsx" "$ROOT/app/tv/page.tsx"

echo "Done. Now run: npm run lint && npm run build"
