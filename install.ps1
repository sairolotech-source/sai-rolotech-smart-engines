# SAI Rolotech Smart Engines — Complete Cleanup + Auto Install Script
# Usage (PowerShell as Admin):
#   Set-ExecutionPolicy Bypass -Scope Process -Force; irm https://raw.githubusercontent.com/adminsairolotech-bit/sai-rolotech-smart-engines/main/install.ps1 | iex

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  SAI Rolotech Smart Engines                " -ForegroundColor Cyan
Write-Host "  Cleanup + Auto Download + Auto Install    " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Get latest release from GitHub ───────────────────────────────────
Write-Host "[1/6] Latest version check kar raha hun..." -ForegroundColor Yellow
try {
    $release = Invoke-RestMethod "https://api.github.com/repos/adminsairolotech-bit/sai-rolotech-smart-engines/releases/latest" -EA Stop
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
    Write-Host "  Fallback: v2.2.14 use kar raha hun..." -ForegroundColor Yellow
    $tag = "v2.2.14"
    $url = "https://github.com/adminsairolotech-bit/sai-rolotech-smart-engines/releases/download/v2.2.14/SAI-Rolotech-Smart-Engines-Setup-2.2.14.exe"
}
Write-Host ""

# ── Step 2: Kill ALL running SAI processes ───────────────────────────────────
Write-Host "[2/6] SAI app ke SAARE processes band kar raha hun..." -ForegroundColor Yellow
$killNames = @(
    "SAI Rolotech Smart Engines",
    "Sai Rolotech Smart Engines",
    "SaiRolotech-SmartEngines",
    "SAI-Rolotech-Smart-Engines",
    "electron"
)
foreach ($name in $killNames) {
    Get-Process -Name $name -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue
}
Get-Process | Where-Object { $_.MainWindowTitle -like "*SAI Rolotech*" -or $_.MainWindowTitle -like "*SAI Smart*" } |
    Stop-Process -Force -EA SilentlyContinue
Start-Sleep -Seconds 1

# Second kill pass
foreach ($name in $killNames) {
    Get-Process -Name $name -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue
}
Start-Sleep -Seconds 2
Write-Host "      Done — sab processes band!" -ForegroundColor Green

# ── Step 3: Delete ALL duplicate folders from Windows ────────────────────────
Write-Host "[3/6] Windows se SAARE duplicate folders delete kar raha hun..." -ForegroundColor Yellow

$foldersToDelete = @(
    # AppData\Local\Programs (primary install location)
    "$env:LOCALAPPDATA\Programs\SAI Rolotech Smart Engines",
    "$env:LOCALAPPDATA\Programs\Sai Rolotech Smart Engines",
    "$env:LOCALAPPDATA\Programs\SAI Sai Rolotech Smart Engines AI",
    "$env:LOCALAPPDATA\Programs\SaiRolotech-SmartEngines",
    "$env:LOCALAPPDATA\Programs\SAI-Rolotech-Smart-Engines",

    # Program Files (old versions)
    "$env:ProgramFiles\SAI Rolotech Smart Engines",
    "$env:ProgramFiles\Sai Rolotech Smart Engines",
    "$env:ProgramFiles\SAI Sai Rolotech Smart Engines AI",
    "${env:ProgramFiles(x86)}\SAI Rolotech Smart Engines",
    "${env:ProgramFiles(x86)}\Sai Rolotech Smart Engines",
    "${env:ProgramFiles(x86)}\SAI Sai Rolotech Smart Engines AI",

    # AppData\Roaming
    "$env:APPDATA\SAI Rolotech Smart Engines",
    "$env:APPDATA\Sai Rolotech Smart Engines",
    "$env:APPDATA\SaiRolotech-SmartEngines",

    # AppData\Local (non-Programs)
    "$env:LOCALAPPDATA\SAI Rolotech Smart Engines",
    "$env:LOCALAPPDATA\Sai Rolotech Smart Engines",

    # Desktop leftover folders (if any)
    "$env:USERPROFILE\Desktop\SAI Rolotech Smart Engines",
    "$env:PUBLIC\Desktop\SAI Rolotech Smart Engines"
)

$deleted = 0
foreach ($folder in $foldersToDelete) {
    if (Test-Path $folder) {
        Write-Host "  DELETE: $folder" -ForegroundColor Red
        Remove-Item -Path $folder -Recurse -Force -EA SilentlyContinue
        $deleted++
    }
}

