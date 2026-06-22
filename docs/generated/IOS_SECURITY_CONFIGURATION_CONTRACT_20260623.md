# SAFE-LINK V2 iOS Security Configuration Contract

## Required files after iOS generation

- `apps/mobile/ios/App/App/Info.plist`
- `apps/mobile/ios/App/App/App.entitlements`
- `apps/mobile/ios/App/App/PrivacyInfo.xcprivacy`
- an applied navigation policy equivalent to `ios-security-template/navigation-policy.json`

## Fail-closed requirements

- Camera, microphone and NFC usage descriptions are present and meaningful.
- ATS arbitrary loads are not enabled.
- Core NFC entitlement includes `NDEF`.
- Privacy tracking is explicitly disabled.
- UserDefaults required-reason declaration is present while Capacitor Preferences remains installed.
- WebView navigation defaults to deny.
- The production SAFE-LINK HTTPS origin is explicitly allowed.
- External links open in the system browser.
- Wildcard hosts and HTTP origins are rejected.

## Validation

Fixture regression:

```bash
node apps/mobile/scripts/test-ios-security-validator.mjs
```

Generated project:

```bash
node apps/mobile/scripts/validate-ios-security.mjs \
  --info apps/mobile/ios/App/App/Info.plist \
  --entitlements apps/mobile/ios/App/App/App.entitlements \
  --privacy apps/mobile/ios/App/App/PrivacyInfo.xcprivacy \
  --navigation apps/mobile/ios/App/App/navigation-policy.json
```

The validator does not edit generated files. A validation failure blocks device signing and TestFlight work.

## Integration note

The navigation policy JSON is an implementation contract. The native WKNavigationDelegate must enforce the same values; merely packaging the JSON file is not sufficient. Native enforcement is a later iOS-only increment after the Xcode project exists.

## Next READY

`IOS-002B — generate the native WKNavigationDelegate enforcement and permission configuration after IOS-001B produces the Xcode project.`
