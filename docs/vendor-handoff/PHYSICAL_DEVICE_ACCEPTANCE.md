# Physical Device Acceptance Checklist

Record device model, iOS version, build number, tester, date, and evidence for
each item.

## Installation

- [ ] Signed build installs without manual profile errors.
- [ ] App launches after device restart.
- [ ] Production HTTPS web application loads.
- [ ] Offline startup shows the recovery page instead of a blank screen.

## Authentication and primary flows

- [ ] Administrator login succeeds.
- [ ] Worker login succeeds.
- [ ] Session survives normal app background/foreground transition.
- [ ] Logout removes the active session.
- [ ] TBM creation/broadcast works.
- [ ] Worker TBM acknowledgment and signature work.
- [ ] Live interpretation works on two physical devices.
- [ ] 1:1 translated conversation works on two physical devices.

## Native permissions

- [ ] Camera prompt appears only when scanning is requested.
- [ ] Microphone prompt appears only when audio is requested.
- [ ] Permission denial shows a recoverable message.
- [ ] Re-enabling permission in Settings restores the feature.

## QR

- [ ] Allowed SAFE-LINK QR opens/returns the expected worker or site result.
- [ ] External HTTPS QR is rejected.
- [ ] HTTP QR is rejected.
- [ ] Duplicate scans do not trigger repeated actions.
- [ ] Cancel and background transitions stop the camera.

## NFC

- [ ] Supported SAFE-LINK NDEF URI tag is read.
- [ ] Unsupported payload is rejected.
- [ ] Locked/unavailable NFC state returns a recoverable error.
- [ ] Cancel and timeout are handled.
- [ ] Background transition ends the active reader session.

## Security and navigation

- [ ] External links open in the system browser.
- [ ] Non-allowlisted origins do not remain inside the app WebView.
- [ ] HTTP/mixed-content navigation is blocked.
- [ ] No access token, refresh token, cookie, or password appears in device logs.

## Release evidence

- [ ] Xcode build/archive log retained.
- [ ] TestFlight build number recorded.
- [ ] Crash-free smoke test completed.
- [ ] App Store privacy answers reviewed against actual data flows.
- [ ] Known limitations and accepted risks signed off.

