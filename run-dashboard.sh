#!/usr/bin/env bash
WORKSPACE_DIR="$(cd "$(dirname "$0")" && pwd)"
DASH_DIR="$WORKSPACE_DIR/artifacts/dashboard"
ENV_FILE="$WORKSPACE_DIR/.env"

# Load .env (dashboard doesn't strictly need DB but keeps env consistent)
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
fi

echo "[dashboard] Starting on port 5173..."
cd "$DASH_DIR"

export PORT=5173
export BASE_PATH=/
export NODE_ENV=development

exec "$DASH_DIR/node_modules/.bin/vite" --config vite.config.ts --host 0.0.0.0 --port 5173
