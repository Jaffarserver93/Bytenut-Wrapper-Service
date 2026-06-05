#!/usr/bin/env bash
set -e

SESSION="bytenut"
WORKSPACE_DIR="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[*]${NC} $*"; }
ok()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
die()   { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ── 1. Dependency checks ───────────────────────────────────────────────────
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
check_or_install node nodejs
check_or_install npm

if ! command -v pnpm &>/dev/null; then
  warn "pnpm not found — installing via npm..."
  npm install -g pnpm --quiet
  ok "pnpm installed"
else
  ok "pnpm found: $(command -v pnpm)"
fi

command -v Xvfb &>/dev/null && ok "Xvfb found" || warn "Xvfb not found (apt install xvfb to fix puppeteer)"

# ── 2. Check .env ─────────────────────────────────────────────────────────
ENV_FILE="$WORKSPACE_DIR/.env"
[ ! -f "$ENV_FILE" ] && die ".env not found.\n  Create it: echo 'DATABASE_URL=<url>' > $ENV_FILE\n  Or run:    bash setup-db.sh"

# Safe load — avoids issues with special chars in DATABASE_URL
while IFS='=' read -r key val; do
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
  export "$key"="$val"
done < <(grep -v '^\s*#' "$ENV_FILE" | grep '=')

[ -z "$DATABASE_URL" ] && die "DATABASE_URL not set in .env"
ok "DATABASE_URL found in .env"

# ── 3. Install workspace deps ──────────────────────────────────────────────
info "Installing workspace dependencies..."
cd "$WORKSPACE_DIR"

# Detect ARM64 architecture mismatch — pnpm on Replit installs x64 native
# binaries (rollup, esbuild, etc.) which won't work on ARM64 Termux devices.
# Wipe node_modules so pnpm re-downloads the correct ARM64 binaries.
ARCH=$(uname -m)
ROLLUP_X64="$WORKSPACE_DIR/node_modules/.pnpm/@rollup+rollup-linux-x64-gnu@"
ROLLUP_ARM64_PKG="@rollup/rollup-linux-arm64-gnu"
if [ "$ARCH" = "aarch64" ] && ls "$ROLLUP_X64"* 2>/dev/null | grep -q .; then
  if [ ! -d "$WORKSPACE_DIR/node_modules/.pnpm/${ROLLUP_ARM64_PKG//\/+/@}@"* ] 2>/dev/null; then
    warn "ARM64 device detected with x64 binaries — cleaning node_modules for correct arch..."
    rm -rf "$WORKSPACE_DIR/node_modules"
    info "Reinstalling for ARM64..."
  fi
fi

pnpm install --no-frozen-lockfile
ok "Dependencies ready"

chmod +x "$WORKSPACE_DIR/run-api.sh" "$WORKSPACE_DIR/run-dashboard.sh" "$WORKSPACE_DIR/setup-db.sh" 2>/dev/null || true

# ── 4. Kill any existing tmux session ─────────────────────────────────────
if tmux has-session -t "$SESSION" 2>/dev/null; then
  warn "Killing existing tmux session '$SESSION'..."
  tmux kill-session -t "$SESSION"
fi

# ── 5. Launch tmux session ────────────────────────────────────────────────
info "Starting tmux session '$SESSION'..."

# Create session — first window is the API
tmux new-session -d -s "$SESSION" -n "api" -x 220 -y 50

# Critical: keep windows open after process exits so errors are always visible
tmux set-option -t "$SESSION" remain-on-exit on

# Window 0 — API Server
tmux send-keys -t "$SESSION:api" "bash $WORKSPACE_DIR/run-api.sh" Enter

# Window 1 — Dashboard
tmux new-window  -t "$SESSION" -n "dashboard"
tmux send-keys -t "$SESSION:dashboard" "bash $WORKSPACE_DIR/run-dashboard.sh" Enter

# Window 2 — Shell (persistent interactive shell)
tmux new-window  -t "$SESSION" -n "shell"
tmux send-keys -t "$SESSION:shell" "cd $WORKSPACE_DIR && echo '--- Bytenut shell ready ---'" Enter

# Focus API window
tmux select-window -t "$SESSION:api"

# ── 6. Done ───────────────────────────────────────────────────────────────
echo ""
ok "tmux session '${SESSION}' is running"
echo ""
echo -e "  ${CYAN}API Server ${NC}→ http://localhost:8080"
echo -e "  ${CYAN}Dashboard  ${NC}→ http://localhost:5173"
echo ""
echo -e "  ${YELLOW}tmux attach -t ${SESSION}${NC}  — attach (Ctrl-b n/p = switch windows, Ctrl-b d = detach)"
echo ""
echo -e "  Once inside tmux, if a window shows ${YELLOW}[exited]${NC}:"
echo -e "  Press ${YELLOW}Enter${NC} to see the last output, or ${YELLOW}r${NC} to respawn the window."
echo ""

# Attach so user lands inside the session
tmux attach -t "$SESSION"
