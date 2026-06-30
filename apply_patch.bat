@echo off
setlocal
node scripts\apply_tv_ui_v3_lean_remote.cjs
if errorlevel 1 (
  echo Patch failed.
  exit /b 1
)
echo Patch applied.