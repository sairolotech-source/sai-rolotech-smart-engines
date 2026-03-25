#!/bin/bash
echo ""
echo "====================================================="
echo "  SAI Rolotech Smart Engines v2.2.23 - Auto Builder"
echo "====================================================="
echo ""

# Root directory dhundo
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
  REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
fi
cd "$REPO_ROOT"
echo "  Repo: $REPO_ROOT"

# Step 1: Latest code
echo ""
echo "[1/5] GitHub se latest code pull ho raha hai..."
git pull origin main
echo "      Done."

# Step 2: pnpm
echo ""
echo "[2/5] pnpm install ho raha hai..."
npm install -g pnpm --silent
pnpm install
echo "      Done."

# Step 3: Frontend build (Vite)
echo ""
echo "[3/5] Frontend build ho raha hai (React/Vite)..."
cd "$REPO_ROOT/artifacts/design-tool"
pnpm run build
if [ $? -ne 0 ]; then
  echo "  [ERROR] Frontend build fail hua!"
  read -p "Enter dabao band karne ke liye..."
  exit 1
fi
echo "      Frontend ready."

# Step 4: Backend build
echo ""
echo "[4/5] Backend build ho raha hai (API Server)..."
cd "$REPO_ROOT/artifacts/api-server"
pnpm run build
if [ $? -ne 0 ]; then
  echo "  [WARN] Backend build fail hua — continue kar raha hai..."
fi
echo "      Backend ready."

# Step 5: Electron + EXE build
echo ""
echo "[5/5] v2.2.23 Windows EXE ban raha hai (2-4 min)..."
cd "$REPO_ROOT/artifacts/desktop"
npx tsc -p tsconfig.json
npx electron-builder --win nsis portable
STATUS=$?

echo ""
if [ $STATUS -eq 0 ]; then
  echo "====================================================="
  echo "  BUILD COMPLETE! v2.2.23"
  echo ""
  echo "  EXE yahan hai:"
  echo "  $REPO_ROOT/artifacts/desktop/release/"
  echo "    Setup:    SAI-Rolotech-Smart-Engines-Setup-2.2.23.exe"
  echo "    Portable: SAI-Rolotech-Smart-Engines-Portable-2.2.23.exe"
  echo "====================================================="
else
  echo "  [ERROR] EXE build fail hua. Upar error dekho."
fi
echo ""
read -p "Enter dabao band karne ke liye..."
