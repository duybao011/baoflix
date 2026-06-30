@echo off
setlocal
node scripts\apply_tv_remote_logic_stabilizer.cjs
if errorlevel 1 (
  echo Patch failed.
  exit /b 1
)
echo Patch applied.