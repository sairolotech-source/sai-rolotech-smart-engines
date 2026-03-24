#!/bin/bash
# SAI Rolotech Smart Engines — Auto Updater
# Git Bash mein chalao: bash ~/update-sai.sh

REPO="sairolotech-source/sai-rolotech-smart-engines"
API="https://api.github.com/repos/$REPO/releases/latest"

echo ""
echo "================================================="
echo "  SAI Rolotech Smart Engines — Auto Updater"
echo "================================================="
echo ""
echo "GitHub se latest version check kar raha hai..."

# Latest release info fetch karo
RELEASE_INFO=$(curl -sL "$API" 2>/dev/null)

if [ -z "$RELEASE_INFO" ]; then
  echo "ERROR: GitHub se connect nahi ho saka. Internet check karein."
  exit 1
fi

# Version aur download URL nikalo
VERSION=$(echo "$RELEASE_INFO" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('tag_name','unknown'))" 2>/dev/null)
DOWNLOAD_URL=$(echo "$RELEASE_INFO" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for a in d.get('assets',[]):
    if 'Setup' in a['name'] and not a['name'].endswith('.blockmap'):
        print(a['browser_download_url'])
        break
" 2>/dev/null)
FILENAME=$(echo "$RELEASE_INFO" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for a in d.get('assets',[]):
    if 'Setup' in a['name'] and not a['name'].endswith('.blockmap'):
        print(a['name'])
        break
" 2>/dev/null)

if [ -z "$DOWNLOAD_URL" ]; then
  echo "ERROR: Download link nahi mila. Baad mein try karein."
  exit 1
fi

echo "Latest Version : $VERSION"
echo "File           : $FILENAME"
echo ""
echo "Download ho raha hai Desktop pe (thoda wait karein)..."
echo ""

# Desktop path
DESKTOP="$USERPROFILE/Desktop"
if [ -z "$USERPROFILE" ]; then
  DESKTOP="$HOME/Desktop"
fi
SAVE_PATH="$DESKTOP/$FILENAME"

# Download with progress
curl -L --progress-bar "$DOWNLOAD_URL" -o "$SAVE_PATH"

if [ ! -f "$SAVE_PATH" ]; then
  echo ""
  echo "ERROR: Download fail ho gaya. Dobara try karein."
  exit 1
fi

SIZE=$(du -sh "$SAVE_PATH" | cut -f1)
echo ""
echo "Download complete! ($SIZE) — $SAVE_PATH"
echo ""
echo "Install ho raha hai (Admin permission maangega)..."
echo ""

# Windows Admin mode mein run karo
powershell.exe -Command "Start-Process '$SAVE_PATH' -Verb RunAs -Wait"

echo ""
echo "================================================="
echo "  Install complete! App dobara kholen."
echo "  Version: $VERSION"
echo "================================================="
echo ""