if ($deleted -eq 0) {
    Write-Host "      Koi duplicate folder nahi mila (clean!)." -ForegroundColor Gray
} else {
    Write-Host "      $deleted duplicate folder(s) delete kiye!" -ForegroundColor Green
}

# ── Step 4: Remove old registry + shortcuts + installer files ─────────────────
Write-Host "[4/6] Registry, shortcuts aur purane files saaf kar raha hun..." -ForegroundColor Yellow

# Registry cleanup
$regKeys = @(
    "HKCU:\Software\SAI Rolotech Smart Engines",
    "HKCU:\Software\Sai Rolotech Smart Engines",
    "HKCU:\Software\SAI Sai Rolotech Smart Engines AI",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Rolotech Smart Engines",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Rolotech Smart Engines",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines"
)
foreach ($key in $regKeys) {
    Remove-Item -Path $key -Recurse -Force -EA SilentlyContinue
}

# Desktop shortcuts cleanup
$desktopPaths = @($env:USERPROFILE + "\Desktop", $env:PUBLIC + "\Desktop")
foreach ($dp in $desktopPaths) {
    Remove-Item "$dp\SAI Rolotech Smart Engines.lnk"   -Force -EA SilentlyContinue
    Remove-Item "$dp\Sai Rolotech Smart Engines.lnk"   -Force -EA SilentlyContinue
    Remove-Item "$dp\SAI-Rolotech*.exe"                -Force -EA SilentlyContinue
}

# Start Menu cleanup
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\SAI Rolotech Smart Engines" -Recurse -Force -EA SilentlyContinue
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Sai Rolotech Smart Engines" -Recurse -Force -EA SilentlyContinue

# Temp + Downloads installer files
Get-ChildItem "$env:TEMP"                    -Filter "SAI-Setup-*.exe"     -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue
Get-ChildItem "$env:TEMP"                    -Filter "SAI-Rolotech*.exe"   -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue
Get-ChildItem "$env:USERPROFILE\Downloads"   -Filter "SAI-Rolotech*.exe"   -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue
Get-ChildItem "$env:USERPROFILE\Desktop"     -Filter "SAI-Rolotech*.exe"   -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue

Write-Host "      Done — pura system saaf!" -ForegroundColor Green

# ── Step 5: Auto-Download fresh installer ────────────────────────────────────
Write-Host "[5/6] $tag fresh installer download ho raha hai..." -ForegroundColor Yellow
$installer = "$env:TEMP\SAI-Setup-$tag.exe"
try {
    Invoke-WebRequest $url -OutFile $installer -UseBasicParsing
    Write-Host "      Download complete!" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Download fail hua — internet check karo." -ForegroundColor Red
    exit 1
}

# ── Step 6: Auto-Install silently + Desktop Shortcut guarantee ───────────────
Write-Host "[6/6] Auto-Install ho raha hai + Desktop shortcut ban raha hai..." -ForegroundColor Yellow
Start-Process $installer -ArgumentList "/S" -Wait -NoNewWindow
Start-Sleep -Seconds 3

# Cleanup installer
Remove-Item $installer -Force -EA SilentlyContinue

# Verify Desktop shortcut was created
$shortcut = "$env:USERPROFILE\Desktop\SAI Rolotech Smart Engines.lnk"
if (-not (Test-Path $shortcut)) {
    # Manually create shortcut if installer missed it
    $installDir = "$env:LOCALAPPDATA\Programs\SAI Rolotech Smart Engines"
    $exePath    = "$installDir\SAI Rolotech Smart Engines.exe"
    if (Test-Path $exePath) {
        $wsh = New-Object -ComObject WScript.Shell
        $lnk = $wsh.CreateShortcut($shortcut)
        $lnk.TargetPath       = $exePath
        $lnk.WorkingDirectory = $installDir
        $lnk.Description      = "SAI Rolotech Smart Engines"
        $lnk.Save()
        Write-Host "      Desktop shortcut manually banaya!" -ForegroundColor Green
    }
} else {
    Write-Host "      Desktop shortcut confirm hai!" -ForegroundColor Green
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  $tag INSTALL HO GAYA!                  " -ForegroundColor Green
Write-Host "  Desktop pe 'SAI Rolotech Smart Engines' " -ForegroundColor Green
Write-Host "  shortcut pe double-click karo            " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
