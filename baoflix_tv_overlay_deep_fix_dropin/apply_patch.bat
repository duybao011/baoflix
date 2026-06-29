@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

echo ================================================
echo  BảoFlix TV Overlay Deep Fix - Drop-in Patch
echo ================================================
echo.

set "TARGET=%~1"
if "%TARGET%"=="" (
  echo Kéo/thả thư mục baoflix vào đây rồi Enter:
  set /p TARGET=
)

set "TARGET=%TARGET:"=%"

if not exist "%TARGET%\package.json" (
  echo.
  echo [LOI] Khong tim thay package.json trong: %TARGET%
  echo Hay chon dung thu muc project baoflix.
  pause
  exit /b 1
)

set "PATCH_DIR=%~dp0"

echo.
echo [1/4] Copy file TV/watch patch...
robocopy "%PATCH_DIR%app" "%TARGET%\app" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto copy_error
robocopy "%PATCH_DIR%components" "%TARGET%\components" /E /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto copy_error

echo [2/4] Don handler remote phu neu con ton tai...
if exist "%TARGET%\components\TvSeekFocusBridge.tsx" del /f /q "%TARGET%\components\TvSeekFocusBridge.tsx"

echo [3/4] Da apply patch.
echo.
choice /C YN /M "Chay npm run build luon khong"
if errorlevel 2 goto done

echo.
echo [4/4] Chay build...
cd /d "%TARGET%"
call npm run build
if errorlevel 1 (
  echo.
  echo [LOI] Build bi loi. Copy log gui lai ChatGPT.
  pause
  exit /b 1
)

goto done

:copy_error
echo.
echo [LOI] Copy file that bai. Kiem tra quyen ghi file / antivirus / duong dan.
pause
exit /b 1

:done
echo.
echo Xong. Test lai: /tv -^> chon phim -^> Xem ngay.
pause
exit /b 0
