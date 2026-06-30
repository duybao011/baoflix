#!/usr/bin/env bash
set -euo pipefail
node scripts/apply_tv_progress_typefix.cjs
echo "Patch applied."