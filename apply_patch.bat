@echo off
setlocal
set ROOT=%cd%
echo Applying BảoFlix TV pause logic fix...
if not exist "%ROOT%\components" (
  echo ERROR: Run this from the baoflix project root.
  exit /b 1
)
copy /Y "%~dp0components\NativeVideoPlayer.tsx" "%ROOT%\components\NativeVideoPlayer.tsx" >nul
if errorlevel 1 exit /b 1
echo Done. Run: npm run lint && npm run build
