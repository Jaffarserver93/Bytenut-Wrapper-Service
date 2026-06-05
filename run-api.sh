#!/usr/bin/env bash
WORKSPACE_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$WORKSPACE_DIR/artifacts/api-server"

echo "[api] Building..."
cd "$API_DIR"
node ./build.mjs || { echo "[api] BUILD FAILED"; exit 1; }

echo "[api] Starting on port 8080..."

if command -v Xvfb &>/dev/null; then
  (Xvfb :99 -screen 0 1280x800x24 >/dev/null 2>&1 &)
  export DISPLAY=:99
fi

export NODE_ENV=development
export PORT=8080

exec node --enable-source-maps "$API_DIR/dist/index.mjs"
