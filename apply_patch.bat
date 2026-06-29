@echo off
setlocal
node scripts\apply_final_cleanup_fix.cjs
if errorlevel 1 (
  echo Patch failed.
  exit /b 1
)
echo Patch applied.