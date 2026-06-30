#!/usr/bin/env bash
set -euo pipefail
node scripts/apply_tv_focus_header_filter_fix.cjs
echo "Patch applied."