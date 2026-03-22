@echo off
REM ============================================================================
REM SAI ROLOTECH SMART ENGINES — Windows Setup Script
REM Precision Roll Forming Engineering Suite (Ultra Pro Max)
REM ============================================================================
REM Usage: Double-click setup.bat OR run from Command Prompt
REM ============================================================================

title SAI Rolotech Smart Engines — System Setup
color 0A

echo.
echo ========================================================
echo   SAI ROLOTECH SMART ENGINES — SYSTEM SETUP
echo   Precision Roll Forming Engineering Suite
echo ========================================================
echo.

set PASS=0
set FAIL=0

REM ─── System Detection ───
echo [1/7] System Detection
echo   OS: Windows %OS%
echo   Architecture: %PROCESSOR_ARCHITECTURE%
echo   Computer: %COMPUTERNAME%
echo   Processors: %NUMBER_OF_PROCESSORS%

set CPU_CORES=%NUMBER_OF_PROCESSORS%
echo   CPU Cores: %CPU_CORES%

set /a POOL_SIZE=%CPU_CORES%-1
if %POOL_SIZE% LSS 2 set POOL_SIZE=2
if %POOL_SIZE% GTR 8 set POOL_SIZE=8
echo   Worker Pool Size: %POOL_SIZE% threads
set /a PASS+=1
echo.

REM ─── RAM Detection ───
echo [2/7] Memory Detection
for /f "tokens=2 delims==" %%a in ('wmic computersystem get TotalPhysicalMemory /value 2^>nul') do set TOTAL_RAM_BYTES=%%a
if defined TOTAL_RAM_BYTES (
    set /a TOTAL_RAM_GB=%TOTAL_RAM_BYTES:~0,-9%
    echo   Total RAM: ~%TOTAL_RAM_GB% GB
    set /a PASS+=1
) else (
    echo   [!] Could not detect RAM
    set /a FAIL+=1
)

REM ─── GPU Detection ───
echo.
echo [3/7] GPU Detection
for /f "tokens=*" %%a in ('wmic path win32_videocontroller get name /value 2^>nul ^| findstr "="') do (
    set GPU_LINE=%%a
    echo   %%a
)
set /a PASS+=1
echo.

REM ─── Node.js Check ───
echo [4/7] Runtime Environment
where node >nul 2>nul
if %errorlevel%==0 (
    for /f "tokens=*" %%a in ('node -v') do echo   Node.js: %%a
    set /a PASS+=1
) else (
    echo   [X] Node.js NOT INSTALLED
    echo   Download from: https://nodejs.org
    set /a FAIL+=1
)

where pnpm >nul 2>nul
if %errorlevel%==0 (
    for /f "tokens=*" %%a in ('pnpm -v') do echo   pnpm: v%%a
    set /a PASS+=1
) else (
    echo   [!] pnpm not found — installing...
    npm install -g pnpm 2>nul
    if %errorlevel%==0 (
        echo   pnpm installed
        set /a PASS+=1
    ) else (
        echo   [X] pnpm install failed
        set /a FAIL+=1
    )
)
echo.

REM ─── Install Dependencies ───
echo [5/7] Installing Dependencies
if exist "pnpm-workspace.yaml" (
    echo   Monorepo workspace detected
    echo   Installing packages...
    call pnpm install
    if %errorlevel%==0 (
        echo   All packages installed
        set /a PASS+=1
    ) else (
        echo   [X] Install failed
        set /a FAIL+=1
    )
) else (
    echo   [X] pnpm-workspace.yaml not found
    set /a FAIL+=1
)
echo.

REM ─── File Checks ───
echo [6/7] Project File Verification
set FILE_OK=0

if exist "artifacts\design-tool\vite.config.ts" (
    echo   [OK] Frontend config found
    set /a FILE_OK+=1
)
if exist "artifacts\api-server\src\index.ts" (
    echo   [OK] Backend entry point found
    set /a FILE_OK+=1
)
if exist "artifacts\design-tool\src\lib\hardware-engine.ts" (
    echo   [OK] Hardware acceleration engine
    set /a FILE_OK+=1
)
if exist "artifacts\design-tool\src\lib\gpu-tier.ts" (
    echo   [OK] GPU tier detection
    set /a FILE_OK+=1
)
if exist "artifacts\design-tool\src\hooks\useWebLLM.ts" (
    echo   [OK] Offline AI engine
    set /a FILE_OK+=1
)
if exist "artifacts\api-server\src\lib\workers\worker-pool.ts" (
    echo   [OK] Backend worker pool
    set /a FILE_OK+=1
)
echo   Files verified: %FILE_OK%/6
set /a PASS+=%FILE_OK%
echo.

REM ─── Environment ───
echo [7/7] Environment Configuration
if defined VITE_FIREBASE_API_KEY (
    echo   [OK] Firebase API Key set
    set /a PASS+=1
) else (
    echo   [!] VITE_FIREBASE_API_KEY not set
)
if defined DATABASE_URL (
    echo   [OK] Database URL set
    set /a PASS+=1
) else (
    echo   [!] DATABASE_URL not set
)
echo.

REM ─── Summary ───
echo ========================================================
echo   SETUP SUMMARY
echo ========================================================
echo   CPU Cores: %CPU_CORES%
echo   Worker Pool: %POOL_SIZE% threads
echo   Passed: %PASS%  ^|  Failed: %FAIL%
echo.
if %FAIL%==0 (
    echo   STATUS: ALL SYSTEMS READY
    echo.
    echo   Hardware Mode: ENABLED
    echo   Cloud Dependency: MINIMAL
    echo.
    echo   To start the application:
    echo     pnpm --filter @workspace/api-server run dev
    echo     pnpm --filter @workspace/design-tool run dev
) else (
    echo   STATUS: %FAIL% issues found — fix and re-run
)
echo ========================================================
echo.
pause
