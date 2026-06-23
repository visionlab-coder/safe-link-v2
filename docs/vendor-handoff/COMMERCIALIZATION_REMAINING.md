# Commercialization Work Remaining

## Customer decisions

- Legal owner of the Apple Developer account
- Production app name
- Production Bundle ID
- App Store seller name
- Support and privacy-policy URLs
- Countries/regions for release
- Internal testers and test devices
- Whether push notifications are required for the first commercial release

## Vendor implementation and release work

1. Configure customer-owned Apple signing and identifiers.
2. Produce a signed development build for physical-device verification.
3. Complete the physical-device test matrix.
4. Integrate native QR/NFC entry points into the final production UI where
   product UX requires in-app scanning.
5. Confirm final app icon, splash screen, version, and build numbers.
6. Complete App Store privacy answers and export-compliance answers.
7. Create the App Store Connect record and upload a Release archive.
8. Distribute through TestFlight and resolve device-specific defects.
9. Submit for App Review and address review feedback.

## Release blockers not solved by source code alone

- Apple account ownership and paid membership
- Signing authority and provisioning
- Real iPhone NFC verification
- Final legal/privacy declarations
- Store metadata and review approval
- Production authentication decision for native Keychain ownership

## Cost-control boundary

The vendor should not charge for:

- recreating the Capacitor iOS project;
- reimplementing the existing QR scanner;
- reimplementing the existing Core NFC NDEF reader;
- recreating ATS, privacy manifest, NFC entitlement, or navigation allowlist;
- investigating whether the project compiles on Xcode 26.5;
- writing initial iOS bootstrap or security validation scripts.

Those items are already present and verified. Vendor estimates should separate:

- account/signing setup;
- physical-device QA;
- production UI integration;
- TestFlight/App Store release work;
- optional production security and push-notification enhancements.

