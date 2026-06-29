#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
if [ ! -f "$ROOT/package.json" ]; then
  echo "Run this script from the BảoFlix project root." >&2
  exit 1
fi
mkdir -p "$ROOT/components"
cp "$(dirname "$0")/components/TvSearchBox.tsx" "$ROOT/components/TvSearchBox.tsx"
echo "Applied TV search keyboard patch."
