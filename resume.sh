#!/usr/bin/env bash
# resume.sh — Monitors Claude API usage and auto-restarts Claude Code after rate limit reset.
# Usage: ./resume.sh
# Requires: ANTHROPIC_API_KEY in environment or .env file

set -euo pipefail

# ─── Config ────────────────────────────────────────────────────────────────────
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WAIT_HOURS=5
WAIT_SECONDS=$(( WAIT_HOURS * 3600 ))
USAGE_THRESHOLD=>95
POLL_INTERVAL=60   # seconds between usage checks while idle

# ─── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Helpers ───────────────────────────────────────────────────────────────────
log()     { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $*"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓${NC} $*"; }
warn()    { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠${NC} $*"; }
error()   { echo -e "${RED}[$(date '+%H:%M:%S')] ✗${NC} $*" >&2; }

# Load .env if present and ANTHROPIC_API_KEY not already set
load_env() {
  if [[ -z "${ANTHROPIC_API_KEY:-}" && -f "$PROJECT_DIR/.env" ]]; then
    # shellcheck disable=SC2046
    export $(grep -v '^\s*#' "$PROJECT_DIR/.env" | grep 'ANTHROPIC_API_KEY' | xargs) 2>/dev/null || true
  fi
}

# ─── Usage Check ───────────────────────────────────────────────────────────────
# Returns the current usage percentage (0–100) via the Anthropic usage API.
# Prints 0 if the key is missing or the API call fails.
get_usage_percent() {
 # if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
 #   echo "0"
 #   return
 # fi

  local response
  response=$(curl -sf --max-time 10 \
    "https://api.anthropic.com/v1/organizations/usage" \
    -H "x-api-key: ${ANTHROPIC_API_KEY}" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" 2>/dev/null) || { echo "0"; return; }

  # Parse: (tokens_used / monthly_limit) * 100
  # Falls back to 0 if the response structure differs.
  python3 - <<EOF 2>/dev/null || echo "0"
import json, sys
try:
    d = json.loads('''${response}''')
    used  = d.get("usage", {}).get("input_tokens", 0) \
          + d.get("usage", {}).get("output_tokens", 0)
    limit = d.get("limits", {}).get("monthly_tokens", 0)
    print(int(used * 100 / limit) if limit > 0 else 0)
except Exception:
    print(0)
EOF
}

# ─── Countdown Timer ───────────────────────────────────────────────────────────
countdown() {
  local total=$1
  local end_time=$(( $(date +%s) + total ))

  while true; do
    local now; now=$(date +%s)
    local remaining=$(( end_time - now ))
    [[ $remaining -le 0 ]] && break

    local h=$(( remaining / 3600 ))
    local m=$(( (remaining % 3600) / 60 ))
    local s=$(( remaining % 60 ))
    printf "\r${YELLOW}  ⏳ Resuming in: %02dh %02dm %02ds${NC}   " "$h" "$m" "$s"
    sleep 1
  done
  printf "\r%-50s\r" " "   # clear the line
}

# ─── Launch Claude Code ────────────────────────────────────────────────────────
launch_claude() {
  success "Launching Claude Code → ${BOLD}${PROJECT_DIR}${NC}"
  echo -e "${CYAN}  Flags: --dangerously-skip-permissions${NC}"
  echo ""
  cd "$PROJECT_DIR"
  # Claude Code reads CLAUDE.md automatically — session resumes from Current Work.
  claude --dangerously-skip-permissions
}

# ─── Main Loop ─────────────────────────────────────────────────────────────────
main() {
  load_env

  echo ""
  echo -e "${BOLD}╔══════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║       Angel Bot — Auto-Resume Script     ║${NC}"
  echo -e "${BOLD}╚══════════════════════════════════════════╝${NC}"
  echo ""
  log "Project  : $PROJECT_DIR"
  log "Threshold: ${USAGE_THRESHOLD}% usage triggers ${WAIT_HOURS}h wait"
  log "API key  : ${ANTHROPIC_API_KEY:+set}${ANTHROPIC_API_KEY:-NOT SET — usage check disabled}"
  echo ""

  while true; do
    # ── Check current usage before launching ──────────────────────────────────
    local pct
    pct=$(get_usage_percent)

    if [[ "$pct" -ge "$USAGE_THRESHOLD" ]]; then
      warn "Usage at ${pct}% — at or above ${USAGE_THRESHOLD}% threshold."
      warn "Waiting ${WAIT_HOURS} hours for rate limit reset..."
      echo ""
      countdown "$WAIT_SECONDS"
      echo ""
      log "Timer done. Re-checking usage..."
      continue   # loop back and re-check before launching
    fi

    # ── Launch Claude Code ─────────────────────────────────────────────────────
    if [[ "$pct" -gt 0 ]]; then
      log "Current usage: ${pct}% — below threshold. Starting Claude Code."
    else
      log "Usage check unavailable or 0%. Starting Claude Code."
    fi

    echo ""
    launch_claude   # blocks until the user exits Claude Code
    local exit_code=$?
    echo ""

    # ── Post-exit handling ─────────────────────────────────────────────────────
    log "Claude Code exited (code: ${exit_code})."

    # Re-check usage after session ends
    pct=$(get_usage_percent)

    if [[ "$pct" -ge "$USAGE_THRESHOLD" ]]; then
      warn "Usage now at ${pct}% after session. Rate limit likely hit."
      warn "Waiting ${WAIT_HOURS} hours before next session..."
      echo ""
      countdown "$WAIT_SECONDS"
      echo ""
      log "Timer done. Restarting..."
      continue
    fi

    # Not rate-limited — ask whether to restart
    echo ""
    echo -e "${YELLOW}Claude Code exited with usage at ${pct}%.${NC}"
    printf "Restart now? [y/N] "
    read -r -t 30 answer || answer="n"
    echo ""
    [[ "${answer,,}" == "y" ]] || { log "Exiting resume script."; break; }
  done
}

main "$@"
