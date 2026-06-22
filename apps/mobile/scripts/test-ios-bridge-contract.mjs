#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { validateBridgeMessage } from "./validate-ios-bridge-message.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const fixtureRoot = path.join(repoRoot, "apps/mobile/test-fixtures/ios-bridge");
const contract = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "docs/generated/ios-bridge/bridge-contract.json"), "utf8")
);

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(fixtureRoot, `${name}.json`), "utf8"));
}

const validCases = [
  ["capabilities", "https://safe-link-v2.vercel.app"],
  ["qr-result", "https://safe-link-v2.vercel.app"],
  ["nfc-result", "https://safe-link-v2.vercel.app"],
  ["secure-clear", "https://safe-link-v2.vercel.app"],
];

for (const [name, origin] of validCases) {
  const result = validateBridgeMessage({
    contract,
    trustedOrigin: origin,
    isMainFrame: true,
    message: fixture(name),
  });
  if (!result.ok) throw new Error(`${name} should pass: ${result.errors.join(", ")}`);
}

const invalidCases = [
  ["evil-origin", "https://evil.example", "trusted WebView origin is not allowed"],
  ["capabilities", "https://safe-link-v2.vercel.app", "subframe bridge messages are not allowed", false],
  ["token-exfiltration", "https://safe-link-v2.vercel.app", "sensitive field is forbidden"],
  ["external-result", "https://safe-link-v2.vercel.app", "not an allowed SAFE-LINK target"],
  ["unknown-operation", "https://safe-link-v2.vercel.app", "operation is not allowed"],
];

for (const [name, origin, expected, isMainFrame = true] of invalidCases) {
  const result = validateBridgeMessage({
    contract,
    trustedOrigin: origin,
    isMainFrame,
    message: fixture(name),
  });
  if (result.ok) throw new Error(`${name} should fail`);
  if (!result.errors.some((error) => error.includes(expected))) {
    throw new Error(`${name} missing expected error "${expected}": ${result.errors.join(", ")}`);
  }
}

console.log(`[ios-bridge-test] valid=${validCases.length} invalid=${invalidCases.length} PASS`);
