#!/usr/bin/env bash
# Stop/start/restart the local apps/api + apps/web dev servers in one
# command. Also clears apps/web/.next on every start — this project has
# repeatedly hit a stale-build-cache bug (Cannot find module './NNN.js')
# after killing/restarting `next dev` abruptly (see README troubleshooting
# and PROJECT_STATUS.md) — clearing it here removes the whole class of bug
# rather than relying on remembering to do it by hand.
#
# Usage:
#   scripts/dev.sh restart   (default — stop then start)
#   scripts/dev.sh start
#   scripts/dev.sh stop
#
# apps/mobile isn't included — Expo's workflow (simulator/device/QR code)
# doesn't fit the same "boot in the background, curl until healthy" model
# as the two plain HTTP dev servers here. Run it separately as needed:
#   pnpm --filter @budget-terry/mobile start

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.dev-logs"
API_LOG="$LOG_DIR/api.log"
WEB_LOG="$LOG_DIR/web.log"
API_PORT="${API_PORT:-3001}"
WEB_PORT="${WEB_PORT:-3000}"

mkdir -p "$LOG_DIR"

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "Stopping process(es) on port ${port}: ${pids}"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

stop_all() {
  echo "Stopping dev servers (api :${API_PORT}, web :${WEB_PORT})..."
  kill_port "$API_PORT"
  kill_port "$WEB_PORT"
}

wait_for_http() {
  local url="$1" name="$2" log="$3"
  for _ in $(seq 1 30); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null)" = "200" ]; then
      echo "${name} is up: ${url}"
      return 0
    fi
    sleep 1
  done
  echo "${name} did not become healthy in time — check ${log}" >&2
  return 1
}

start_all() {
  echo "Clearing apps/web/.next build cache..."
  rm -rf "$ROOT_DIR/apps/web/.next"

  echo "Starting API on :${API_PORT} (log: ${API_LOG})..."
  (cd "$ROOT_DIR/apps/api" && pnpm run start:dev >"$API_LOG" 2>&1 &)

  echo "Starting web on :${WEB_PORT} (log: ${WEB_LOG})..."
  (cd "$ROOT_DIR/apps/web" && pnpm run dev >"$WEB_LOG" 2>&1 &)

  wait_for_http "http://localhost:${API_PORT}/health" "API" "$API_LOG"
  wait_for_http "http://localhost:${WEB_PORT}/login" "Web" "$WEB_LOG"
}

case "${1:-restart}" in
  stop)
    stop_all
    ;;
  start)
    start_all
    ;;
  restart)
    stop_all
    start_all
    ;;
  *)
    echo "Usage: $0 [start|stop|restart]" >&2
    exit 1
    ;;
esac
