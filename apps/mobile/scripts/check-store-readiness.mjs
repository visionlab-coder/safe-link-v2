import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const mobileRoot = path.resolve(path.dirname(scriptPath), "..");
const configPath =
  process.env.SAFE_LINK_STORE_READINESS_CONFIG ||
  path.join(mobileRoot, "store", "store-readiness.local.json");

const requiredFiles = [
  "ios/App/App.xcodeproj/project.pbxproj",
  "ios/App/App/Info.plist",
  "ios/App/App/App.entitlements",
  "ios/release.local.xcconfig.example",
  "android/release.local.properties.example",
  "store/ios/app-store-connect.template.md",
  "store/ios/review-notes.template.md",
  "store/ios/testflight-notes.template.md",
  "store/privacy/app-privacy-draft.md",
  "store/privacy/account-deletion-requirements.md",
  "store/shared/store-asset-inventory.md"
];

const requiredConfigFields = [
  "companyLegalName",
  "appName",
  "bundleId",
  "sku",
  "supportEmail",
  "supportUrl",
  "privacyPolicyUrl",
  "accountDeletionUrl",
  "reviewDemoAccountEmail",
  "reviewDemoSiteName"
];

function state(value) {
  if (value === true) return "SET";
  if (value === false) return "MISSING";
  if (typeof value === "string" && value.trim()) return value === "MISSING" ? "MISSING" : "SET";
  return "MISSING";
}

function isHttpsUrl(value) {
  return typeof value === "string" && /^https:\/\/[^/]+\..+/.test(value);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${filePath}: ${error.message}`);
  }
}

const errors = [];

console.log("Mobile store readiness");

for (const relativePath of requiredFiles) {
  const exists = fs.existsSync(path.join(mobileRoot, relativePath));
  console.log(`- file ${relativePath}: ${exists ? "SET" : "MISSING"}`);
  if (!exists) errors.push(`Missing ${relativePath}`);
}

const hasConfig = fs.existsSync(configPath);
console.log(`- local readiness config: ${hasConfig ? "SET" : "MISSING"}`);

if (!hasConfig) {
  errors.push("Missing apps/mobile/store/store-readiness.local.json");
} else {
  const config = readJson(configPath);

  for (const key of requiredConfigFields) {
    console.log(`- ${key}: ${state(config[key])}`);
    if (state(config[key]) === "MISSING") errors.push(`${key} is missing`);
  }

  for (const key of ["supportUrl", "privacyPolicyUrl", "accountDeletionUrl"]) {
    if (!isHttpsUrl(config[key])) errors.push(`${key} must be an HTTPS URL`);
  }

  const statusFields = [
    "reviewDemoAccountPasswordStatus",
    "reviewQrUrlStatus",
    "iphoneScreenshotsStatus",
    "appIcon1024Status"
  ];

  for (const key of statusFields) {
    console.log(`- ${key}: ${state(config[key])}`);
    if (config[key] !== "SET") errors.push(`${key} must be SET before store submission`);
  }

  const booleanFields = [
    "privacyAnswersReviewedByCompany",
    "accountDeletionFlowImplemented",
    "productionHttpsReady"
  ];

  for (const key of booleanFields) {
    console.log(`- ${key}: ${state(config[key])}`);
    if (config[key] !== true) errors.push(`${key} must be true before store submission`);
  }
}

if (errors.length > 0) {
  console.error(`\nStore readiness failed:\n- ${errors.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log("\nStore readiness passed.");
}
