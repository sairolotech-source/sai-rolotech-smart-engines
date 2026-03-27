# SAI Rolotech Smart Engines — NUCLEAR CLEANUP + FRESH INSTALL
# Yeh script SAARI purani files, DLLs, cache, registry — sab kuch saaf karega
# Phir latest version fresh install karega — ffmpeg.dll error KABHI nahi aayega
#
# Usage (PowerShell as Admin):
#   Set-ExecutionPolicy Bypass -Scope Process -Force; irm https://raw.githubusercontent.com/adminsairolotech-bit/sai-rolotech-smart-engines/main/install.ps1 | iex

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  SAI Rolotech Smart Engines                                   " -ForegroundColor Cyan
Write-Host "  NUCLEAR CLEANUP + FRESH INSTALL                              " -ForegroundColor Cyan
Write-Host "  Saari purani files delete → Fresh v2.2.23 install            " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

$totalDeleted = 0
$totalErrors  = 0

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: GitHub se latest version check karo
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "[1/8] GitHub se latest version check kar raha hun..." -ForegroundColor Yellow
$ghRepo = "adminsairolotech-bit/sai-rolotech-smart-engines"
try {
    $release = Invoke-RestMethod "https://api.github.com/repos/$ghRepo/releases/latest" -EA Stop
    $tag     = $release.tag_name
    $asset   = $release.assets | Where-Object { $_.name -like "*Setup*.exe" } | Select-Object -First 1
    if (-not $asset) {
        $asset = $release.assets | Where-Object {
            $_.name -like "*.exe" -and $_.name -notlike "*.blockmap" -and $_.name -notlike "*Portable*"
        } | Select-Object -First 1
    }
    $downloadUrl = $asset.browser_download_url
    $sizeMB = [math]::Round($asset.size / 1MB)
    Write-Host "  Latest: $tag ($($asset.name), ~${sizeMB}MB)" -ForegroundColor Green
} catch {
    Write-Host "  GitHub se connect nahi hua — fallback v2.2.23" -ForegroundColor Yellow
    $tag = "v2.2.23"
    $downloadUrl = "https://github.com/$ghRepo/releases/download/v2.2.23/SAI-Rolotech-Smart-Engines-Setup-2.2.23.exe"
}
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: SAARE SAI processes KILL karo — koi bhi running na rahe
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "[2/8] SAI app ke SAARE processes band kar raha hun..." -ForegroundColor Yellow

$killPatterns = @(
    "SAI Rolotech*",
    "Sai Rolotech*",
    "SAI-Rolotech*",
    "SaiRolotech*",
    "sai rolotech*"
)

for ($pass = 1; $pass -le 3; $pass++) {
    foreach ($pattern in $killPatterns) {
        Get-Process -Name $pattern -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue
    }
    Get-Process | Where-Object {
        $_.MainWindowTitle -like "*SAI Rolotech*" -or
        $_.MainWindowTitle -like "*SAI Smart*" -or
        $_.MainWindowTitle -like "*sai rolotech*" -or
        ($_.Path -and $_.Path -like "*SAI Rolotech*")
    } | Stop-Process -Force -EA SilentlyContinue
    Start-Sleep -Milliseconds 500
}
Start-Sleep -Seconds 1
Write-Host "      Done — sab processes band!" -ForegroundColor Green
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: WINDOWS UNINSTALLER chalao (agar hai toh)
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "[3/8] Windows Uninstaller dhundh raha hun..." -ForegroundColor Yellow

$uninstallPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
)
$uninstalled = $false
foreach ($regPath in $uninstallPaths) {
    if (Test-Path $regPath) {
        Get-ChildItem $regPath -EA SilentlyContinue | ForEach-Object {
            $displayName = (Get-ItemProperty $_.PSPath -EA SilentlyContinue).DisplayName
            $uninstallStr = (Get-ItemProperty $_.PSPath -EA SilentlyContinue).UninstallString
            if ($displayName -and $displayName -like "*SAI Rolotech*" -and $uninstallStr) {
                Write-Host "  Uninstaller mila: $displayName" -ForegroundColor Cyan
                try {
                    if ($uninstallStr -like "*.exe*") {
                        $exePath = $uninstallStr -replace '"', ''
                        Start-Process $exePath -ArgumentList "/S" -Wait -NoNewWindow -EA SilentlyContinue
                        $uninstalled = $true
                        Write-Host "  Uninstall complete!" -ForegroundColor Green
                    }
                } catch {
                    Write-Host "  Uninstaller fail — manual cleanup karega" -ForegroundColor Yellow
                }
            }
        }
    }
}
if (-not $uninstalled) {
    Write-Host "      Koi uninstaller nahi mila — direct cleanup karega" -ForegroundColor Gray
}
Start-Sleep -Seconds 2
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4: SAARE FOLDERS DELETE — har jagah se (Nuclear Delete)
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "[4/8] SAARI purani folders system se delete kar raha hun..." -ForegroundColor Yellow

$foldersToNuke = @(
    "$env:LOCALAPPDATA\Programs\SAI Rolotech Smart Engines",
    "$env:LOCALAPPDATA\Programs\Sai Rolotech Smart Engines",
    "$env:LOCALAPPDATA\Programs\SAI Sai Rolotech Smart Engines AI",
    "$env:LOCALAPPDATA\Programs\SaiRolotech-SmartEngines",
    "$env:LOCALAPPDATA\Programs\SAI-Rolotech-Smart-Engines",
    "$env:LOCALAPPDATA\Programs\sai-rolotech-smart-engines",

    "$env:ProgramFiles\SAI Rolotech Smart Engines",
    "$env:ProgramFiles\Sai Rolotech Smart Engines",
    "$env:ProgramFiles\SAI Sai Rolotech Smart Engines AI",
    "${env:ProgramFiles(x86)}\SAI Rolotech Smart Engines",
    "${env:ProgramFiles(x86)}\Sai Rolotech Smart Engines",
    "${env:ProgramFiles(x86)}\SAI Sai Rolotech Smart Engines AI",

    "$env:APPDATA\SAI Rolotech Smart Engines",
    "$env:APPDATA\Sai Rolotech Smart Engines",
    "$env:APPDATA\SaiRolotech-SmartEngines",
    "$env:APPDATA\sai-rolotech-smart-engines",
    "$env:APPDATA\SAI-Rolotech-Smart-Engines",

    "$env:LOCALAPPDATA\SAI Rolotech Smart Engines",
    "$env:LOCALAPPDATA\Sai Rolotech Smart Engines",
    "$env:LOCALAPPDATA\sai-rolotech-smart-engines",
    "$env:LOCALAPPDATA\SAI-Rolotech-Smart-Engines",

    "$env:LOCALAPPDATA\sai-rolotech-smart-engines-updater",
    "$env:LOCALAPPDATA\SAI Rolotech Smart Engines-updater",

    "$env:USERPROFILE\Desktop\SAI Rolotech Smart Engines",
    "$env:PUBLIC\Desktop\SAI Rolotech Smart Engines",

    "$env:LOCALAPPDATA\Temp\sai-rolotech-diag"
)

