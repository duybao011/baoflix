#!/usr/bin/env bash
set -euo pipefail
node scripts/apply_mode_isolation_resilience.cjs
echo "Patch applied."