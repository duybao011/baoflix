@echo off
setlocal
node scripts\apply_tv_overlay_latency_polish.cjs
if errorlevel 1 (
  echo Patch failed.
  exit /b 1
)
echo Patch applied successfully.
