#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cp -R app "$ROOT/"
cp -R components "$ROOT/"
echo "Copied TV patch files into: $ROOT"
echo "Next: npm run lint && npm run build"
