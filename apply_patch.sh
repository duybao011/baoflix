#!/usr/bin/env bash
set -euo pipefail
node scripts/apply_tv_overlay_latency_polish.cjs
echo "Patch applied successfully."
