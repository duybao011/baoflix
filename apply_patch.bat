@echo off
setlocal
set "ROOT=%cd%"
copy /Y "%~dp0eslint.config.mjs" "%ROOT%\eslint.config.mjs"
echo.
echo Stage 1 lint unblock patch applied.
echo Run: npm run lint
endlocal
