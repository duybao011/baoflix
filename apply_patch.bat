@echo off
setlocal
node scripts\apply_tv_menu_keyboard_fix.cjs
if errorlevel 1 (
  echo Patch failed.
  exit /b 1
)
echo Patch applied.