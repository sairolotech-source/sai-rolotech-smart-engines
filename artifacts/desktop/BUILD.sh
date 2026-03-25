#!/bin/bash
echo ""
echo "====================================================="
echo "  SAI Rolotech Smart Engines v2.2.23 - Auto Builder"
echo "====================================================="
echo ""

# Step 1: Latest code lao
echo "[1/4] GitHub se latest code pull ho raha hai..."
cd "$(git rev-parse --show-toplevel)" 2>/dev/null || cd "$(dirname "$0")/../.."
git pull origin main
echo "      Done."

# Step 2: pnpm install
echo ""
echo "[2/4] pnpm install ho raha hai..."
npm install -g pnpm --silent
pnpm install
echo "      Done."

# Step 3: Build
echo ""
echo "[3/4] v2.2.23 EXE build ho raha hai (3-5 min)..."
pnpm --filter @workspace/desktop run dist:all
STATUS=$?

# Step 4: Result
echo ""
if [ $STATUS -eq 0 ]; then
  echo "====================================================="
  echo "  BUILD COMPLETE! v2.2.23"
  echo ""
  echo "  EXE yahan hai:"
  echo "  artifacts/desktop/release/"
  echo "    - SAI-Rolotech-Smart-Engines-Setup-2.2.23.exe"
  echo "    - SAI-Rolotech-Smart-Engines-Portable-2.2.23.exe"
  echo "====================================================="
else
  echo "  [ERROR] Build fail hua. Upar error message dekho."
fi
echo ""
read -p "Enter dabao band karne ke liye..."
