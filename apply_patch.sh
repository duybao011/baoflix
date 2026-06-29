#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
cp "$(dirname "$0")/eslint.config.mjs" "$ROOT/eslint.config.mjs"
echo "Stage 1 lint unblock patch applied."
echo "Run: npm run lint"
