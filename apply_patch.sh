#!/usr/bin/env bash
set -euo pipefail
node scripts/apply_tv_v4_typefix_country_category.cjs
echo "Patch applied."