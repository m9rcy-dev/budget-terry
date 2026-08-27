#!/usr/bin/env bash
# Local mobile dev loop helper — same shape as scripts/dev.sh (background
# start, health-check wait, log file) applied to Metro/the emulator instead
# of the web+api HTTP servers. See docs/mobile-dev-loop.md for the full
# workflow this wraps.
#
# Usage:
#   scripts/mobile-dev.sh emulator   (boot the configured AVD if no device is attached)
#   scripts/mobile-dev.sh start      (start Metro in --dev-client mode)
#   scripts/mobile-dev.sh stop       (stop Metro)
#
# Deliberately does NOT run `expo run:android`/`run:ios` (the native build)
# automatically — that's a multi-minute operation that shouldn't happen
# implicitly on every invocation. Run it yourself when native deps change:
#   pnpm --filter @budget-terry/mobile run android

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_DIR="$ROOT_DIR/apps/mobile"
LOG_DIR="$ROOT_DIR/.dev-logs"
MOBILE_LOG="$LOG_DIR/mobile.log"
METRO_PORT="${METRO_PORT:-8081}"
AVD_NAME="${MOBILE_AVD_NAME:-Pixel_8}"

mkdir -p "$LOG_DIR"

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "Stopping process(es) on port ${port}: ${pids}"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
  fi
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

has_native_build() {
  [ -f "$MOBILE_DIR/android/app/build/outputs/apk/debug/app-debug.apk" ] || [ -d "$MOBILE_DIR/ios/build" ]
}

start_emulator() {
  if adb devices | grep -qw "device"; then
    echo "A device is already attached (adb devices) — not booting an emulator."
    return 0
  fi
  echo "Booting AVD '${AVD_NAME}' (override with MOBILE_AVD_NAME)..."
  (nohup emulator -avd "$AVD_NAME" -no-snapshot-load >"$LOG_DIR/emulator.log" 2>&1 &)
  echo "Waiting for the emulator to come online..."
  adb wait-for-device
  for _ in $(seq 1 60); do
    if [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then
      echo "Emulator booted."
      return 0
    fi
    sleep 2
  done
  echo "Emulator did not finish booting in time — check $LOG_DIR/emulator.log" >&2
  return 1
}

start_metro() {
  if ! has_native_build; then
    echo "No local native build detected under apps/mobile/android or apps/mobile/ios."
    echo "If the app isn't already installed on your device/emulator, run:"
    echo "  pnpm --filter @budget-terry/mobile run android   (or: run ios)"
    echo "before this will have anything to connect to."
  fi

  kill_port "$METRO_PORT"
  echo "Starting Metro (--dev-client) on :${METRO_PORT} (log: ${MOBILE_LOG})..."
  (cd "$MOBILE_DIR" && pnpm run dev >"$MOBILE_LOG" 2>&1 &)
  wait_for_http "http://localhost:${METRO_PORT}/status" "Metro" "$MOBILE_LOG"
}

stop_metro() {
  kill_port "$METRO_PORT"
}

case "${1:-}" in
  emulator)
    start_emulator
    ;;
  start)
    start_metro
    ;;
  stop)
    stop_metro
    ;;
  *)
    echo "Usage: $0 [emulator|start|stop]" >&2
    exit 1
    ;;
esac
