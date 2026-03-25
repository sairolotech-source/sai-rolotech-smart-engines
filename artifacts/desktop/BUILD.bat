@echo off
title SAI Rolotech Smart Engines v2.2.23 - Auto Builder
color 0A
echo.
echo  =====================================================
echo   SAI Rolotech Smart Engines v2.2.23 - Auto Builder
echo   Single Click - Full Auto Build
echo  =====================================================
echo.

:: Root folder (BUILD.bat ke upar 2 folder hain)
cd /d "%~dp0..\.."
set "ROOT=%cd%"
set "DESKTOP=%ROOT%\artifacts\desktop"
set "RELEASE=%DESKTOP%\release"

:: Step 0: Cleanup - purani app band karo + pura release folder delete karo
echo  [0/7] Cleanup...
taskkill /f /im "SAI Rolotech Smart Engines.exe" 2>nul
taskkill /f /im "electron.exe" 2>nul
taskkill /f /im "node.exe" /fi "WINDOWTITLE eq SAI*" 2>nul
timeout /t 2 /nobreak >nul
if exist "%RELEASE%" (
    echo  [0/7] Purana release folder hata raha hai...
    rmdir /s /q "%RELEASE%" 2>nul
)
echo  [OK] Cleanup done.

:: Step 1: Node.js check
echo.
echo  [1/7] Node.js check...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js nahi mila!
    echo  https://nodejs.org se install karein phir dobara chalayein.
    pause & exit /b 1
)
echo  [OK] Node.js ready.

:: Step 2: pnpm check
echo.
echo  [2/7] pnpm check...
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo  pnpm nahi mila, install ho raha hai...
    call npm install -g pnpm
    if %errorlevel% neq 0 (
        echo  [ERROR] pnpm install fail!
        pause & exit /b 1
    )
)
echo  [OK] pnpm ready.

:: Step 3: GitHub se latest code (force update - koi conflict nahi)
echo.
echo  [3/7] GitHub se latest code le raha hai...
git fetch origin main 2>&1
git reset --hard origin/main 2>&1
echo  [OK] Code latest ho gaya.

:: Step 4: Packages install
echo.
echo  [4/7] Packages install ho rahe hain...
cd /d "%ROOT%"
call pnpm install --frozen-lockfile
if %errorlevel% neq 0 (
    echo  [WARN] Frozen lockfile fail, retry without frozen...
    call pnpm install --no-frozen-lockfile
    if %errorlevel% neq 0 (
        echo  [ERROR] Package install fail!
        pause & exit /b 1
    )
)
echo  [OK] Packages ready.

:: Step 5: API Server build
echo.
echo  [5/7] API Server build ho raha hai...
cd /d "%ROOT%\artifacts\api-server"
call pnpm run build
if %errorlevel% neq 0 (
    echo  [ERROR] API Server build fail!
    pause & exit /b 1
)
echo  [OK] API Server ready.

:: Step 6: Frontend build
echo.
echo  [6/7] Frontend build ho raha hai...
cd /d "%ROOT%\artifacts\design-tool"
call pnpm run build
if %errorlevel% neq 0 (
    echo  [ERROR] Frontend build fail!
    pause & exit /b 1
)
echo  [OK] Frontend ready.

:: Step 7: TypeScript compile + EXE build
echo.
echo  [7/7] Windows EXE ban raha hai (3-5 min)...
cd /d "%DESKTOP%"
call npx tsc -p tsconfig.json
if %errorlevel% neq 0 (
    echo  [ERROR] TypeScript compile fail!
    pause & exit /b 1
)

:: Build choice - PORTABLE (default) ya INSTALLER
set "BUILD_TYPE=portable"
echo.
echo  Build type chuno:
echo  [1] Portable EXE (recommended - koi install nahi chahiye)
echo  [2] NSIS Installer (proper install with shortcuts)
echo  [3] Dono banao
echo.
set /p CHOICE="Choice (default=1): "
if "%CHOICE%"=="2" set "BUILD_TYPE=nsis"
if "%CHOICE%"=="3" set "BUILD_TYPE=all"

if "%BUILD_TYPE%"=="portable" (
    call npx electron-builder --win --config.win.target=portable
) else if "%BUILD_TYPE%"=="nsis" (
    call npx electron-builder --win nsis
) else (
    call npx electron-builder --win nsis portable
)

if %errorlevel% neq 0 (
    echo  [ERROR] EXE build fail!
    pause & exit /b 1
)

:: Done
echo.
echo  =====================================================
echo   BUILD COMPLETE! v2.2.23
if "%BUILD_TYPE%"=="portable" (
    echo   SAI-Rolotech-Smart-Engines-Portable-2.2.23.exe
) else if "%BUILD_TYPE%"=="nsis" (
    echo   SAI-Rolotech-Smart-Engines-Setup-2.2.23.exe
) else (
    echo   Portable + NSIS Installer - dono ready!
)
echo   Folder: %RELEASE%
echo  =====================================================
echo.

start "" explorer "%RELEASE%"
pause
