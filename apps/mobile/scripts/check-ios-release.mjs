import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const mobileRoot = path.resolve(path.dirname(scriptPath), "..");
const configPath =
  process.env.SAFE_LINK_IOS_RELEASE_CONFIG ||
  path.join(mobileRoot, "ios", "release.local.xcconfig");

const requiredKeys = [
  "SAFE_LINK_IOS_BUNDLE_ID",
  "SAFE_LINK_IOS_APP_NAME",
  "SAFE_LINK_IOS_APP_LINK_HOST",
  "SAFE_LINK_IOS_VERSION",
  "SAFE_LINK_IOS_BUILD",
  "SAFE_LINK_IOS_TEAM_ID"
];

function readXcconfig(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const result = new Map();
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.replace(/\/\/.*$/, "").trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.+)$/);
    if (!match) {
      continue;
    }

    result.set(match[1], match[2].trim().replace(/^["']|["']$/g, ""));
  }

  return result;
}

function visibleState(value) {
  return value ? "SET" : "MISSING";
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

const config = readXcconfig(configPath);

console.log("iOS release readiness");
console.log(`- config: ${fs.existsSync(configPath) ? "SET" : "MISSING"}`);

if (!config) {
  fail(
    "\nMissing apps/mobile/ios/release.local.xcconfig. Copy release.local.xcconfig.example and fill company Apple values."
  );
  process.exit();
}

for (const key of requiredKeys) {
  console.log(`- ${key}: ${visibleState(config.get(key))}`);
}

const errors = [];
const bundleId = config.get("SAFE_LINK_IOS_BUNDLE_ID") || "";
const appName = config.get("SAFE_LINK_IOS_APP_NAME") || "";
const appLinkHost = config.get("SAFE_LINK_IOS_APP_LINK_HOST") || "";
const version = config.get("SAFE_LINK_IOS_VERSION") || "";
const build = config.get("SAFE_LINK_IOS_BUILD") || "";
const teamId = config.get("SAFE_LINK_IOS_TEAM_ID") || "";

for (const key of requiredKeys) {
  if (!config.get(key) || config.get(key)?.includes("<")) {
    errors.push(`${key} is missing or still contains a placeholder.`);
  }
}

if (!/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9][A-Za-z0-9-]*)+$/.test(bundleId)) {
  errors.push("SAFE_LINK_IOS_BUNDLE_ID must be a reverse-DNS bundle id.");
}

if (bundleId.endsWith(".dev") || bundleId === "kr.co.safelink.mobile.dev") {
  errors.push("SAFE_LINK_IOS_BUNDLE_ID is still the development bundle id.");
}

if (/dev|test/i.test(appName)) {
  errors.push("SAFE_LINK_IOS_APP_NAME still looks like a test app name.");
}

if (
  !appLinkHost ||
  /^https?:\/\//i.test(appLinkHost) ||
  appLinkHost.includes(":") ||
  appLinkHost === "app-test.safe-link.co.kr" ||
  appLinkHost === "localhost"
) {
  errors.push("SAFE_LINK_IOS_APP_LINK_HOST must be a production host without protocol, port, or test value.");
}

if (!/^\d+(\.\d+){1,2}$/.test(version)) {
  errors.push("SAFE_LINK_IOS_VERSION must look like 1.0 or 1.0.0.");
}

if (!/^[1-9]\d*$/.test(build)) {
  errors.push("SAFE_LINK_IOS_BUILD must be a positive integer.");
}

if (!/^[A-Z0-9]{10}$/.test(teamId)) {
  errors.push("SAFE_LINK_IOS_TEAM_ID must be the 10-character Apple Team ID.");
}

const entitlementPath = path.join(mobileRoot, "ios", "App", "App", "App.entitlements");
if (!fs.existsSync(entitlementPath)) {
  errors.push("App.entitlements is missing.");
}

const infoPlistPath = path.join(mobileRoot, "ios", "App", "App", "Info.plist");
const infoPlist = fs.existsSync(infoPlistPath) ? fs.readFileSync(infoPlistPath, "utf8") : "";
for (const key of ["NSCameraUsageDescription", "NSMicrophoneUsageDescription"]) {
  if (!infoPlist.includes(`<key>${key}</key>`)) {
    errors.push(`${key} is missing from Info.plist.`);
  }
}

if (errors.length > 0) {
  fail(`\nRelease readiness failed:\n- ${errors.join("\n- ")}`);
} else {
  console.log("\nRelease readiness passed.");
}
