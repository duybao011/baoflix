@echo off
setlocal
node scripts\apply_mode_isolation_resilience.cjs
if errorlevel 1 (
  echo Patch failed.
  exit /b 1
)
echo Patch applied.