$folderCount = 0
foreach ($folder in $foldersToNuke) {
    if (Test-Path $folder) {
        Write-Host "  DELETE: $folder" -ForegroundColor Red
        Remove-Item -Path $folder -Recurse -Force -EA SilentlyContinue
        if (Test-Path $folder) {
            Start-Sleep -Milliseconds 500
            cmd /c "rmdir /s /q `"$folder`"" 2>$null
        }
        $folderCount++
        $totalDeleted++
    }
}

$searchDrives = @("C:\", "D:\", "E:\")
foreach ($drive in $searchDrives) {
    if (Test-Path $drive) {
        Get-ChildItem $drive -Directory -Recurse -Depth 4 -Filter "*SAI Rolotech*" -EA SilentlyContinue |
        Where-Object { $_.FullName -notlike "*Recycle*" -and $_.FullName -notlike "*Windows\Installer*" } |
        ForEach-Object {
            Write-Host "  FOUND & DELETE: $($_.FullName)" -ForegroundColor Red
            Remove-Item $_.FullName -Recurse -Force -EA SilentlyContinue
            $folderCount++
            $totalDeleted++
        }
    }
}

if ($folderCount -eq 0) {
    Write-Host "      Koi purana folder nahi mila (already clean!)" -ForegroundColor Gray
} else {
    Write-Host "      $folderCount folder(s) delete kiye!" -ForegroundColor Green
}
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5: ORPHAN DLL FILES dhundh ke delete karo (ffmpeg.dll fix)
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "[5/8] Orphan DLL files dhundh raha hun (ffmpeg.dll fix)..." -ForegroundColor Yellow

$orphanDlls = @(
    "ffmpeg.dll", "libEGL.dll", "libGLESv2.dll",
    "d3dcompiler_47.dll", "vk_swiftshader.dll", "vulkan-1.dll",
    "vk_swiftshader_icd.json"
)

$dllSearchPaths = @(
    "$env:LOCALAPPDATA\Programs",
    "$env:ProgramFiles",
    "${env:ProgramFiles(x86)}",
    "$env:USERPROFILE\Desktop",
    "$env:USERPROFILE\Downloads",
    "$env:APPDATA",
    "$env:LOCALAPPDATA"
)

$dllCount = 0
foreach ($searchPath in $dllSearchPaths) {
    if (Test-Path $searchPath) {
        foreach ($dllName in $orphanDlls) {
            Get-ChildItem $searchPath -Filter $dllName -Recurse -Depth 5 -EA SilentlyContinue |
            Where-Object { $_.DirectoryName -like "*SAI*" -or $_.DirectoryName -like "*sai*" -or $_.DirectoryName -like "*Electron*" } |
            ForEach-Object {
                Write-Host "  DELETE DLL: $($_.FullName)" -ForegroundColor Red
                Remove-Item $_.FullName -Force -EA SilentlyContinue
                $dllCount++
                $totalDeleted++
            }
        }
    }
}

$strayExePaths = @("$env:USERPROFILE\Desktop", "$env:USERPROFILE\Downloads", "$env:TEMP")
foreach ($sp in $strayExePaths) {
    if (Test-Path $sp) {
        Get-ChildItem $sp -Filter "SAI-Rolotech*.exe" -EA SilentlyContinue | ForEach-Object {
            Write-Host "  DELETE EXE: $($_.FullName)" -ForegroundColor Red
            Remove-Item $_.FullName -Force -EA SilentlyContinue
            $totalDeleted++
        }
        Get-ChildItem $sp -Filter "SAI-Setup*.exe" -EA SilentlyContinue | ForEach-Object {
            Write-Host "  DELETE EXE: $($_.FullName)" -ForegroundColor Red
            Remove-Item $_.FullName -Force -EA SilentlyContinue
            $totalDeleted++
        }
        Get-ChildItem $sp -Filter "sai rolotech*" -EA SilentlyContinue | ForEach-Object {
            Write-Host "  DELETE: $($_.FullName)" -ForegroundColor Red
            Remove-Item $_.FullName -Force -EA SilentlyContinue
            $totalDeleted++
        }
    }
}

if ($dllCount -eq 0) {
    Write-Host "      Koi orphan DLL nahi mili (clean!)" -ForegroundColor Gray
} else {
    Write-Host "      $dllCount orphan DLL(s) delete ki!" -ForegroundColor Green
}
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 6: REGISTRY + SHORTCUTS + CACHE — sab saaf karo
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "[6/8] Registry, shortcuts, cache saaf kar raha hun..." -ForegroundColor Yellow

$regKeys = @(
    "HKCU:\Software\SAI Rolotech Smart Engines",
    "HKCU:\Software\Sai Rolotech Smart Engines",
    "HKCU:\Software\SAI Sai Rolotech Smart Engines AI",
    "HKCU:\Software\sai-rolotech-smart-engines",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Rolotech Smart Engines",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\sai-rolotech-smart-engines",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{SAI-ROLOTECH}",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\SAI Rolotech Smart Engines",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Sai Rolotech Smart Engines",
    "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\SAI Rolotech Smart Engines"
)
$regCount = 0
foreach ($key in $regKeys) {
    if (Test-Path $key) {
        Remove-Item -Path $key -Recurse -Force -EA SilentlyContinue
        $regCount++
    }
}
Write-Host "      $regCount registry key(s) delete kiye" -ForegroundColor Gray

$desktopPaths = @("$env:USERPROFILE\Desktop", "$env:PUBLIC\Desktop")
foreach ($dp in $desktopPaths) {
    Remove-Item "$dp\SAI Rolotech Smart Engines.lnk" -Force -EA SilentlyContinue
    Remove-Item "$dp\Sai Rolotech Smart Engines.lnk" -Force -EA SilentlyContinue
    Remove-Item "$dp\SAI-Rolotech*.lnk"              -Force -EA SilentlyContinue
    Remove-Item "$dp\sai rolotech*.lnk"              -Force -EA SilentlyContinue
}

$startMenuPaths = @(
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\SAI Rolotech Smart Engines",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Sai Rolotech Smart Engines",
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\SAI Rolotech Smart Engines"
)
foreach ($sm in $startMenuPaths) {
    if (Test-Path $sm) { Remove-Item $sm -Recurse -Force -EA SilentlyContinue }
}

Get-ChildItem "$env:TEMP" -Filter "SAI*" -EA SilentlyContinue | Remove-Item -Recurse -Force -EA SilentlyContinue
Get-ChildItem "$env:TEMP" -Filter "nsis*" -EA SilentlyContinue | Remove-Item -Recurse -Force -EA SilentlyContinue
Get-ChildItem "$env:TEMP" -Filter "*electron*" -EA SilentlyContinue |
    Where-Object { $_.Name -like "*sai*" -or $_.Name -like "*rolotech*" } |
    Remove-Item -Recurse -Force -EA SilentlyContinue

$cachePaths = @(
    "$env:LOCALAPPDATA\electron-updater",
    "$env:LOCALAPPDATA\electron-builder",
    "$env:APPDATA\SAI Rolotech Smart Engines\Cache",
    "$env:APPDATA\SAI Rolotech Smart Engines\Code Cache",
    "$env:APPDATA\SAI Rolotech Smart Engines\GPUCache"
)
foreach ($cp in $cachePaths) {
    if (Test-Path $cp) { Remove-Item $cp -Recurse -Force -EA SilentlyContinue }
}

Write-Host "      Done — registry, shortcuts, cache sab saaf!" -ForegroundColor Green
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 7: FRESH DOWNLOAD — Latest version GitHub se
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "[7/8] $tag FRESH download ho raha hai..." -ForegroundColor Yellow
$installer = "$env:TEMP\SAI-Fresh-Setup-$tag.exe"

if (Test-Path $installer) { Remove-Item $installer -Force -EA SilentlyContinue }

try {
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest $downloadUrl -OutFile $installer -UseBasicParsing -EA Stop
    $ProgressPreference = 'Continue'
    $fileSize = [math]::Round((Get-Item $installer).Length / 1MB)
    Write-Host "      Download complete! (${fileSize}MB)" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Download fail hua — internet check karo." -ForegroundColor Red
    Write-Host "  URL: $downloadUrl" -ForegroundColor Gray
    exit 1
}

if ((Get-Item $installer).Length -lt 10MB) {
    Write-Host "  ERROR: File bahut chhoti hai — download corrupt lag raha hai" -ForegroundColor Red
    Remove-Item $installer -Force -EA SilentlyContinue
    exit 1
}
Write-Host ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 8: FRESH INSTALL + VERIFY (ffmpeg.dll check included)
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host "[8/8] FRESH INSTALL ho raha hai..." -ForegroundColor Yellow
Start-Process $installer -ArgumentList "/S" -Wait -NoNewWindow
Start-Sleep -Seconds 5

Remove-Item $installer -Force -EA SilentlyContinue

$installDir = "$env:LOCALAPPDATA\Programs\SAI Rolotech Smart Engines"
$exePath    = "$installDir\SAI Rolotech Smart Engines.exe"

if (Test-Path $exePath) {
    Write-Host "      App installed: $exePath" -ForegroundColor Green

    $criticalDlls = @("ffmpeg.dll", "libEGL.dll", "libGLESv2.dll", "d3dcompiler_47.dll")
    $allDllsOk = $true
    foreach ($dll in $criticalDlls) {
        $dllPath = "$installDir\$dll"
        if (Test-Path $dllPath) {
            $dllSize = [math]::Round((Get-Item $dllPath).Length / 1MB, 1)
            Write-Host "      $dll — OK (${dllSize}MB)" -ForegroundColor Green
        } else {
            Write-Host "      $dll — MISSING!" -ForegroundColor Red
            $allDllsOk = $false
        }
    }

    if (-not $allDllsOk) {
        Write-Host ""
        Write-Host "  WARNING: Kuch DLL files missing hain!" -ForegroundColor Red
        Write-Host "  Antivirus ne block kiya ho sakta hai." -ForegroundColor Yellow
        Write-Host "  Windows Defender mein exclusion add karo:" -ForegroundColor Yellow
        Write-Host "    Settings → Privacy & Security → Virus Protection → Exclusions" -ForegroundColor Cyan
        Write-Host "    Add folder: $installDir" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Phir yeh script dobara chalao." -ForegroundColor Yellow

        try {
            Add-MpPreference -ExclusionPath $installDir -EA SilentlyContinue
            Write-Host "  [AUTO] Windows Defender exclusion add kiya: $installDir" -ForegroundColor Green
        } catch {
            Write-Host "  [INFO] Defender exclusion manually add karna padega" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "      App install nahi hui — installer check karo" -ForegroundColor Red
    $totalErrors++
}

$shortcut = "$env:USERPROFILE\Desktop\SAI Rolotech Smart Engines.lnk"
if (-not (Test-Path $shortcut)) {
    if (Test-Path $exePath) {
        $wsh = New-Object -ComObject WScript.Shell
        $lnk = $wsh.CreateShortcut($shortcut)
        $lnk.TargetPath       = $exePath
        $lnk.WorkingDirectory = $installDir
        $lnk.Description      = "SAI Rolotech Smart Engines — Roll Forming Engineering Suite"
        if (Test-Path "$installDir\resources\assets\icon.ico") {
            $lnk.IconLocation = "$installDir\resources\assets\icon.ico"
        }
        $lnk.Save()
        Write-Host "      Desktop shortcut banaya!" -ForegroundColor Green
    }
} else {
    Write-Host "      Desktop shortcut already hai!" -ForegroundColor Green
}

# ═══════════════════════════════════════════════════════════════════════════════
# FINAL REPORT
# ═══════════════════════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host "  NUCLEAR CLEANUP + FRESH INSTALL COMPLETE!                    " -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Version    : $tag" -ForegroundColor White
Write-Host "  Location   : $installDir" -ForegroundColor White
Write-Host "  Deleted    : $totalDeleted items" -ForegroundColor White
if ($totalErrors -gt 0) {
    Write-Host "  Errors     : $totalErrors (upar dekho)" -ForegroundColor Red
} else {
    Write-Host "  Errors     : 0 (sab clean!)" -ForegroundColor Green
}
Write-Host ""
Write-Host "  Desktop pe 'SAI Rolotech Smart Engines' shortcut pe" -ForegroundColor Cyan
Write-Host "  DOUBLE-CLICK karo — app shuru ho jayegi!" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Agar ffmpeg.dll error aaye toh Windows Defender mein" -ForegroundColor Yellow
Write-Host "  exclusion add karo (script ne try kiya hai)" -ForegroundColor Yellow
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
