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

# ── Xvfb / virtual display setup ──────────────────────────────────────────
# puppeteer-real-browser requires headless:false which needs a display.
# Install + start Xvfb automatically when running on Termux/headless Linux.
if [ -z "$DISPLAY" ]; then
  if ! command -v Xvfb &>/dev/null; then
    echo "[api] Xvfb not found — attempting to install..."
    if command -v apt-get &>/dev/null; then
      apt-get install -y --no-install-recommends xvfb 2>&1 | tail -5 \
        && echo "[api] Xvfb installed" \
        || echo "[api] WARNING: Xvfb install failed — browser may not start"
    elif command -v pkg &>/dev/null; then
      pkg install xvfb -y 2>&1 | tail -5 \
        && echo "[api] Xvfb installed" \
        || echo "[api] WARNING: Xvfb install failed — browser may not start"
    fi
  fi

  if command -v Xvfb &>/dev/null; then
    # Kill any stale Xvfb on :99
    pkill -f "Xvfb :99" 2>/dev/null || true
    Xvfb :99 -screen 0 1280x800x24 -ac +extension GLX +render -noreset >/dev/null 2>&1 &
    XVFB_PID=$!
    sleep 1
    if kill -0 "$XVFB_PID" 2>/dev/null; then
      export DISPLAY=:99
      echo "[api] Xvfb started (PID $XVFB_PID), DISPLAY=:99"
    else
      echo "[api] WARNING: Xvfb failed to start — browser automation may fail"
    fi
  fi
fi

export NODE_ENV=development
export PORT=${PORT:-8080}

node --enable-source-maps "$API_DIR/dist/index.mjs"
