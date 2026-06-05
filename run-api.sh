#!/usr/bin/env bash
WORKSPACE_DIR="$(cd "$(dirname "$0")" && pwd)"
API_DIR="$WORKSPACE_DIR/artifacts/api-server"
ENV_FILE="$WORKSPACE_DIR/.env"

# Load .env
if [ -f "$ENV_FILE" ]; then
  set -a; source "$ENV_FILE"; set +a
else
  echo "[api] ERROR: .env not found. Run: bash setup-db.sh"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "[api] ERROR: DATABASE_URL is not set in .env"
  exit 1
fi

echo "[api] Building..."
cd "$API_DIR"
node ./build.mjs || { echo "[api] BUILD FAILED"; exit 1; }

echo "[api] Starting on port ${PORT:-8080}..."

if command -v Xvfb &>/dev/null; then
  (Xvfb :99 -screen 0 1280x800x24 >/dev/null 2>&1 &)
  export DISPLAY=:99
fi

export NODE_ENV=development
export PORT=${PORT:-8080}

node --enable-source-maps "$API_DIR/dist/index.mjs"
