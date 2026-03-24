#!/bin/bash
# SAI Rolotech Smart Engines — Git Bash Auto Install Script
# Usage from Git Bash: curl -sSL https://raw.githubusercontent.com/sairolotech-source/sai-rolotech-smart-engines/main/install.sh | bash

echo ""
echo "========================================="
echo "  SAI Rolotech Smart Engines"
echo "  Auto Download + Auto Install (Git Bash)"
echo "========================================="
echo ""

# ── Step 1: Get latest release URL ──────────────────────────────────────────
echo "[1/5] Latest version check kar raha hun..."
RELEASE_JSON=$(curl -sSL "https://api.github.com/repos/sairolotech-source/sai-rolotech-smart-engines/releases/latest" 2>/dev/null)

if [ -z "$RELEASE_JSON" ]; then
    echo "  Fallback: v2.2.13 use kar raha hun..."
    TAG="v2.2.13"
    DOWNLOAD_URL="https://github.com/sairolotech-source/sai-rolotech-smart-engines/releases/download/v2.2.13/SAI-Rolotech-Smart-Engines-Setup-2.2.13.exe"
else
    TAG=$(echo "$RELEASE_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tag_name','v2.2.13'))" 2>/dev/null || echo "v2.2.13")
    DOWNLOAD_URL=$(echo "$RELEASE_JSON" | python3 -c "
import sys,json
d=json.load(sys.stdin)
assets = d.get('assets',[])
for a in assets:
    if 'Setup' in a['name'] and a['name'].endswith('.exe'):
        print(a['browser_download_url'])
        break
" 2>/dev/null)
fi

if [ -z "$DOWNLOAD_URL" ]; then
    DOWNLOAD_URL="https://github.com/sairolotech-source/sai-rolotech-smart-engines/releases/download/${TAG}/SAI-Rolotech-Smart-Engines-Setup-${TAG#v}.exe"
fi

echo "  Latest: $TAG"
echo ""

# ── Step 2: Kill running SAI app instances ───────────────────────────────────
echo "[2/5] Purani SAI app band kar raha hun..."
powershell.exe -Command "
\$names = @('SAI Rolotech Smart Engines','Sai Rolotech Smart Engines','SaiRolotech-SmartEngines','SAI-Rolotech-Smart-Engines')
foreach (\$n in \$names) { Get-Process -Name \$n -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue }
Get-Process | Where-Object { \$_.MainWindowTitle -like '*SAI Rolotech*' } | Stop-Process -Force -EA SilentlyContinue
Start-Sleep 2
" 2>/dev/null
echo "      Done."

# ── Step 3: Remove old installer files ───────────────────────────────────────
echo "[3/5] Purane installer files hata raha hun..."
DESKTOP="$USERPROFILE/Desktop"
DOWNLOADS="$USERPROFILE/Downloads"
TMPDIR_WIN=$(powershell.exe -Command "echo \$env:TEMP" 2>/dev/null | tr -d '\r')

rm -f "$DESKTOP"/SAI-Rolotech*.exe 2>/dev/null
rm -f "$DESKTOP"/SAI-Update*.exe   2>/dev/null
rm -f "$DESKTOP"/SAI-2.*.exe       2>/dev/null
rm -f "$DOWNLOADS"/SAI-Rolotech*.exe 2>/dev/null

# Clean temp folder using PowerShell
powershell.exe -Command "Get-ChildItem \"\$env:TEMP\" -Filter 'SAI-Setup-*.exe' -EA SilentlyContinue | Remove-Item -Force -EA SilentlyContinue" 2>/dev/null

echo "      Done — sab purane files saaf!"

# ── Step 4: Auto-Download ─────────────────────────────────────────────────────
echo "[4/5] $TAG auto-download ho raha hai..."
INSTALLER_PATH="$TMPDIR_WIN\\SAI-Setup-${TAG}.exe"
INSTALLER_UNIX=$(powershell.exe -Command "[System.IO.Path]::GetTempPath()" 2>/dev/null | tr -d '\r' | sed 's|\\|/|g' | sed 's|C:|/c|i')SAI-Setup-${TAG}.exe

curl -L --progress-bar "$DOWNLOAD_URL" -o "$INSTALLER_UNIX"

if [ $? -ne 0 ] || [ ! -f "$INSTALLER_UNIX" ]; then
    echo "  ERROR: Download fail hua. Internet check karo."
    exit 1
fi
echo "      Download complete!"

# ── Step 5: Auto-Install silently ────────────────────────────────────────────
echo "[5/5] Auto-Install ho raha hai (koi popup nahi)..."
powershell.exe -Command "Start-Process '${INSTALLER_PATH}' -ArgumentList '/S' -Wait -NoNewWindow"
sleep 2

# Cleanup
rm -f "$INSTALLER_UNIX" 2>/dev/null

echo ""
echo "========================================="
echo "  $TAG INSTALL HO GAYA!"
echo "  Desktop shortcut se app kholen"
echo "========================================="
echo ""
