@echo off
setlocal
node scripts\apply_tv_v4_typefix_country_category.cjs
if errorlevel 1 (
  echo Patch failed.
  exit /b 1
)
echo Patch applied.