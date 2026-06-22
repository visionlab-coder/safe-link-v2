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

## Next READY

`IOS-001A — macOS bootstrap command and verification package`

Prepare a deterministic macOS/Xcode 26 handoff that:

- checks Node 22+, Xcode 26+, and command line tools;
- installs `@capacitor/ios` at the same Capacitor version family;
- creates the iOS project using Swift Package Manager;
- performs an unsigned simulator build;
- records the exact build command and output;
- makes no Android path changes.

Actual iOS project generation remains macOS-only.

## Verification commands

```powershell
git status --short
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git diff --name-only c228ac05cddbe70fc4d6cab0f82b8fd702bd76e4...HEAD -- apps/mobile/android
```
