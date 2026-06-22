#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function usage() {
  console.error(
    "Usage: node scripts/validate-ios-security.mjs " +
    "--info <Info.plist> --entitlements <App.entitlements> " +
    "--privacy <PrivacyInfo.xcprivacy> --navigation <navigation-policy.json>"
  );
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith("--") || !value) return null;
    args[key.slice(2)] = value;
  }
  return args;
}

function read(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    throw new Error(`cannot read ${file}: ${error.message}`);
  }
}

function hasPlistString(xml, key, predicate = (value) => value.trim().length >= 12) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(
    new RegExp(`<key>\\s*${escaped}\\s*</key>\\s*<string>([\\s\\S]*?)</string>`, "i")
  );
  return Boolean(match && predicate(match[1]));
}

function plistBoolean(xml, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(
    new RegExp(`<key>\\s*${escaped}\\s*</key>\\s*<(true|false)\\s*/>`, "i")
  );
  return match ? match[1].toLowerCase() === "true" : null;
}

function containsPlaceholder(value) {
  return /\{\{|TODO_USER_INPUT|CHANGE_ME|PLACEHOLDER|example\.com/i.test(value);
}

function validateInfo(xml, errors) {
  for (const key of [
    "NSCameraUsageDescription",
    "NSMicrophoneUsageDescription",
    "NFCReaderUsageDescription",
  ]) {
    if (!hasPlistString(xml, key, (value) =>
      value.trim().length >= 12 && !containsPlaceholder(value)
    )) {
      errors.push(`Info.plist: missing or weak ${key}`);
    }
  }

  if (plistBoolean(xml, "NSAllowsArbitraryLoads") === true) {
    errors.push("Info.plist: NSAllowsArbitraryLoads must not be true");
  }
  if (plistBoolean(xml, "NSAllowsArbitraryLoadsInWebContent") === true) {
    errors.push("Info.plist: NSAllowsArbitraryLoadsInWebContent must not be true");
  }
}

function validateEntitlements(xml, errors) {
  const nfcKey = "com.apple.developer.nfc.readersession.formats";
  if (!new RegExp(`<key>\\s*${nfcKey.replace(/\./g, "\\.")}\\s*</key>`, "i").test(xml)) {
    errors.push(`Entitlements: missing ${nfcKey}`);
  }
  if (!/<string>\s*NDEF\s*<\/string>/i.test(xml)) {
    errors.push("Entitlements: NDEF reader format is required");
  }
  if (/application-identifier[\s\S]*\*/i.test(xml)) {
    errors.push("Entitlements: wildcard application identifier is not allowed");
  }
}

function validatePrivacy(xml, errors) {
  if (plistBoolean(xml, "NSPrivacyTracking") !== false) {
    errors.push("Privacy manifest: NSPrivacyTracking must be explicitly false");
  }
  if (!xml.includes("NSPrivacyAccessedAPICategoryUserDefaults")) {
    errors.push("Privacy manifest: UserDefaults accessed API category is required");
  }
  if (!/<string>\s*CA92\.1\s*<\/string>/i.test(xml)) {
    errors.push("Privacy manifest: UserDefaults reason CA92.1 is required");
  }
  const trackingDomains = xml.match(
    /<key>\s*NSPrivacyTrackingDomains\s*<\/key>\s*(?:<array\s*\/>|<array>([\s\S]*?)<\/array>)/i
  );
  if (!trackingDomains) {
    errors.push("Privacy manifest: NSPrivacyTrackingDomains array is required");
  } else if (trackingDomains[1] && /<string>[\s\S]*?<\/string>/i.test(trackingDomains[1])) {
    errors.push("Privacy manifest: tracking domains must be empty");
  }
}

function validateNavigation(jsonText, errors) {
  let policy;
  try {
    policy = JSON.parse(jsonText);
  } catch (error) {
    errors.push(`Navigation policy: invalid JSON (${error.message})`);
    return;
  }

  if (policy.defaultAction !== "deny") {
    errors.push("Navigation policy: defaultAction must be deny");
  }
  if (!Array.isArray(policy.allowedOrigins) || policy.allowedOrigins.length === 0) {
    errors.push("Navigation policy: allowedOrigins must be a non-empty array");
    return;
  }

  for (const origin of policy.allowedOrigins) {
    let url;
    try {
      url = new URL(origin);
    } catch {
      errors.push(`Navigation policy: invalid origin ${origin}`);
      continue;
    }
    if (url.protocol !== "https:" || url.origin !== origin) {
      errors.push(`Navigation policy: exact HTTPS origin required (${origin})`);
    }
    if (url.hostname.includes("*") || containsPlaceholder(origin)) {
      errors.push(`Navigation policy: wildcard or placeholder forbidden (${origin})`);
    }
  }

  const required = "https://safe-link-v2.vercel.app";
  if (!policy.allowedOrigins.includes(required)) {
    errors.push(`Navigation policy: required production origin missing (${required})`);
  }
  if (policy.externalLinks !== "system-browser") {
    errors.push("Navigation policy: externalLinks must be system-browser");
  }
}

const args = parseArgs(process.argv.slice(2));
if (!args?.info || !args.entitlements || !args.privacy || !args.navigation) {
  usage();
  process.exit(2);
}

const errors = [];
try {
  validateInfo(read(args.info), errors);
  validateEntitlements(read(args.entitlements), errors);
  validatePrivacy(read(args.privacy), errors);
  validateNavigation(read(args.navigation), errors);
} catch (error) {
  errors.push(error.message);
}

if (errors.length) {
  for (const error of errors) console.error(`[ios-security] FAIL: ${error}`);
  console.error(`[ios-security] ${errors.length} issue(s)`);
  process.exit(1);
}

console.log("[ios-security] PASS");
console.log(`[ios-security] info=${path.resolve(args.info)}`);
console.log(`[ios-security] entitlements=${path.resolve(args.entitlements)}`);
console.log(`[ios-security] privacy=${path.resolve(args.privacy)}`);
console.log(`[ios-security] navigation=${path.resolve(args.navigation)}`);
