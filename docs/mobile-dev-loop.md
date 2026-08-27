# Local Mobile Dev Loop

A full EAS cloud build (`eas build --profile preview`) then reinstalling on-device is slow — minutes per change, and easy to mix up with the web/api dev flow (see the `apps/web/eas.json` mixup this avoids repeating). This is the local alternative: a **one-time native build**, then **fast JS-only iteration** afterward with no further native builds needed until a native dependency changes.

## One-time setup

1. **Android SDK** — install Android Studio, then add to your shell profile:
   ```bash
   export ANDROID_HOME="$HOME/Library/Android/sdk"
   export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
   ```
2. **A device to run on** — either:
   - An Android Virtual Device (AVD) created in Android Studio's Device Manager, or
   - A physical Android device with **USB debugging enabled** (Settings → Developer options → USB debugging), connected over USB.

## One-time per native-dependency change

Only needed when `apps/mobile/package.json`'s native dependencies change (a new Expo module, a version bump to something with native code) — not for every JS/TSX edit:

```bash
pnpm --filter @budget-terry/mobile run android   # or: run ios
```

This does a full native build and installs the resulting dev-client APK. Takes several minutes the first time (subsequent native rebuilds are faster via Gradle/Xcode caching).

## Fast loop (everything else)

```bash
pnpm --filter @budget-terry/mobile run dev
```

Starts Metro with `--dev-client`. JS/TSX changes fast-refresh in the already-installed app — no native rebuild, no reinstall. This is the loop for the vast majority of changes.

## Physical device specifics

- `adb devices -l` — confirm the device shows `device` (not `unauthorized`; if it says unauthorized, check the phone screen for an "Allow USB debugging?" prompt, or `adb kill-server && adb start-server` to retrigger it).
- `adb reverse tcp:8081 tcp:8081` — required for the device to reach Metro over USB (the dev-client build's install step does this automatically the first time; re-run it manually if Metro was restarted).
- Testing against the local API too (not production) also needs `adb reverse tcp:3001 tcp:3001`.
- `adb shell uiautomator dump /sdcard/dump.xml && adb pull /sdcard/dump.xml` — for scripted UI verification (e.g. an agent driving the app), this is far more reliable than guessing tap coordinates from a screenshot: dump the view hierarchy, grep for the target element's `bounds="[x1,y1][x2,y2]"`, tap the computed center.
- `adb shell screencap -p /sdcard/x.png && adb pull /sdcard/x.png` — grab a real screenshot directly off the device.

## Pointing the app at local vs. production data

`apps/mobile/.env` (see `.env.example`):

```
EXPO_PUBLIC_API_URL="http://localhost:3001"       # local API (needs adb reverse tcp:3001 tcp:3001 on a physical device)
EXPO_PUBLIC_API_URL="https://api.budget-terry.m9rcy.dev"  # production, for realistic data without touching local Postgres
```

## Convenience script

`scripts/mobile-dev.sh` wraps the emulator-boot and Metro-start steps the same way `scripts/dev.sh` already does for web+api — see that script's own `--help`/usage comment for the exact subcommands. It does **not** run the native build step automatically (that's a multi-minute operation that shouldn't happen implicitly); it prints a reminder if no build output is detected.
