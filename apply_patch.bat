@echo off
setlocal
set ROOT=%cd%

echo Applying BảoFlix TV UI density patch...

if not exist "%ROOT%\components" (
  echo ERROR: Run this from the BảoFlix project root.
  exit /b 1
)

copy /Y "%~dp0components\TvDashboard.tsx" "%ROOT%\components\TvDashboard.tsx" >nul
copy /Y "%~dp0components\TvSearchBox.tsx" "%ROOT%\components\TvSearchBox.tsx" >nul
copy /Y "%~dp0components\TvMovieDetailShell.tsx" "%ROOT%\components\TvMovieDetailShell.tsx" >nul
copy /Y "%~dp0app\tv\page.tsx" "%ROOT%\app\tv\page.tsx" >nul

echo Done. Now run: npm run lint && npm run build
endlocal
