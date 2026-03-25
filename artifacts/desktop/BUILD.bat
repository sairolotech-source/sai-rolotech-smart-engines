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

:: Step 0: Purani app band karo (lock problem fix)
echo  [0/7] Purani app band kar raha hai...
taskkill /f /im "SAI Rolotech Smart Engines.exe" 2>nul
taskkill /f /im "electron.exe" 2>nul
timeout /t 2 /nobreak >nul
:: Purana win-unpacked delete karo (d3dcompiler lock fix)
if exist "%RELEASE%\win-unpacked" (
    echo  [0/7] Purana build folder hata raha hai...
    rmdir /s /q "%RELEASE%\win-unpacked" 2>nul
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

:: Step 3: Windows ke liye package.json preinstall fix (sh.exe Windows pe nahi hota)
echo.
echo  [3/7] Windows compatibility patch...
node -e "try{var fs=require('fs');var p=JSON.parse(fs.readFileSync('package.json','utf8'));if(p.scripts&&p.scripts.preinstall&&p.scripts.preinstall.indexOf('sh ')===0){p.scripts.preinstall='echo preinstall ok';fs.writeFileSync('package.json',JSON.stringify(p,null,2));console.log('[OK] Preinstall fixed.');}else{console.log('[OK] Already compatible.');}}catch(e){console.log('patch skip:',e.message);}"
echo  [OK] Patch done.

:: Step 4: Git pull (latest code)
echo.
echo  [4/7] GitHub se latest code le raha hai...
git pull origin main 2>&1
echo  [OK] Code updated.

:: Step 5: Packages install
echo.
echo  [5/7] Packages install ho rahe hain...
call pnpm install
if %errorlevel% neq 0 (
    echo  [WARN] pnpm install failed — retrying with --no-frozen-lockfile...
    call pnpm install --no-frozen-lockfile
    if %errorlevel% neq 0 (
        echo  [ERROR] Package install fail!
        pause & exit /b 1
    )
)
echo  [OK] Packages ready.

:: Step 6a: API Server build (startup hang fix - PEHLE build karo)
echo.
echo  [6/7] API Server build ho raha hai...
cd /d "%ROOT%\artifacts\api-server"
call pnpm run build
if %errorlevel% neq 0 (
    echo  [ERROR] API Server build fail!
    pause & exit /b 1
)
echo  [OK] API Server ready.

:: Step 6b: Frontend build
echo.
echo  [6b/7] Frontend build ho raha hai...
cd /d "%ROOT%\artifacts\design-tool"
call pnpm run build
if %errorlevel% neq 0 (
    echo  [ERROR] Frontend build fail!
    pause & exit /b 1
)
echo  [OK] Frontend ready.

:: Step 7: Electron EXE
echo.
echo  [7/7] Windows EXE ban raha hai (3-5 min)...
cd /d "%DESKTOP%"
call npx tsc -p tsconfig.json
if %errorlevel% neq 0 (
    echo  [ERROR] TypeScript compile fail!
    pause & exit /b 1
)
call npx electron-builder --win portable
if %errorlevel% neq 0 (
    echo  [ERROR] EXE build fail! Admin rights se chalayein.
    pause & exit /b 1
)

:: Done
echo.
echo  =====================================================
echo   BUILD COMPLETE! v2.2.23
echo   EXE tayaar hai!
echo  =====================================================
echo.

:: Release folder automatically kholo
start "" explorer "%RELEASE%"

pause
