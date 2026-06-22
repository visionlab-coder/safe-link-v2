# SAFE-LINK V2 iOS Worktree Baseline

- Created: 2026-06-23
- Branch: `codex/ios-bootstrap-20260623`
- Worktree: `C:\tmp\SAFE-LINK-V2-ios`
- Provisional base SHA: `c228ac05cddbe70fc4d6cab0f82b8fd702bd76e4`
- Status: isolated and clean at creation

## Baseline qualification

This is a provisional isolation baseline, not the final Android release baseline.

The source worktree still contains untracked Android Gradle, resource, test, and wrapper files. Those files are intentionally absent from this worktree because they are not committed. Before the first shared mobile configuration change or iOS implementation commit:

1. Confirm Claude's final Android checkpoint commit.
2. Update this branch to that commit by rebase or fast-forward where possible.
3. Re-run the protected-path check below.
4. Do not copy untracked Android files into this worktree manually.

## Protected paths

The iOS track must not modify:

- `apps/mobile/android/**`
- Android build scripts
- shared web application code without an explicit interface requirement
- production API, database, authentication, or RLS code

Conditional shared paths:

- `apps/mobile/package.json`
- `apps/mobile/package-lock.json`
- `apps/mobile/capacitor.config.ts`

Changes to conditional paths must be isolated in a dedicated commit and followed by Android regression verification.

## Completed increment

`IOS-001A — macOS bootstrap command and verification package`

Prepared:

- `apps/mobile/scripts/bootstrap-ios-macos.sh`
- `apps/mobile/scripts/verify-ios-isolation.sh`
- `docs/generated/IOS_MACOS_BOOTSTRAP_GUIDE_20260623.md`
- `docs/generated/IOS_MACOS_BOOTSTRAP_RESULT_TEMPLATE.md`

The bootstrap defaults to read-only `--check`. Explicit `--apply` installs the aligned Capacitor iOS package, creates the Swift Package Manager project, and performs an unsigned Simulator build. Android path guards run before and after generation.

Actual iOS project generation and Xcode build remain macOS-only and are not claimed as executed on Windows.

## Next READY

`IOS-001B — incorporate the final Android checkpoint and execute the macOS bootstrap`

Gate:

- Claude's Android native files must be committed.
- A Mac with Xcode 26+ must be available.
- The final Android commit SHA must be supplied as `IOS_ANDROID_BASE_SHA`.

## Verification commands

```powershell
git status --short
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git diff --name-only c228ac05cddbe70fc4d6cab0f82b8fd702bd76e4...HEAD -- apps/mobile/android
```
