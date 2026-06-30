@echo off
setlocal
node scripts\apply_tv_focus_header_filter_fix.cjs
if errorlevel 1 (
  echo Patch failed.
  exit /b 1
)
echo Patch applied.