#!/usr/bin/env bash
WORKSPACE_DIR="$(cd "$(dirname "$0")" && pwd)"
DASH_DIR="$WORKSPACE_DIR/artifacts/dashboard"
ENV_FILE="$WORKSPACE_DIR/.env"
VITE_BIN="$DASH_DIR/node_modules/.bin/vite"
VITE_CONFIG="$DASH_DIR/vite.termux.config.ts"

# Load .env
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

export PORT=5173
export BASE_PATH=/
export NODE_ENV=development

# Verify vite binary exists
if [ ! -f "$VITE_BIN" ]; then
  echo "[dashboard] ERROR: vite binary not found at $VITE_BIN"
  echo "[dashboard] Run: pnpm install  from $WORKSPACE_DIR"
  exit 1
fi

echo "[dashboard] Starting on http://0.0.0.0:$PORT"
echo "[dashboard] Config: $VITE_CONFIG"
cd "$DASH_DIR"

exec "$VITE_BIN" --config "$VITE_CONFIG" 2>&1
