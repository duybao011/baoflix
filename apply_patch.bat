@echo off
setlocal
node scripts\apply_tv_remote_global_v5.cjs
if errorlevel 1 (
  echo Patch failed.
  exit /b 1
)
echo Patch applied.