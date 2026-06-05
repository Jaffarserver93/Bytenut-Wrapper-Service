#!/usr/bin/env bash
WORKSPACE_DIR="$(cd "$(dirname "$0")" && pwd)"
DASH_DIR="$WORKSPACE_DIR/artifacts/dashboard"
ENV_FILE="$WORKSPACE_DIR/.env"

echo "[dashboard] ── Starting ─────────────────────────────────"
echo "[dashboard] WORKSPACE : $WORKSPACE_DIR"
echo "[dashboard] DASH_DIR  : $DASH_DIR"

# ── Load .env ────────────────────────────────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r key val; do
    [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
    export "$key"="$val"
  done < <(grep -v '^\s*#' "$ENV_FILE" | grep '=')
  echo "[dashboard] .env loaded"
else
  echo "[dashboard] WARNING: no .env found"
fi

export PORT=5173
export BASE_PATH=/
export NODE_ENV=development
echo "[dashboard] PORT=$PORT  BASE_PATH=$BASE_PATH"

# ── Find vite ────────────────────────────────────────────────────────────
VITE_BIN=""
for candidate in \
  "$DASH_DIR/node_modules/.bin/vite" \
  "$WORKSPACE_DIR/node_modules/.bin/vite" \
  "$(command -v vite 2>/dev/null)"; do
  [ -x "$candidate" ] && VITE_BIN="$candidate" && break
done

cd "$DASH_DIR"

if [ -n "$VITE_BIN" ]; then
  echo "[dashboard] Using vite binary: $VITE_BIN"
  "$VITE_BIN" --config vite.termux.config.ts --host 0.0.0.0 --port "$PORT"
elif command -v pnpm &>/dev/null; then
  echo "[dashboard] Using: pnpm exec vite"
  pnpm exec vite --config vite.termux.config.ts --host 0.0.0.0 --port "$PORT"
else
  echo "[dashboard] ERROR: no vite binary found and pnpm not available"
  echo "[dashboard] Run from $WORKSPACE_DIR: pnpm install"
  exit 1
fi
