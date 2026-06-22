#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..", "..", "..");
const validator = path.join(root, "apps/mobile/scripts/validate-ios-security.mjs");
const fixtures = path.join(root, "apps/mobile/test-fixtures/ios-security");

function run(name) {
  const dir = path.join(fixtures, name);
  return spawnSync(process.execPath, [
    validator,
    "--info", path.join(dir, "Info.plist"),
    "--entitlements", path.join(dir, "App.entitlements"),
    "--privacy", path.join(dir, "PrivacyInfo.xcprivacy"),
    "--navigation", path.join(dir, "navigation-policy.json"),
  ], { encoding: "utf8" });
}

const valid = run("valid");
if (valid.status !== 0) {
  console.error(valid.stdout);
  console.error(valid.stderr);
  throw new Error("valid fixture must pass");
}

const invalid = run("invalid");
if (invalid.status === 0) {
  throw new Error("invalid fixture must fail");
}

const expected = [
  "NSAllowsArbitraryLoads must not be true",
  "missing or weak NSMicrophoneUsageDescription",
  "NDEF reader format is required",
  "NSPrivacyTracking must be explicitly false",
  "defaultAction must be deny",
];
for (const text of expected) {
  if (!invalid.stderr.includes(text)) {
    console.error(invalid.stderr);
    throw new Error(`invalid fixture did not report: ${text}`);
  }
}

console.log("[ios-security-test] valid fixture PASS");
console.log("[ios-security-test] invalid fixture rejected PASS");
