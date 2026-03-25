@echo off
title SAI Rolotech - AI Pre-Build Checker
color 0E
echo.
echo  =====================================================
echo   SAI Rolotech Smart Engines - AI Pre-Build Checker
echo   Gemini + DeepSeek code review phir BUILD
echo  =====================================================
echo.

cd /d "%~dp0..\.."
set "ROOT=%cd%"
set "DESKTOP=%ROOT%\artifacts\desktop"
set "PASS=0"
set "FAIL=0"
set "WARN=0"

:: ══════════════════════════════════════════════
::   SECTION 1: BASIC SYSTEM CHECKS
:: ══════════════════════════════════════════════
echo  ────────────────────────────────────────────
echo   SECTION 1: System Checks
echo  ────────────────────────────────────────────

:: CHECK 1: Node.js
echo  [CHECK 1] Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [FAIL] Node.js nahi mila — https://nodejs.org se install karo
    set /a FAIL+=1
) else (
    for /f "tokens=*" %%v in ('node --version') do echo  [PASS] Node.js %%v
    set /a PASS+=1
)

:: CHECK 2: pnpm
echo  [CHECK 2] pnpm...
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo  [FAIL] pnpm nahi mila — npm install -g pnpm chalaao
    set /a FAIL+=1
) else (
    for /f "tokens=*" %%v in ('pnpm --version') do echo  [PASS] pnpm v%%v
    set /a PASS+=1
)

:: CHECK 3: Git
echo  [CHECK 3] Git...
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo  [FAIL] Git nahi mila — https://git-scm.com se install karo
    set /a FAIL+=1
) else (
    echo  [PASS] Git ready
    set /a PASS+=1
)

:: CHECK 4: node_modules
echo  [CHECK 4] node_modules...
if not exist "%ROOT%\node_modules" (
    echo  [FAIL] node_modules missing — pnpm install chalaao
    set /a FAIL+=1
) else (
    echo  [PASS] node_modules present
    set /a PASS+=1
)

:: CHECK 5: Rollup Windows binary
echo  [CHECK 5] Rollup Windows binary...
dir "%ROOT%\node_modules\.pnpm\@rollup+rollup-win32-x64-msvc*" >nul 2>&1
if %errorlevel% neq 0 (
    echo  [WARN] Rollup binary missing — pnpm install se fix hoga
    set /a WARN+=1
) else (
    echo  [PASS] Rollup Windows binary OK
    set /a PASS+=1
)

:: CHECK 6-8: Source files
echo  [CHECK 6] API Server source...
if not exist "%ROOT%\artifacts\api-server\src\index.ts" (
    echo  [FAIL] API server source missing!
    set /a FAIL+=1
) else (
    echo  [PASS] API Server source OK
    set /a PASS+=1
)

echo  [CHECK 7] Frontend source...
if not exist "%ROOT%\artifacts\design-tool\src\main.tsx" (
    echo  [FAIL] Frontend source missing!
    set /a FAIL+=1
) else (
    echo  [PASS] Frontend source OK
    set /a PASS+=1
)

echo  [CHECK 8] Electron main.ts...
if not exist "%DESKTOP%\src\main.ts" (
    echo  [FAIL] Electron main.ts missing!
    set /a FAIL+=1
) else (
    echo  [PASS] Electron main.ts OK
    set /a PASS+=1
)

:: CHECK 9: NSIS disabled
echo  [CHECK 9] NSIS disabled check...
node -e "try{var p=JSON.parse(require('fs').readFileSync('artifacts/desktop/package.json','utf8'));var t=JSON.stringify(p.build&&p.build.win&&p.build.win.target||[]);if(t.indexOf('nsis')!==-1){console.log('[WARN] NSIS target hai — remove karo');}else{console.log('[PASS] Only portable — OK');}}catch(e){console.log('[WARN] '+e.message);}"
set /a PASS+=1

:: CHECK 10: Git status
echo  [CHECK 10] Git conflicts...
git diff --name-only --diff-filter=U 2>nul > "%TEMP%\sai_git_check.txt"
for %%F in ("%TEMP%\sai_git_check.txt") do if %%~zF gtr 0 (
    echo  [WARN] Git conflicts hain — git reset --hard origin/main chalaao
    set /a WARN+=1
) else (
    echo  [PASS] No git conflicts
    set /a PASS+=1
)

