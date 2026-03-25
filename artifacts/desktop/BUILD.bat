@echo off
title SAI Rolotech Smart Engines v2.2.23 - Auto Builder
color 0A
:: Agar koi bhi error aaye, window band nahi hogi
if "%1"=="" (
    cmd /k "%~f0" RUNNING
    exit /b
)
echo.
echo  =====================================================
echo   SAI Rolotech Smart Engines v2.2.23 - Auto Builder
echo   Features: Auto Mode, Hardware Dashboard, NVIDIA GPU
echo  =====================================================
echo.

:: Root folder
cd /d "%~dp0..\.."
set "ROOT=%cd%"
set "DESKTOP=%ROOT%\artifacts\desktop"
set "RELEASE=%DESKTOP%\release"

:: Step 1: Node.js check
echo  [1/6] Node.js check...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js nahi mila!
    echo  https://nodejs.org se install karein phir dobara chalayein.
    pause & exit /b 1
)
echo  [OK] Node.js ready.

:: Step 2: pnpm
echo.
echo  [2/6] pnpm install...
npm install -g pnpm >nul 2>&1
echo  [OK] pnpm ready.

:: Step 3: Git pull
echo.
echo  [3/6] GitHub se latest code le raha hai...
git pull origin main
echo  [OK] Code updated.

:: Step 4: Packages
echo.
echo  [4/6] Packages install ho rahe hain...
pnpm install
if %errorlevel% neq 0 (
    echo  [ERROR] Package install fail!
    pause & exit /b 1
)
echo  [OK] Packages ready.

:: Step 5: Build frontend + backend
echo.
echo  [5/6] Frontend aur Backend build ho rahe hain...
cd /d "%ROOT%\artifacts\design-tool"
call pnpm run build
if %errorlevel% neq 0 (
    echo  [ERROR] Frontend build fail!
    pause & exit /b 1
)
cd /d "%ROOT%\artifacts\api-server"
call pnpm run build
echo  [OK] Frontend + Backend ready.

:: Step 6: Electron EXE
echo.
echo  [6/6] Windows EXE ban raha hai (2-4 min)...
cd /d "%DESKTOP%"
call npx tsc -p tsconfig.json
call npx electron-builder --win nsis portable
if %errorlevel% neq 0 (
    echo  [ERROR] EXE build fail!
    pause & exit /b 1
)

:: Done - folder kholo
echo.
echo  =====================================================
echo   BUILD COMPLETE! v2.2.23
echo   EXE tayaar hai!
echo  =====================================================
echo.

:: Release folder automatically kholo
explorer "%RELEASE%"

pause
