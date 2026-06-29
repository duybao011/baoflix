@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

set "TARGET=%~1"
if "%TARGET%"=="" (
  echo Nhap hoac keo-tha thu muc project baoflix vao day roi Enter:
  set /p "TARGET=> "
)

set "TARGET=%TARGET:"=%"

if not exist "%TARGET%\package.json" (
  echo.
  echo [LOI] Khong thay package.json trong: %TARGET%
  echo Hay chon dung thu muc project baoflix.
  pause
  exit /b 1
)

set "PATCH_DIR=%~dp0"

echo.
 echo Dang copy patch TV Watch Fix vao:
 echo %TARGET%
 echo.

if not exist "%TARGET%\app\xem\[slug]" mkdir "%TARGET%\app\xem\[slug]"
if not exist "%TARGET%\components" mkdir "%TARGET%\components"

copy /Y "%PATCH_DIR%app\layout.tsx" "%TARGET%\app\layout.tsx" >nul
if errorlevel 1 goto :copy_error

copy /Y "%PATCH_DIR%app\xem\[slug]\page.tsx" "%TARGET%\app\xem\[slug]\page.tsx" >nul
if errorlevel 1 goto :copy_error

copy /Y "%PATCH_DIR%components\WatchClient.tsx" "%TARGET%\components\WatchClient.tsx" >nul
if errorlevel 1 goto :copy_error

if exist "%TARGET%\components\TvSeekFocusBridge.tsx" (
  del /F /Q "%TARGET%\components\TvSeekFocusBridge.tsx"
)

echo [OK] Da apply patch. Khong dung API/lib/kkphim/app page.
echo.
set /p RUNBUILD="Chay npm run build luon khong? (Y/N): "
if /I "%RUNBUILD%"=="Y" (
  cd /d "%TARGET%"
  call npm run build
)

echo.
echo Xong. Test lai /tv - phim - Xem ngay.
pause
exit /b 0

:copy_error
echo.
echo [LOI] Copy file that bai. Hay kiem tra quyen ghi file / duong dan project.
pause
exit /b 1