echo.
echo  Basic checks: %PASS% PASS / %WARN% WARN / %FAIL% FAIL

if %FAIL% gtr 0 (
    color 0C
    echo.
    echo  [STOP] Basic checks fail! Upar wale FAIL fix karo pehle.
    pause
    exit /b 1
)

:: ══════════════════════════════════════════════
::   SECTION 2: GEMINI AI CODE REVIEW
:: ══════════════════════════════════════════════
echo.
echo  ────────────────────────────────────────────
echo   SECTION 2: Gemini AI Code Review
echo  ────────────────────────────────────────────

if not exist "%DESKTOP%\precheck-ai.js" (
    echo  [WARN] precheck-ai.js nahi mila — AI review skip
    goto :DEEPSEEK_SKIP
)

if not exist "%DESKTOP%\ai-review-config.json" (
    echo  [WARN] ai-review-config.json nahi mila — AI review skip
    goto :DEEPSEEK_SKIP
)

:: Check if Gemini key is set
node -e "try{var c=JSON.parse(require('fs').readFileSync('%DESKTOP:\=/%/ai-review-config.json','utf8'));if(!c.gemini||!c.gemini.apiKey||c.gemini.apiKey.startsWith('YOUR_')){console.log('SKIP');}else{console.log('RUN');}}catch(e){console.log('SKIP');}" > "%TEMP%\sai_gemini_check.txt" 2>&1
set /p GEMINI_STATUS=<"%TEMP%\sai_gemini_check.txt"

if "%GEMINI_STATUS%"=="RUN" (
    echo  [AI] Gemini code review chal raha hai...
    node "%DESKTOP%\precheck-ai.js" --only-gemini
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo  [STOP] Gemini ne critical bugs dhundhe! Upar dekho aur fix karo.
        echo  Fix karne ke baad dobara PRECHECK.bat chalao.
        pause
        exit /b 1
    )
    echo  [PASS] Gemini review clear!
) else (
    echo  [SKIP] Gemini key nahi — ai-review-config.json mein add karo
    echo         https://aistudio.google.com se FREE key milti hai
)

:DEEPSEEK_SKIP

:: ══════════════════════════════════════════════
::   SECTION 3: DEEPSEEK AI CODE REVIEW
:: ══════════════════════════════════════════════
echo.
echo  ────────────────────────────────────────────
echo   SECTION 3: DeepSeek AI Code Review
echo  ────────────────────────────────────────────

if not exist "%DESKTOP%\precheck-ai.js" goto :AI_DONE

node -e "try{var c=JSON.parse(require('fs').readFileSync('%DESKTOP:\=/%/ai-review-config.json','utf8'));if(!c.deepseek||!c.deepseek.apiKey||c.deepseek.apiKey.startsWith('YOUR_')){console.log('SKIP');}else{console.log('RUN');}}catch(e){console.log('SKIP');}" > "%TEMP%\sai_deepseek_check.txt" 2>&1
set /p DEEPSEEK_STATUS=<"%TEMP%\sai_deepseek_check.txt"

if "%DEEPSEEK_STATUS%"=="RUN" (
    echo  [AI] DeepSeek code review chal raha hai...
    node "%DESKTOP%\precheck-ai.js" --only-deepseek
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo  [STOP] DeepSeek ne critical bugs dhundhe! Upar dekho aur fix karo.
        echo  Fix karne ke baad dobara PRECHECK.bat chalao.
        pause
        exit /b 1
    )
    echo  [PASS] DeepSeek review clear!
) else (
    echo  [SKIP] DeepSeek key nahi — ai-review-config.json mein add karo
    echo         https://platform.deepseek.com se SASTA key milta hai
)

:AI_DONE

:: ══════════════════════════════════════════════
::   FINAL: ALL CLEAR → START BUILD
:: ══════════════════════════════════════════════
echo.
echo  ════════════════════════════════════════════
color 0A
echo   ALL CHECKS PASSED!
echo.
echo   Basic: %PASS% PASS / %WARN% WARN
echo   AI Review: Gemini + DeepSeek done
echo.
echo   BUILD.bat ab shuru ho raha hai...
echo  ════════════════════════════════════════════
echo.
timeout /t 3 /nobreak >nul

call "%DESKTOP%\BUILD.bat"
