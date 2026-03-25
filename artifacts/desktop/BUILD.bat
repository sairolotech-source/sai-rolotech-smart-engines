@echo off
title SAI Rolotech Smart Engines v2.2.23 - Builder
color 0A
echo.
echo  =====================================================
echo   SAI Rolotech Smart Engines v2.2.23 - EXE Builder
echo   Features: Auto Mode, Hardware Dashboard, NVIDIA GPU
echo  =====================================================
echo.

echo  [Step 1] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js nahi mila!
    echo  Yahan se install karein: https://nodejs.org
    echo  Phir BUILD.bat dobara chalayein.
    pause
    exit /b 1
)
echo  [OK] Node.js ready.

echo.
echo  [Step 2] pnpm install kar raha hai...
npm install -g pnpm >nul 2>&1
echo  [OK] pnpm ready.

echo.
echo  [Step 3] Project ka latest code GitHub se le raha hai...
cd /d "%~dp0..\.."
git pull origin main
if %errorlevel% neq 0 (
    echo  [WARN] Git pull fail hua - local code use karega.
)
echo  [OK] Code updated.

echo.
echo  [Step 4] Packages install ho rahe hain...
pnpm install
if %errorlevel% neq 0 (
    echo  [ERROR] Package install fail hua!
    pause
    exit /b 1
)
echo  [OK] Packages installed.

echo.
echo  [Step 5] v2.2.23 EXE build ho raha hai...
echo  (Isme 3-5 minute lag sakte hain...)
pnpm --filter @workspace/desktop run dist:all
if %errorlevel% neq 0 (
    echo  [ERROR] Build fail hua!
    pause
    exit /b 1
)

echo.
echo  =====================================================
echo   BUILD COMPLETE! v2.2.23
echo.
echo   Aapka naya EXE yahan hai:
echo   artifacts\desktop\release\
echo.
echo   Files:
echo   - SAI-Rolotech-Smart-Engines-Setup-2.2.23.exe
echo   - SAI-Rolotech-Smart-Engines-Portable-2.2.23.exe
echo  =====================================================
echo.
pause
