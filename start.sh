#!/bin/bash
set -e
export NODE_ENV=production
cd "$(dirname "$0")/artifacts/api-server"
exec node dist/index.cjs
