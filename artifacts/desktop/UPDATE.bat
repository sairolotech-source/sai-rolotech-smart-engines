@echo off
title SAI Rolotech Smart Engines - Smooth Updater
color 0B
echo.
echo  =====================================================
echo   SAI Rolotech Smart Engines - Smooth Update Tool
echo   Laptop ke liye optimized - Sab tools sahi rahenge
echo  =====================================================
echo.

cd /d "%~dp0..\.."
set "ROOT=%cd%"
set "DESKTOP=%ROOT%\artifacts\desktop"
set "RELEASE=%DESKTOP%\release"

:: Step 1: App band karo
echo  [1/6] App processes band kar raha hai...
taskkill /f /im "SAI Rolotech Smart Engines.exe" 2>nul
taskkill /f /im "SAI-Rolotech-Smart-Engines-Portable*.exe" 2>nul
taskkill /f /im "electron.exe" 2>nul
timeout /t 3 /nobreak >nul
echo  [OK] App band ho gaya.

:: Step 2: Port 3001 free karo
echo.
echo  [2/6] API port free kar raha hai...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3001 "') do (
    taskkill /F /PID %%a 2>nul
)
echo  [OK] Port clear.

:: Step 3: GitHub se latest code
echo.
echo  [3/6] GitHub se latest update le raha hai...
git fetch origin main 2>&1
if %errorlevel% neq 0 (
    echo  [WARN] GitHub se connect nahi ho saka. Internet check karein.
    echo  Phir bhi continue karein? (Y/N)
    set /p CONT=""
    if /i not "%CONT%"=="Y" pause & exit /b 1
)
git reset --hard origin/main 2>&1
echo  [OK] Code latest ho gaya.

:: Step 4: Packages update
echo.
echo  [4/6] Packages update ho rahe hain...
call pnpm install --frozen-lockfile 2>nul
if %errorlevel% neq 0 (
    call pnpm install --no-frozen-lockfile
)
echo  [OK] Packages ready.

:: Step 5: Build
echo.
echo  [5/6] App rebuild ho rahi hai...

echo  API Server build ho raha hai...
cd /d "%ROOT%\artifacts\api-server"
call pnpm run build >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] API Server build fail! BUILD.bat se try karein.
    pause & exit /b 1
)

echo  Frontend build ho raha hai...
cd /d "%ROOT%\artifacts\design-tool"
call pnpm run build >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] Frontend build fail! BUILD.bat se try karein.
    pause & exit /b 1
)

echo  Electron compile ho raha hai...
cd /d "%DESKTOP%"
call npx tsc -p tsconfig.json >nul 2>&1

:: Purana release clear karo (stale files ka main cause)
if exist "%RELEASE%" rmdir /s /q "%RELEASE%" 2>nul

echo  EXE ban raha hai (2-4 min)...
call npx electron-builder --win --config.win.target=portable >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERROR] EXE build fail!
    pause & exit /b 1
)

:: Step 6: Electron cache clear karo laptop pe
echo.
echo  [6/6] Purana cache clear kar raha hai (tools sahi kaam karenge)...
set "CACHE_DIR=%APPDATA%\SAI Rolotech Smart Engines"
if exist "%CACHE_DIR%\Cache"      rmdir /s /q "%CACHE_DIR%\Cache" 2>nul
if exist "%CACHE_DIR%\Code Cache" rmdir /s /q "%CACHE_DIR%\Code Cache" 2>nul
if exist "%CACHE_DIR%\GPUCache"   rmdir /s /q "%CACHE_DIR%\GPUCache" 2>nul
echo  [OK] Cache saaf ho gaya.

:: Done
echo.
echo  =====================================================
echo   UPDATE COMPLETE!
echo   Nayi file: %RELEASE%
echo   Ab portable EXE run karein - sab tools sahi honge.
echo  =====================================================
echo.

:: App start karo
echo  App start karo? (Y/N)
set /p START=""
if /i "%START%"=="Y" (
    for %%f in ("%RELEASE%\SAI-Rolotech-Smart-Engines-Portable*.exe") do start "" "%%f"
)

start "" explorer "%RELEASE%"
pause
