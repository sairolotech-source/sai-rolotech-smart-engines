#!/usr/bin/env bash
set -euo pipefail

echo "[replit-update] Start"
echo "[replit-update] cwd: $(pwd)"

if ! command -v git >/dev/null 2>&1; then
  echo "[replit-update] ERROR: git not found"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[replit-update] ERROR: pnpm not found"
  exit 1
fi

echo "[replit-update] Checking git status..."
if [[ -n "$(git status --porcelain)" ]]; then
  echo "[replit-update] ERROR: working tree dirty. Commit/stash/discard first."
  git status --short
  exit 1
fi

LOCAL_BEFORE="$(git rev-parse --short HEAD)"
echo "[replit-update] Local before: ${LOCAL_BEFORE}"

echo "[replit-update] Fetching origin/main..."
git fetch origin main --prune

REMOTE="$(git rev-parse --short origin/main)"
echo "[replit-update] Remote main: ${REMOTE}"

echo "[replit-update] Pulling fast-forward..."
git pull --ff-only origin main

LOCAL_AFTER="$(git rev-parse --short HEAD)"
echo "[replit-update] Local after: ${LOCAL_AFTER}"

echo "[replit-update] Installing dependencies..."
pnpm install --frozen-lockfile || pnpm install

echo "[replit-update] Building frontend..."
pnpm --filter @workspace/design-tool run build

echo "[replit-update] Building backend..."
pnpm --filter @workspace/api-server run build

echo "[replit-update] Version check:"
grep -n "APP_VERSION_TAG" artifacts/design-tool/src/lib/appVersion.ts || true

echo "[replit-update] Done. Restart Replit run/deployment now."
