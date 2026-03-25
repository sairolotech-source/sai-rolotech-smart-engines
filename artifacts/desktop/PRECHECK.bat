@echo off
title SAI Rolotech - Pre-Build Check
color 0E
echo.
echo  =====================================================
echo   SAI Rolotech Smart Engines - Pre-Build Checker
echo   Build se pehle sab theek hai ya nahi check karta
echo  =====================================================
echo.

cd /d "%~dp0..\.."
set "ROOT=%cd%"
set "PASS=0"
set "FAIL=0"
set "WARN=0"

:: ── CHECK 1: Node.js ──────────────────────────────────
echo  [CHECK 1] Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [FAIL] Node.js nahi mila — https://nodejs.org se install karo
    set /a FAIL+=1
) else (
    for /f "tokens=*" %%v in ('node --version') do echo  [PASS] Node.js %%v
    set /a PASS+=1
)

:: ── CHECK 2: pnpm ─────────────────────────────────────
echo  [CHECK 2] pnpm...
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [FAIL] pnpm nahi mila — "npm install -g pnpm" chalaao
    set /a FAIL+=1
) else (
    for /f "tokens=*" %%v in ('pnpm --version') do echo  [PASS] pnpm v%%v
    set /a PASS+=1
)

:: ── CHECK 3: Git ──────────────────────────────────────
echo  [CHECK 3] Git...
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo  [FAIL] Git nahi mila — https://git-scm.com se install karo
    set /a FAIL+=1
) else (
    for /f "tokens=*" %%v in ('git --version') do echo  [PASS] %%v
    set /a PASS+=1
)

:: ── CHECK 4: node_modules exist ───────────────────────
echo  [CHECK 4] node_modules...
if not exist "%ROOT%\node_modules" (
    echo  [FAIL] node_modules nahi hai — pnpm install chalaao
    set /a FAIL+=1
) else (
    echo  [PASS] node_modules present
    set /a PASS+=1
)

:: ── CHECK 5: Rollup Windows binary ────────────────────
echo  [CHECK 5] Rollup Windows binary...
if not exist "%ROOT%\node_modules\.pnpm\@rollup+rollup-win32-x64-msvc*" (
    echo  [WARN] Rollup Windows binary missing — pnpm install se aayega
    set /a WARN+=1
) else (
    echo  [PASS] Rollup Windows binary present
    set /a PASS+=1
)

:: ── CHECK 6: API server source ────────────────────────
echo  [CHECK 6] API Server source...
if not exist "%ROOT%\artifacts\api-server\src\index.ts" (
    echo  [FAIL] API server source nahi mila!
    set /a FAIL+=1
) else (
    echo  [PASS] API Server source OK
    set /a PASS+=1
)

:: ── CHECK 7: Frontend source ──────────────────────────
echo  [CHECK 7] Frontend source...
if not exist "%ROOT%\artifacts\design-tool\src\main.tsx" (
    echo  [FAIL] Frontend source nahi mila!
    set /a FAIL+=1
) else (
    echo  [PASS] Frontend source OK
    set /a PASS+=1
)

:: ── CHECK 8: Electron main.ts ─────────────────────────
echo  [CHECK 8] Electron main.ts...
if not exist "%ROOT%\artifacts\desktop\src\main.ts" (
    echo  [FAIL] Electron main.ts nahi mila!
    set /a FAIL+=1
) else (
    echo  [PASS] Electron main.ts OK
    set /a PASS+=1
)

:: ── CHECK 9: TypeScript config ────────────────────────
echo  [CHECK 9] TypeScript config...
if not exist "%ROOT%\artifacts\desktop\tsconfig.json" (
    echo  [FAIL] tsconfig.json nahi mila!
    set /a FAIL+=1
) else (
    echo  [PASS] tsconfig.json OK
    set /a PASS+=1
)

:: ── CHECK 10: electron-builder config ─────────────────
echo  [CHECK 10] electron-builder config (no NSIS)...
node -e "try{var p=JSON.parse(require('fs').readFileSync('artifacts/desktop/package.json','utf8'));var targets=p.build&&p.build.win&&p.build.win.target;var hasNsis=JSON.stringify(targets).indexOf('nsis')!==-1;if(hasNsis){console.log('[WARN] NSIS target hai — FAIL ho sakta hai');}else{console.log('[PASS] Only portable target — OK');}}catch(e){console.log('[WARN] Could not check: '+e.message);}"
set /a PASS+=1

:: ── CHECK 11: Git conflict check ─────────────────────
echo  [CHECK 11] Git conflicts...
git status --porcelain >nul 2>&1
if %errorlevel% neq 0 (
    echo  [WARN] Git status check nahi hua
    set /a WARN+=1
) else (
    git diff --name-only --diff-filter=U > "%TEMP%\git_conflicts.txt" 2>&1
    for /f %%i in ("%TEMP%\git_conflicts.txt") do set "HAS_CONFLICT=%%~zi"
    if defined HAS_CONFLICT if not "%HAS_CONFLICT%"=="0" (
        echo  [WARN] Git conflicts detected — "git reset --hard origin/main" chalaao
        set /a WARN+=1
    ) else (
        echo  [PASS] No git conflicts
        set /a PASS+=1
    )
)

:: ── CHECK 12: TypeScript typecheck ───────────────────
echo  [CHECK 12] TypeScript typecheck (API server)...
cd /d "%ROOT%\artifacts\api-server"
call npx tsc --noEmit >"%TEMP%\ts_check.txt" 2>&1
if %errorlevel% neq 0 (
    echo  [WARN] TypeScript errors hain — build ho sakti hai but errors honge
    type "%TEMP%\ts_check.txt" | find "error" | head /c 5 2>nul
    set /a WARN+=1
) else (
    echo  [PASS] TypeScript OK
    set /a PASS+=1
)
cd /d "%ROOT%"

:: ── SUMMARY ──────────────────────────────────────────
echo.
echo  =====================================================
echo   RESULT: %PASS% PASS  /  %WARN% WARN  /  %FAIL% FAIL
echo  =====================================================

if %FAIL% gtr 0 (
    color 0C
    echo.
    echo  [STOP] Build mat chalao — upar wale FAIL fix karo pehle!
    echo.
    pause
    exit /b 1
) else if %WARN% gtr 0 (
    color 0E
    echo.
    echo  [OK] Build chal sakti hai — lekin warnings check karo.
    echo.
    set /p "CONTINUE=BUILD.bat chalana hai? (Y/N): "
    if /i "%CONTINUE%"=="Y" (
        call "%ROOT%\artifacts\desktop\BUILD.bat"
    )
) else (
    color 0A
    echo.
    echo  [PERFECT] Sab theek hai! BUILD.bat chal raha hai...
    echo.
    timeout /t 2 /nobreak >nul
    call "%ROOT%\artifacts\desktop\BUILD.bat"
)
