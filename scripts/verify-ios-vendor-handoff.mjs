#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const required = [
  ".github/workflows/ios-bootstrap.yml",
  "apps/mobile/package.json",
  "apps/mobile/package-lock.json",
  "apps/mobile/capacitor.config.ts",
  "apps/mobile/ios/App/App.xcodeproj/project.pbxproj",
  "apps/mobile/ios/App/App/App.entitlements",
  "apps/mobile/ios/App/App/Info.plist",
  "apps/mobile/ios/App/App/PrivacyInfo.xcprivacy",
  "apps/mobile/ios/App/App/SafeLinkBridgeViewController.swift",
  "apps/mobile/ios/App/App/navigation-policy.json",
  "apps/mobile/src/lib/capability/safe-link-native.ts",
  "apps/mobile/scripts/bootstrap-ios-macos.sh",
  "apps/mobile/scripts/validate-ios-security.mjs",
  "apps/mobile/scripts/test-ios-bridge-contract.mjs",
  "docs/generated/ios-bootstrap-results/environment.txt",
  "docs/generated/ios-bootstrap-results/xcodebuild-simulator.log",
  "docs/vendor-handoff/IOS_VENDOR_HANDOFF.md",
  "docs/vendor-handoff/COMMERCIALIZATION_REMAINING.md",
  "docs/vendor-handoff/HANDOFF_MANIFEST.json",
  "docs/vendor-handoff/PHYSICAL_DEVICE_ACCEPTANCE.md",
  "docs/vendor-handoff/THIRD_PARTY_DEPENDENCIES.md",
];

const errors = [];
for (const relative of required) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) errors.push(`missing required file: ${relative}`);
}

function listSourceFiles() {
  try {
    return execFileSync("git", ["ls-files"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).split(/\r?\n/).filter(Boolean);
  } catch {
    const ignoredDirectories = new Set([
      ".git",
      "node_modules",
      "dist",
      ".next",
      ".tmp",
      "DerivedData",
    ]);
    const files = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          visit(absolute);
        } else {
          files.push(path.relative(root, absolute).replaceAll("\\", "/"));
        }
      }
    };
    visit(root);
    return files;
  }
}

const tracked = listSourceFiles();

const forbiddenTracked = tracked.filter((file) =>
  /(^|\/)(\.env(?:\..*)?|.*\.(?:p12|mobileprovision|jks|keystore))$/i.test(file)
);
for (const file of forbiddenTracked) errors.push(`sensitive artifact is tracked: ${file}`);

const project = fs.readFileSync(
  path.join(root, "apps/mobile/ios/App/App.xcodeproj/project.pbxproj"),
  "utf8"
);
for (const marker of [
  "SafeLinkBridgeViewController.swift in Sources",
  "PrivacyInfo.xcprivacy in Resources",
  "navigation-policy.json in Resources",
  "CODE_SIGN_ENTITLEMENTS = App/App.entitlements;",
  "IPHONEOS_DEPLOYMENT_TARGET = 15.0;",
]) {
  if (!project.includes(marker)) errors.push(`Xcode project marker missing: ${marker}`);
}

const swift = fs.readFileSync(
  path.join(root, "apps/mobile/ios/App/App/SafeLinkBridgeViewController.swift"),
  "utf8"
);
for (const marker of [
  "AVCaptureMetadataOutputObjectsDelegate",
  "NFCNDEFReaderSessionDelegate",
  "SafeLinkNativePlugin",
  "https://safe-link-v2.vercel.app",
]) {
  if (!swift.includes(marker)) errors.push(`native implementation marker missing: ${marker}`);
}

const buildLog = fs.readFileSync(
  path.join(root, "docs/generated/ios-bootstrap-results/xcodebuild-simulator.log"),
  "utf8"
);
if (!buildLog.includes("** BUILD SUCCEEDED **")) {
  errors.push("recorded Xcode Simulator build did not succeed");
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "docs/vendor-handoff/HANDOFF_MANIFEST.json"), "utf8")
);
if (!/^[0-9a-f]{40}$/.test(manifest.iosImplementationCommit ?? "")) {
  errors.push("handoff manifest has an invalid iOS implementation commit");
}
if (manifest.sourceSecretsIncluded !== false) {
  errors.push("handoff manifest must declare sourceSecretsIncluded=false");
}
if (manifest.signedIPAIncluded !== false) {
  errors.push("handoff manifest must declare signedIPAIncluded=false");
}

if (errors.length) {
  errors.forEach((error) => console.error(`[ios-handoff] FAIL: ${error}`));
  process.exit(1);
}

console.log("[ios-handoff] PASS");
console.log(`[ios-handoff] required_files=${required.length}`);
console.log(`[ios-handoff] tracked_files=${tracked.length}`);
console.log("[ios-handoff] sensitive_tracked_files=0");
