#!/usr/bin/env bash
set -euo pipefail
node scripts/apply_final_cleanup_fix.cjs
echo "Patch applied."