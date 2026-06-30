#!/usr/bin/env bash
set -euo pipefail
node scripts/apply_tv_density_header_down_fix.cjs
echo "Patch applied."