#!/usr/bin/env bash
set -euo pipefail
node scripts/apply_restore_smooth_no_dynamic.cjs
echo "Patch applied."
