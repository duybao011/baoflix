@echo off
setlocal EnableExtensions
chcp 65001 >nul

title BaoFlix TV Remote Patch

set "PATCH_DIR=%~dp0"
set "TARGET=%~1"

if "%TARGET%"=="" (
  echo.
  echo === BaoFlix TV Remote Best Drop-in ===
  echo Keo tha thu muc project baoflix vao cua so nay roi bam Enter,
  echo hoac dan duong dan vi du: C:\Users\Bao\baoflix
  echo.
  set /p "TARGET=Duong dan project baoflix: "
)

if "%TARGET%"=="" (
  echo.
  echo Chua nhap duong dan. Thoat.
  pause
  exit /b 1
)

rem Remove wrapping quotes if the path was drag-dropped with quotes.
set "TARGET=%TARGET:"=%"

if not exist "%TARGET%\package.json" (
  echo.
  echo Khong thay package.json trong:
  echo %TARGET%
  echo.
  echo Hay chon dung thu muc goc cua project baoflix.
  pause
  exit /b 1
)

echo.
echo Dang copy patch vao:
echo %TARGET%
echo.

robocopy "%PATCH_DIR%app" "%TARGET%\app" /E /NFL /NDL /NJH /NJS /NP
if %ERRORLEVEL% GEQ 8 goto copy_error

robocopy "%PATCH_DIR%components" "%TARGET%\components" /E /NFL /NDL /NJH /NJS /NP
if %ERRORLEVEL% GEQ 8 goto copy_error

if exist "%TARGET%\components\TvSeekFocusBridge.tsx" (
  echo Xoa TvSeekFocusBridge.tsx de tranh 2 lop bat remote...
  del /F /Q "%TARGET%\components\TvSeekFocusBridge.tsx"
)

echo.
echo Da apply xong patch remote TV.
echo.
choice /C YN /N /M "Chay npm run lint va npm run build luon? [Y/N]: "
if errorlevel 2 goto done

cd /d "%TARGET%"
echo.
echo Dang chay npm run lint...
call npm run lint
if errorlevel 1 goto npm_error

echo.
echo Dang chay npm run build...
call npm run build
if errorlevel 1 goto npm_error

echo.
echo Xong: lint/build deu qua.
goto done

:copy_error
echo.
echo Loi khi copy file bang robocopy. Ma loi: %ERRORLEVEL%
echo Kiem tra lai quyen ghi file hoac dong VS Code/dev server neu file dang bi khoa.
pause
exit /b 1

:npm_error
echo.
echo npm bao loi. Copy log loi gui lai de minh dong ZIP fix tiep.
pause
exit /b 1

:done
echo.
echo Hoan tat. Bam phim bat ky de dong cua so.
pause >nul
exit /b 0
