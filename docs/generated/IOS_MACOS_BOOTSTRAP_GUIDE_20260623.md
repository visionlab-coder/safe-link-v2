# SAFE-LINK V2 iOS macOS Bootstrap Guide

## Purpose

Create the initial Capacitor 8 iOS project on a Mac without changing Android paths, then prove that an unsigned iOS Simulator build succeeds.

This guide does not authorize App Store signing, paid services, deployment, TestFlight upload, or production release.

## Required environment

- macOS
- Node.js 22 or later
- Xcode 26 or later
- Xcode Command Line Tools
- SAFE-LINK repository checked out on branch `codex/ios-bootstrap-20260623`
- Claude's final Android checkpoint incorporated before `--apply`

Capacitor 8 uses Swift Package Manager by default. CocoaPods is not required for the initial project.

## 1. Update the Android baseline

Before running the apply command, identify the final Android checkpoint:

```bash
git log --oneline -10
git status --short
```

Set the checkpoint SHA:

```bash
export IOS_ANDROID_BASE_SHA="<FINAL_ANDROID_COMMIT_SHA>"
```

Do not use an uncommitted Android working tree as the baseline.

## 2. Read-only preflight

```bash
cd apps/mobile
chmod +x scripts/bootstrap-ios-macos.sh scripts/verify-ios-isolation.sh
./scripts/bootstrap-ios-macos.sh --check
./scripts/verify-ios-isolation.sh
```

Expected result:

- macOS, Node and Xcode checks pass;
- Capacitor packages use the same major version;
- Android protected paths are clean;
- no files are changed.

## 3. Generate and build the iOS project

```bash
cd apps/mobile
./scripts/bootstrap-ios-macos.sh --apply
```

The script performs:

1. installation of `@capacitor/ios` using the current Android Capacitor version range;
2. Vite production build;
3. `npx cap add ios` using the default Swift Package Manager path;
4. `npx cap sync ios`;
5. unsigned generic iOS Simulator build;
6. Android protected-path verification.

## 4. Review generated changes

```bash
git status --short
git diff -- apps/mobile/package.json apps/mobile/package-lock.json
git status --short -- apps/mobile/ios
./apps/mobile/scripts/verify-ios-isolation.sh
```

Expected changed areas:

- `apps/mobile/package.json`
- `apps/mobile/package-lock.json`
- `apps/mobile/ios/**`
- generated bootstrap results under `docs/generated/ios-bootstrap-results/`

Forbidden changed area:

- `apps/mobile/android/**`

## 5. Evidence

Attach or retain:

- `docs/generated/ios-bootstrap-results/environment.txt`
- `docs/generated/ios-bootstrap-results/xcodebuild-simulator.log`
- output of `verify-ios-isolation.sh`
- completed result record based on `IOS_MACOS_BOOTSTRAP_RESULT_TEMPLATE.md`

## Failure rules

- Xcode below 26: stop and upgrade Xcode.
- Android path dirty: stop; do not reset or copy files automatically.
- Capacitor major mismatch: stop and align versions deliberately.
- `npx cap add ios` failure: keep the logs and do not retry with CocoaPods automatically.
- Simulator build failure: record the first compiler/package error before modifying generated native code.
- Signing errors during this task indicate the unsigned build flags were not applied; signing is outside this increment.

## Next gate

After a green Simulator build, the next increment is iOS permission, ATS, navigation allowlist, and privacy-manifest configuration. Physical-device signing requires Apple Developer ownership approval.
