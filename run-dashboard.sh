#!/usr/bin/env bash
WORKSPACE_DIR="$(cd "$(dirname "$0")" && pwd)"
DASH_DIR="$WORKSPACE_DIR/artifacts/dashboard"
ENV_FILE="$WORKSPACE_DIR/.env"

echo "[dashboard] ── Starting ─────────────────────────────────"
echo "[dashboard] WORKSPACE : $WORKSPACE_DIR"
echo "[dashboard] DASH_DIR  : $DASH_DIR"

# ── Load .env ────────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  set -a
  # Use grep+export to avoid interpreting special chars in DATABASE_URL
  while IFS='=' read -r key val; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    export "$key"="$val"
  done < <(grep -v '^\s*#' "$ENV_FILE" | grep '=')
  set +a
  echo "[dashboard] .env loaded"
else
  echo "[dashboard] WARNING: no .env file found"
fi

export PORT=5173
export BASE_PATH=/
export NODE_ENV=development

echo "[dashboard] PORT=$PORT  BASE_PATH=$BASE_PATH  NODE_ENV=$NODE_ENV"

# ── Find vite binary ─────────────────────────────────────────────────────
VITE_BIN=""
VITE_CONFIG="$DASH_DIR/vite.termux.config.ts"

# Try locations in order of reliability
for candidate in \
  "$DASH_DIR/node_modules/.bin/vite" \
  "$WORKSPACE_DIR/node_modules/.bin/vite" \
  "$(command -v vite 2>/dev/null)"; do
  if [ -x "$candidate" ]; then
    VITE_BIN="$candidate"
    break
  fi
done

if [ -z "$VITE_BIN" ]; then
  echo "[dashboard] All direct paths failed — trying pnpm exec..."
  cd "$DASH_DIR"
  if command -v pnpm &>/dev/null; then
    echo "[dashboard] Using: pnpm exec vite"
    exec pnpm exec vite --config "$VITE_CONFIG" --host 0.0.0.0 --port "$PORT"
  else
    echo "[dashboard] ERROR: pnpm not found and no vite binary located"
    echo "[dashboard] Install pnpm: npm install -g pnpm"
    exit 1
  fi
fi

echo "[dashboard] vite binary : $VITE_BIN"
echo "[dashboard] vite config : $VITE_CONFIG"
echo "[dashboard] ────────────────────────────────────────────"

cd "$DASH_DIR"
exec "$VITE_BIN" --config "$VITE_CONFIG" --host 0.0.0.0 --port "$PORT"
