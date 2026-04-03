#!/bin/bash
set -e

echo "=== Building frontend ==="
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/design-tool run build

echo "=== Building backend ==="
pnpm --filter @workspace/api-server run build

echo "=== Copying frontend to API server dist ==="
cp -r artifacts/design-tool/dist/public artifacts/api-server/dist/public

echo "=== Build complete ==="
ls -la artifacts/api-server/dist/
ls -la artifacts/api-server/dist/public/ | head -20
