@echo off
title Sai Rolotech Smart Engines - Installer Builder
color 0A
echo.
echo  =============================================
echo   Sai Rolotech Smart Engines v2.2.0 Builder
echo  =============================================
echo.
echo  Step 1: Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js not found!
    echo  Please install Node.js from: https://nodejs.org
    echo  Then run this file again.
    pause
    exit /b 1
)
echo  [OK] Node.js found.

echo.
echo  Step 2: Installing pnpm...
npm install -g pnpm >nul 2>&1
echo  [OK] pnpm ready.

echo.
echo  Step 3: Installing project packages...
cd /d "%~dp0..\.."
pnpm install
if %errorlevel% neq 0 (
    echo  [ERROR] Package install failed!
    pause
    exit /b 1
)
echo  [OK] Packages installed.

echo.
echo  Step 4: Building installer...
pnpm --filter @workspace/desktop run dist:installer
if %errorlevel% neq 0 (
    echo  [ERROR] Build failed!
    pause
    exit /b 1
)

echo.
echo  =============================================
echo   BUILD COMPLETE!
echo   Installer saved in:
echo   artifacts\desktop\release\
echo  =============================================
echo.
pause
