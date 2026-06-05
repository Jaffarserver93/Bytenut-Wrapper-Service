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

# ── 1. Dependency checks / auto-install ───────────────────────────────────
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

if command -v Xvfb &>/dev/null; then
  ok "Xvfb found"
else
  warn "Xvfb not found — puppeteer may not work (apt install xvfb to fix)"
fi

# ── 2. Database setup (first run creates .env) ─────────────────────────────
ENV_FILE="$WORKSPACE_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  info "No .env found — running database setup..."
  bash "$WORKSPACE_DIR/setup-db.sh"
else
  info ".env found — skipping database setup"
  # Make sure PostgreSQL is running
  if command -v pg_isready &>/dev/null && ! pg_isready -q 2>/dev/null; then
    info "PostgreSQL not running — starting it..."
    PG_VER=$(ls /usr/lib/postgresql/ 2>/dev/null | sort -V | tail -1)
    PG_DATA="/var/lib/postgresql/$PG_VER/main"
    su - postgres -c "/usr/lib/postgresql/$PG_VER/bin/pg_ctl -D $PG_DATA -l /tmp/postgresql.log start -w" 2>/dev/null \
      || warn "Could not start PostgreSQL — run: bash setup-db.sh"
  fi
fi

# ── 3. Install workspace deps ──────────────────────────────────────────────
info "Installing workspace dependencies (this may take a few minutes)..."
cd "$WORKSPACE_DIR"
pnpm install --no-frozen-lockfile
ok "Dependencies ready"

# ── 4. Make scripts executable ─────────────────────────────────────────────
chmod +x "$WORKSPACE_DIR/run-api.sh"
chmod +x "$WORKSPACE_DIR/run-dashboard.sh"
chmod +x "$WORKSPACE_DIR/setup-db.sh"

# ── 5. Kill any existing session ──────────────────────────────────────────
if tmux has-session -t "$SESSION" 2>/dev/null; then
  warn "Killing existing tmux session '$SESSION'..."
  tmux kill-session -t "$SESSION"
fi

# ── 6. Launch tmux session ────────────────────────────────────────────────
info "Starting tmux session '$SESSION'..."

# Window 0 — API Server
tmux new-session -d -s "$SESSION" -n "api" -x 220 -y 50
tmux send-keys  -t "$SESSION:api" \
  "bash $WORKSPACE_DIR/run-api.sh; echo ''; echo '--- API exited (read error above, press Enter) ---'; read" \
  Enter

# Window 1 — Dashboard
tmux new-window -t "$SESSION" -n "dashboard"
tmux send-keys  -t "$SESSION:dashboard" \
  "bash $WORKSPACE_DIR/run-dashboard.sh; echo ''; echo '--- Dashboard exited (read error above, press Enter) ---'; read" \
  Enter

# Window 2 — Shell
tmux new-window -t "$SESSION" -n "shell"
tmux send-keys  -t "$SESSION:shell" \
  "cd $WORKSPACE_DIR && echo 'Bytenut workspace — shell ready'" \
  Enter

tmux select-window -t "$SESSION:api"

# ── 7. Done ───────────────────────────────────────────────────────────────
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

if [ -t 1 ]; then
  tmux attach -t "$SESSION"
fi
