#!/usr/bin/env bash
set -euo pipefail
node scripts/apply_tv_header_filter_remote_fix.cjs
echo "Patch applied."