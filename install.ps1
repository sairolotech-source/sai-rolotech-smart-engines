# SAI Rolotech Smart Engines — Auto Install Script
# Usage (PowerShell as Admin): irm https://raw.githubusercontent.com/sairolotech-source/sai-rolotech-smart-engines/main/install.ps1 | iex
# Git Bash usage: powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/sairolotech-source/sai-rolotech-smart-engines/main/install.ps1 | iex"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  SAI Rolotech Smart Engines             " -ForegroundColor Cyan
Write-Host "  Auto Download + Auto Install           " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Get latest release from GitHub ──────────────────────────────────
Write-Host "[1/5] Latest version check kar raha hun..." -ForegroundColor Yellow
try {
    $release = Invoke-RestMethod "https://api.github.com/repos/sairolotech-source/sai-rolotech-smart-engines/releases/latest" -EA Stop
    $tag     = $release.tag_name
    $asset   = $release.assets | Where-Object { $_.name -like "*Setup*.exe" } | Select-Object -First 1
    if (-not $asset) {
        $asset = $release.assets | Where-Object {
            $_.name -like "*.exe" -and
            $_.name -notlike "*.blockmap" -and
            $_.name -notlike "*Portable*"
        } | Select-Object -First 1
    }
    $url    = $asset.browser_download_url
    $sizeMB = [math]::Round($asset.size / 1MB)
    Write-Host "  Latest: $($asset.name) (~${sizeMB}MB)" -ForegroundColor Green
} catch {
    Write-Host "  Fallback version use kar raha hun..." -ForegroundColor Yellow
    $tag = "v2.2.13"
    $url = "https://github.com/sairolotech-source/sai-rolotech-smart-engines/releases/download/v2.2.13/SAI-Rolotech-Smart-Engines-Setup-2.2.13.exe"
}
Write-Host ""

# ── Step 2: Kill running SAI app instances ───────────────────────────────────
Write-Host "[2/5] Purani SAI app band kar raha hun..." -ForegroundColor Yellow
$exactNames = @(
    "SAI Rolotech Smart Engines",
    "Sai Rolotech Smart Engines",
    "SaiRolotech-SmartEngines",
    "SAI-Rolotech-Smart-Engines"
)
foreach ($name in $exactNames) {
    Get-Process -Name $name -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue
}
Get-Process | Where-Object { $_.MainWindowTitle -like "*SAI Rolotech*" } | Stop-Process -Force -EA SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "      Done." -ForegroundColor Green

# ── Step 3: Remove ALL old installer files (Desktop + Temp) ──────────────────
Write-Host "[3/5] Purane installer files hata raha hun..." -ForegroundColor Yellow

# Desktop cleanup
Get-ChildItem "$env:USERPROFILE\Desktop" -Filter "SAI-Rolotech*.exe" -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue
Get-ChildItem "$env:USERPROFILE\Desktop" -Filter "SAI-Update*.exe"   -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue
Get-ChildItem "$env:USERPROFILE\Desktop" -Filter "SAI-2.*.exe"       -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue

# Temp folder cleanup (previous downloads)
Get-ChildItem "$env:TEMP" -Filter "SAI-Setup-*.exe" -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue

# Downloads folder cleanup
Get-ChildItem "$env:USERPROFILE\Downloads" -Filter "SAI-Rolotech*.exe" -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue

Write-Host "      Done — sab purane files saaf!" -ForegroundColor Green

# ── Step 4: Auto-Download Setup installer ────────────────────────────────────
Write-Host "[4/5] $tag auto-download ho raha hai..." -ForegroundColor Yellow
$installer = "$env:TEMP\SAI-Setup-$tag.exe"
try {
    Invoke-WebRequest $url -OutFile $installer -UseBasicParsing
    Write-Host "      Download complete!" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Download fail hua — internet check karo." -ForegroundColor Red
    exit 1
}

# ── Step 5: Auto-Install silently (no popup, no click needed) ────────────────
Write-Host "[5/5] Auto-Install ho raha hai (koi popup nahi)..." -ForegroundColor Yellow
Start-Process $installer -ArgumentList "/S" -Wait -NoNewWindow
Start-Sleep -Seconds 2

# Cleanup installer file after install
Remove-Item $installer -Force -EA SilentlyContinue

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  $tag INSTALL HO GAYA!               " -ForegroundColor Green
Write-Host "  Desktop shortcut pe double-click karo  " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
