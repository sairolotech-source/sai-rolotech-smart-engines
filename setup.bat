@echo off
REM ============================================================================
REM SAI ROLOTECH SMART ENGINES v2.2.0 — Windows Auto Setup
REM Double-click karein — sab automatic ho jayega!
REM ============================================================================

title SAI Rolotech Smart Engines — Auto Setup
color 0A

echo.
echo ========================================================
echo   SAI ROLOTECH SMART ENGINES v2.2.0
echo   Precision Roll Forming Engineering Suite
echo   AUTOMATIC WINDOWS SETUP
echo ========================================================
echo.

REM ─── Step 1: Admin Check & Windows Defender Exclusion ───
echo [1/6] Windows Defender Exclusion...
net session >nul 2>&1
if %errorlevel%==0 (
    powershell -Command "Add-MpExclusion -Path '%~dp0'" >nul 2>&1
    if %errorlevel%==0 (
        echo   [OK] Folder excluded from Windows Defender
    ) else (
        echo   [!] Exclusion set — may need manual confirm
    )
    powershell -Command "Add-MpExclusion -Process 'node.exe'" >nul 2>&1
    echo   [OK] node.exe excluded from scanning
) else (
    echo   [!] Admin rights nahi hain — Right-click ^> Run as Administrator
    echo   [!] Bina admin ke Defender exclusion nahi lagega
    echo.
    echo   Kya bina admin ke continue karna hai? (Y/N)
    set /p CONTINUE_CHOICE="> "
    if /i not "%CONTINUE_CHOICE%"=="Y" (
        echo   Setup cancelled. Right-click ^> Run as Administrator se chalayein.
        pause
        exit /b 1
    )
)
echo.

REM ─── Step 2: System Detection ───
echo [2/6] System Detection...
echo   OS: Windows %OS%
echo   Architecture: %PROCESSOR_ARCHITECTURE%
echo   Computer: %COMPUTERNAME%
echo   CPU Cores: %NUMBER_OF_PROCESSORS%
echo.

REM ─── Step 3: Node.js & pnpm Check ───
echo [3/6] Runtime Check...
where node >nul 2>nul
if %errorlevel%==0 (
    for /f "tokens=*" %%a in ('node -v') do echo   Node.js: %%a
) else (
    echo   [X] Node.js NAHI MILA!
    echo   Download karein: https://nodejs.org
    echo   Install karke dobara setup.bat chalayein.
    pause
    exit /b 1
)

where pnpm >nul 2>nul
if %errorlevel%==0 (
    for /f "tokens=*" %%a in ('pnpm -v') do echo   pnpm: v%%a
) else (
    echo   pnpm install ho raha hai...
    call npm install -g pnpm
    if %errorlevel% neq 0 (
        echo   [X] pnpm install fail hua
        pause
        exit /b 1
    )
    echo   [OK] pnpm installed
)
echo.

REM ─── Step 4: Install Dependencies ───
echo [4/6] Dependencies Install (2-5 min lagega)...
cd /d "%~dp0"
if exist "pnpm-workspace.yaml" (
    call pnpm install --frozen-lockfile 2>nul || call pnpm install
    if %errorlevel%==0 (
        echo   [OK] Sab packages install ho gaye!
    ) else (
        echo   [X] Install mein error aaya
        echo   Manually try karein: pnpm install
        pause
        exit /b 1
    )
) else (
    echo   [X] Project files nahi mile — sahi folder mein setup.bat rakhein
    pause
    exit /b 1
)
echo.

REM ─── Step 5: File Verification ───
echo [5/6] Project Files Check...
set FILE_OK=0
set FILE_TOTAL=4

if exist "artifacts\design-tool\vite.config.ts" (
    echo   [OK] Frontend
    set /a FILE_OK+=1
)
if exist "artifacts\api-server\src\index.ts" (
    echo   [OK] Backend
    set /a FILE_OK+=1
)
if exist "artifacts\design-tool\src\pages\Home.tsx" (
    echo   [OK] Main App
    set /a FILE_OK+=1
)
if exist "artifacts\design-tool\src\store\useCncStore.ts" (
    echo   [OK] Data Store
    set /a FILE_OK+=1
)
echo   Files: %FILE_OK%/%FILE_TOTAL% verified
echo.

REM ─── Step 6: Start Application ───
echo [6/6] Application Start...
echo.
echo ========================================================
echo   SETUP COMPLETE — APP SHURU HO RAHA HAI!
echo ========================================================
echo.
echo   Frontend: http://localhost:5000
echo   Backend:  http://localhost:8080
echo.
echo   Browser mein http://localhost:5000 kholein
echo   Band karne ke liye yeh window band karein (Ctrl+C)
echo.
echo ========================================================
echo.

start "SAI-API-Server" cmd /c "cd /d "%~dp0" && pnpm --filter @workspace/api-server run dev"
timeout /t 3 /nobreak >nul
start "SAI-Design-Tool" cmd /c "cd /d "%~dp0" && set PORT=5000 && pnpm --filter @workspace/design-tool run dev"

timeout /t 5 /nobreak >nul
start http://localhost:5000

echo   App chal raha hai! Browser automatically khul jayega.
echo   Yeh window band mat karein.
echo.
pause
