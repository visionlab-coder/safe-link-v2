# iOS and Mobile Dependency Inventory

Versions are locked by `apps/mobile/package-lock.json` and the Xcode Swift
Package Manager resolution file.

## Runtime

- Capacitor Core 8.4.1
- Capacitor iOS 8.4.1
- Capacitor Local Notifications 8.2.0
- Capacitor Preferences 8.0.1
- React 19.2.7
- React DOM 19.2.7

## Build and development

- Capacitor CLI 8.4.1
- Capacitor Android 8.4.1
- TypeScript 5.9.3
- Vite 7.3.5
- React Vite plugin 5.2.0

## Native Apple frameworks

- AVFoundation
- Core NFC
- UIKit
- WebKit

## Resolution files

- npm: `apps/mobile/package-lock.json`
- Swift Package Manager:
  `apps/mobile/ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`
- Capacitor SPM package:
  `apps/mobile/ios/App/CapApp-SPM/Package.swift`

The vendor should run its normal open-source-license and software-composition
analysis before commercial release. No proprietary binary framework is bundled
in the iOS project.

