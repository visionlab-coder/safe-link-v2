# SAFE-LINK V2 iOS Vendor Handoff

## Delivery identity

- Repository: `https://github.com/visionlab-coder/safe-link-v2.git`
- Branch: `codex/ios-bootstrap-20260623`
- Required commit: recorded in `HANDOFF_MANIFEST.json`
- iOS project: `apps/mobile/ios/App/App.xcodeproj`
- Package manager: Swift Package Manager
- Minimum deployment target: iOS 15.0
- Validated toolchain: Xcode 26.5, iOS Simulator SDK 26.5, Node.js 22

The vendor must start from the recorded commit. Recreating the iOS project with
`npx cap add ios` is unnecessary and may overwrite reviewed native files.

## Implemented scope

- Capacitor 8 iOS application project
- Remote SAFE-LINK HTTPS application shell
- Camera and microphone permission declarations
- Native AVFoundation QR scanner
- Native Core NFC NDEF reader
- SAFE-LINK result origin and path allowlist
- ATS arbitrary-load denial
- Privacy manifest with UserDefaults required-reason declaration
- Core NFC entitlement
- External-link system-browser routing
- Fail-closed navigation and bridge contracts
- Local mobile TypeScript/Vite build
- Unsigned iOS Simulator build on Xcode 26.5

## Not included in source delivery

These are customer/vendor account assets, not missing source files:

- Apple Developer account membership
- Distribution/development signing certificates and private keys
- App Store Connect app record
- Production Bundle ID and Team ID
- Development, Ad Hoc, or App Store provisioning profiles
- TestFlight upload credentials
- Final store screenshots, legal copy, support URL, and privacy-policy URL
- Production APNs credentials

Do not request certificate private keys over ordinary email. The preferred
process is to invite the vendor to the customer's Apple Developer and App Store
Connect teams with the minimum required role.

## First checkout

```bash
git clone https://github.com/visionlab-coder/safe-link-v2.git
cd safe-link-v2
git checkout codex/ios-bootstrap-20260623
git rev-parse HEAD

cd apps/mobile
npm ci
npm run typecheck
npm run build
npx cap sync ios
open ios/App/App.xcodeproj
```

`git rev-parse HEAD` must match `HANDOFF_MANIFEST.json`.

## Xcode setup for a physical device

1. Open `apps/mobile/ios/App/App.xcodeproj`.
2. Select target `App`.
3. Set the customer's Apple Developer `Team`.
4. Replace development Bundle ID `com.safelink.mobile.dev` with the approved
   production or staging Bundle ID.
5. Keep `Automatically manage signing` enabled unless the customer's signing
   policy requires manual profiles.
6. Confirm the `NFC Tag Reading` capability and
   `com.apple.developer.nfc.readersession.formats = NDEF`.
7. Connect an NFC-capable iPhone and run the app.
8. Test camera, microphone, QR, NFC, login, TBM, live interpretation, 1:1
   conversation, offline recovery, and external-link handling.

## Required verification

From the repository root:

```bash
node scripts/verify-ios-vendor-handoff.mjs
node apps/mobile/scripts/test-ios-security-validator.mjs
node apps/mobile/scripts/validate-ios-security.mjs \
  --info apps/mobile/ios/App/App/Info.plist \
  --entitlements apps/mobile/ios/App/App/App.entitlements \
  --privacy apps/mobile/ios/App/App/PrivacyInfo.xcprivacy \
  --navigation apps/mobile/ios/App/App/navigation-policy.json
node apps/mobile/scripts/test-ios-bridge-contract.mjs
npm run typecheck --prefix apps/mobile
npm run build --prefix apps/mobile
```

macOS:

```bash
export IOS_ANDROID_BASE_SHA=88785ad63b613e680b55f9c16c39568c2f7482e3
apps/mobile/scripts/bootstrap-ios-macos.sh --apply
```

The last command must end with `** BUILD SUCCEEDED **`.

## Vendor acceptance rule

The source is considered accepted when:

- the recorded commit is checked out;
- `npm ci`, mobile typecheck, and mobile build pass;
- Xcode resolves Swift packages;
- unsigned Simulator build passes;
- a signed build installs on the customer's test iPhone;
- QR and NFC SAFE-LINK fixtures pass on a physical device.

If a check fails, the vendor should provide the exact command, Xcode version,
first compiler/signing error, and changed-file list. A generic statement such
as "the files cannot be used" is not an actionable acceptance result.

## Architecture constraint

The app currently loads the deployed SAFE-LINK web application from:

```text
https://safe-link-v2.vercel.app
```

Changing the production domain requires updating and reviewing:

- `apps/mobile/capacitor.config.ts`
- `apps/mobile/ios/App/App/navigation-policy.json`
- `docs/generated/ios-bridge/bridge-contract.json`
- native SAFE-LINK origin validation

The mobile diagnostics bundle contains the native QR/NFC adapter. The vendor
must preserve the native plugin and adapter when integrating equivalent scan
entry points into the production remote web UI.

