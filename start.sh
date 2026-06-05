#!/usr/bin/env bash
set -e

SESSION="bytenut"
WORKSPACE_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── Colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[*]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
die()   { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ── 1. Dependency checks / auto-install (Debian/Ubuntu) ────────────────────
check_or_install() {
  local cmd="$1" pkg="${2:-$1}"
  if ! command -v "$cmd" &>/dev/null; then
    warn "$cmd not found — installing $pkg via apt..."
    apt-get update -qq && apt-get install -y -qq "$pkg"
    ok "$pkg installed"
  else
    ok "$cmd found: $(command -v "$cmd")"
  fi
}

check_or_install tmux
check_or_install node  nodejs
check_or_install npm

# pnpm
if ! command -v pnpm &>/dev/null; then
  warn "pnpm not found — installing via npm..."
  npm install -g pnpm --quiet
  ok "pnpm installed"
else
  ok "pnpm found: $(command -v pnpm)"
fi

# Xvfb (optional — needed for puppeteer-real-browser)
HAVE_XVFB=false
if command -v Xvfb &>/dev/null; then
  HAVE_XVFB=true
  ok "Xvfb found"
else
  warn "Xvfb not found — API server will start without virtual display (puppeteer may not work)."
  warn "  To install: apt-get install -y xvfb"
fi

# ── 2. Install workspace deps ───────────────────────────────────────────────
info "Installing workspace dependencies..."
cd "$WORKSPACE_DIR"
pnpm install --frozen-lockfile 2>&1 | tail -5
ok "Dependencies ready"

# ── 3. Build the API server ─────────────────────────────────────────────────
info "Building API server..."
cd "$WORKSPACE_DIR/artifacts/api-server"
node ./build.mjs
ok "API server built"
cd "$WORKSPACE_DIR"

# ── 4. Kill any existing session ───────────────────────────────────────────
if tmux has-session -t "$SESSION" 2>/dev/null; then
  warn "Killing existing tmux session '$SESSION'..."
  tmux kill-session -t "$SESSION"
fi

# ── 5. Launch tmux session ─────────────────────────────────────────────────
info "Starting tmux session '$SESSION'..."

# Window 0 — API Server
API_CMD="cd $WORKSPACE_DIR/artifacts/api-server"
if [ "$HAVE_XVFB" = true ]; then
  API_CMD="$API_CMD && Xvfb :99 -screen 0 1280x800x24 &>/dev/null & export DISPLAY=:99"
fi
API_CMD="$API_CMD && export NODE_ENV=development && export PORT=8080 && node --enable-source-maps ./dist/index.mjs"

tmux new-session  -d -s "$SESSION" -n "api"       -x 220 -y 50
tmux send-keys    -t "$SESSION:api"       "$API_CMD" Enter

# Window 1 — Dashboard
DASH_CMD="cd $WORKSPACE_DIR/artifacts/dashboard && export PORT=5173 && npx --yes vite --config vite.config.ts --host 0.0.0.0 --port 5173"
tmux new-window   -t "$SESSION" -n "dashboard"
tmux send-keys    -t "$SESSION:dashboard" "$DASH_CMD" Enter

# Window 2 — Shell (free to use)
tmux new-window   -t "$SESSION" -n "shell"
tmux send-keys    -t "$SESSION:shell"     "cd $WORKSPACE_DIR && echo 'Bytenut workspace ready'" Enter

# Focus the api window
tmux select-window -t "$SESSION:api"

# ── 6. Done ────────────────────────────────────────────────────────────────
echo ""
ok "All services launched inside tmux session '${SESSION}'"
echo ""
echo -e "  ${CYAN}API Server  ${NC}→ http://localhost:8080"
echo -e "  ${CYAN}Dashboard   ${NC}→ http://localhost:5173"
echo ""
echo -e "Useful tmux commands:"
echo -e "  ${YELLOW}tmux attach -t ${SESSION}${NC}        — attach to the session"
echo -e "  ${YELLOW}tmux ls${NC}                          — list sessions"
echo -e "  ${YELLOW}Ctrl-b  n / p${NC}                   — next / prev window"
echo -e "  ${YELLOW}Ctrl-b  d${NC}                       — detach (keep running)"
echo -e "  ${YELLOW}tmux kill-session -t ${SESSION}${NC} — stop everything"
echo ""

# Auto-attach if running in an interactive terminal
if [ -t 1 ]; then
  tmux attach -t "$SESSION"
fi
