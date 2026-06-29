@echo off
setlocal
node scripts\apply_restore_smooth_no_dynamic.cjs
if errorlevel 1 (
  echo Patch failed.
  exit /b 1
)
echo Patch applied.
