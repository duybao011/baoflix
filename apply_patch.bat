@echo off
setlocal
if not exist package.json (
  echo Run this script from the BaoFlix project root.
  exit /b 1
)
if not exist components mkdir components
copy /Y "%~dp0components\TvSearchBox.tsx" "components\TvSearchBox.tsx" >nul
echo Applied TV search keyboard patch.
