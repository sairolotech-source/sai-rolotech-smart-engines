#!/bin/bash
set -e

echo "[build] Starting SAI Rolotech build..."
echo "[build] Node: $(node --version)"
echo "[build] pnpm: $(pnpm --version)"

echo "[build] Step 0: Installing dependencies..."
pnpm install --frozen-lockfile 2>&1 || pnpm install 2>&1
echo "[build] Dependencies installed."

echo "[build] Step 1: Building frontend (design-tool)..."
pnpm --filter @workspace/design-tool run build 2>&1
echo "[build] Frontend build complete."

echo "[build] Step 2: Building backend (api-server)..."
pnpm --filter @workspace/api-server run build 2>&1
echo "[build] Backend build complete."

echo "[build] Verifying build artifacts..."
if [ -f "artifacts/api-server/dist/index.cjs" ]; then
  echo "[build] OK: dist/index.cjs exists ($(wc -c < artifacts/api-server/dist/index.cjs) bytes)"
else
  echo "[build] ERROR: dist/index.cjs NOT FOUND!"
  exit 1
fi

if [ -f "artifacts/api-server/dist/public/index.html" ]; then
  echo "[build] OK: dist/public/index.html exists ($(wc -c < artifacts/api-server/dist/public/index.html) bytes)"
else
  echo "[build] ERROR: dist/public/index.html NOT FOUND!"
  exit 1
fi

echo "[build] All done successfully."
