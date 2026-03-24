# SAI Rolotech Smart Engines — Official Install Script
# Usage (PowerShell as Admin): irm https://raw.githubusercontent.com/sairolotech-source/sai-rolotech-smart-engines/main/install.ps1 | iex

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  SAI Rolotech Smart Engines Installer   " -ForegroundColor Cyan
Write-Host "  Powered by SAI Rolotech Update API     " -ForegroundColor White
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Get latest version info from GitHub
Write-Host "Latest version check kar raha hun..." -ForegroundColor Yellow
try {
    $release = Invoke-RestMethod "https://api.github.com/repos/sairolotech-source/sai-rolotech-smart-engines/releases/latest" -EA Stop
    $tag = $release.tag_name
    $asset = $release.assets | Where-Object { $_.name -like "*Setup*.exe" -or ($_.name -like "*.exe" -and $_.name -notlike "*.blockmap") } | Select-Object -First 1
    $url = $asset.browser_download_url
    $sizeMB = [math]::Round($asset.size / 1MB)
    Write-Host "  Latest: $tag (~${sizeMB}MB)" -ForegroundColor Green
} catch {
    Write-Host "  GitHub API unavailable, using latest known version..." -ForegroundColor Yellow
    $tag = "v2.2.11"
    $url = "https://github.com/sairolotech-source/sai-rolotech-smart-engines/releases/download/v2.2.11/SAI-Rolotech-Smart-Engines-Setup-2.2.11.exe"
}

Write-Host ""

# Step 1: Kill old processes
Write-Host "[1/4] Purani app band kar raha hun..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.Name -like "*SAI*" -or $_.Name -like "*Sai*" } | Stop-Process -Force -EA SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "      Done." -ForegroundColor Green

# Step 2: Clean old installer files from Desktop
Write-Host "[2/4] Purane installer files Desktop se hata raha hun..." -ForegroundColor Yellow
Get-ChildItem "$env:USERPROFILE\Desktop" -Filter "SAI*.exe" -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue
Get-ChildItem "$env:USERPROFILE\Desktop" -Filter "SAI-*.exe" -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue
Write-Host "      Done." -ForegroundColor Green

# Step 3: Download latest installer
Write-Host "[3/4] $tag download ho raha hai..." -ForegroundColor Yellow
$installer = "$env:TEMP\SAI-Latest-$tag.exe"
Invoke-WebRequest $url -OutFile $installer -UseBasicParsing
Write-Host "      Download complete!" -ForegroundColor Green

# Step 4: Install
Write-Host "[4/4] Install ho raha hai..." -ForegroundColor Yellow
Start-Process $installer -Wait

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  $tag install ho gaya!                  " -ForegroundColor Green
Write-Host "  Desktop ke naye shortcut se kholen     " -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
