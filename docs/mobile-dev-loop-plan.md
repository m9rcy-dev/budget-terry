# Faster Local Mobile Test Loop

**Status:** Draft — under review
**Date:** 2026-08-26

## Context

Testing a mobile change previously meant a full EAS cloud build (`eas build --profile preview`) then reinstalling on-device for every change — slow, and the round trip that led to the `apps/web/eas.json` mixup earlier. This session already worked out and validated a fully local alternative (Android emulator + `expo run:android` once + `expo start --dev-client` for fast-refresh iteration afterward, confirmed working on both the emulator and a real device over USB with `adb reverse`). This item is about **productizing that already-proven workflow** — writing it down and scripting it — not inventing something new.

## Decision

Follow the exact pattern `scripts/dev.sh` already established for web+api (background start, health-check wait, log file, single restart/start/stop entrypoint) rather than a different style script.

## Files

1. **`docs/mobile-dev-loop.md`** (new) — the concrete, copy-pasteable workflow:
   - One-time setup: `ANDROID_HOME`/`PATH` exports (what this session added to `~/.zshrc`), Android Studio + an AVD, or a physical device with USB debugging enabled.
   - One-time per native-dependency-change: `pnpm --filter @budget-terry/mobile run android` (or `ios`) — full native build + install, only needed when native deps change, not for every JS edit.
   - Fast loop after that: `pnpm --filter @budget-terry/mobile run start` (Metro/dev-client) — JS changes fast-refresh without any native rebuild.
   - Physical device specifics: `adb devices -l` to confirm authorization, `adb reverse tcp:8081 tcp:8081` for USB Metro connectivity, `adb shell uiautomator dump` as the reliable alternative to blind coordinate-tapping for scripted UI checks.
   - `apps/mobile/.env` pointing `EXPO_PUBLIC_API_URL` at either local (`http://localhost:3001`, needs `adb reverse tcp:3001 tcp:3001` too for a physical device) or production, for testing against real vs. local data.

2. **`scripts/mobile-dev.sh`** (new) — thin wrapper, not a reimplementation:
   - `scripts/mobile-dev.sh emulator` — boots the configured AVD if no device is already attached (`adb devices` check first, matching `scripts/dev.sh`'s "don't restart what's already healthy" instinct).
   - `scripts/mobile-dev.sh start` — starts Metro in the background (log to `.dev-logs/mobile.log`, same convention as `API_LOG`/`WEB_LOG`), waits for `http://localhost:8081/status` to come up (Metro's own health endpoint).
   - Deliberately does **not** attempt to auto-run `expo run:android`/`run:ios` — that's a multi-minute native build that shouldn't happen implicitly on every invocation, matching `docs/mobile-dev-loop.md`'s "only needed when native deps change" guidance. Prints a reminder instead if no build output is detected.

3. **`apps/mobile/package.json`** — add `"dev": "expo start --dev-client"` as an explicit alias for the fast loop, so it's discoverable next to the existing `start`/`android`/`ios` scripts without needing to remember the `--dev-client` flag.

## Explicitly out of scope

- iOS-specific tooling (Simulator boot scripting) — this session only validated the Android path end-to-end; add iOS once actually needed rather than guessing at the equivalent `xcrun simctl` commands untested.
- Any change to the EAS cloud-build path itself — that stays as-is for producing installable builds to share with others; this is purely about _iterating_ faster during development.

## Verification

- Fresh clone (or `git clean` of `apps/mobile/android`) → follow `docs/mobile-dev-loop.md` from scratch → confirm it actually gets to a running app without any undocumented steps.
- `scripts/mobile-dev.sh start` / re-running when Metro's already up doesn't double-start or error.
