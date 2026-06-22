#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";

const FORBIDDEN_KEYS = new Set([
  "access_token",
  "refresh_token",
  "authorization",
  "cookie",
  "password",
  "service_role",
  "service_role_key",
  "signature_data",
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function findForbiddenKey(value, currentPath = "$") {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = findForbiddenKey(value[i], `${currentPath}[${i}]`);
      if (found) return found;
    }
    return null;
  }
  if (!isPlainObject(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) return `${currentPath}.${key}`;
    const found = findForbiddenKey(child, `${currentPath}.${key}`);
    if (found) return found;
  }
  return null;
}

function exactOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value ? url.origin : null;
  } catch {
    return null;
  }
}

function safeLinkTarget(value, contract) {
  if (typeof value !== "string" || value.length === 0 || value.length > contract.maxResultLength) {
    return false;
  }
  try {
    const url = new URL(value);
    if (!contract.allowedResultOrigins.includes(url.origin)) return false;
    return contract.allowedResultPathPrefixes.some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
    );
  } catch {
    return false;
  }
}

export function validateBridgeMessage({ contract, trustedOrigin, isMainFrame, message }) {
  const errors = [];
  const origin = exactOrigin(trustedOrigin);
  if (!origin || !contract.allowedOrigins.includes(origin)) {
    errors.push("trusted WebView origin is not allowed");
  }
  if (isMainFrame !== true) errors.push("subframe bridge messages are not allowed");
  if (!isPlainObject(message)) return { ok: false, errors: [...errors, "message must be an object"] };
  const envelopeKeys = new Set(["version", "id", "operation", "payload"]);
  for (const key of Object.keys(message)) {
    if (!envelopeKeys.has(key)) errors.push(`unexpected envelope field: ${key}`);
  }
  if (message.version !== contract.version) errors.push("unsupported bridge version");
  if (typeof message.id !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(message.id)) {
    errors.push("id must be 8-64 URL-safe characters");
  }
  if (typeof message.operation !== "string" || !contract.operations[message.operation]) {
    errors.push("operation is not allowed");
  }
  if (!isPlainObject(message.payload)) errors.push("payload must be an object");

  const forbidden = findForbiddenKey(message);
  if (forbidden) errors.push(`sensitive field is forbidden: ${forbidden}`);

  const spec = contract.operations[message.operation];
  if (spec && isPlainObject(message.payload)) {
    const keys = Object.keys(message.payload);
    const allowedKeys = new Set(spec.payloadKeys);
    for (const key of keys) {
      if (!allowedKeys.has(key)) errors.push(`unexpected payload field: ${key}`);
    }
    if (message.operation === "qr.presentResult" || message.operation === "nfc.presentResult") {
      if (!safeLinkTarget(message.payload.value, contract)) {
        errors.push("result value is not an allowed SAFE-LINK target");
      }
    }
  }

  const serializedLength = Buffer.byteLength(JSON.stringify(message), "utf8");
  if (serializedLength > contract.maxMessageBytes) {
    errors.push(`message exceeds ${contract.maxMessageBytes} bytes`);
  }

  return { ok: errors.length === 0, errors };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith("--") || !argv[i + 1]) return null;
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args?.contract || !args.origin || !args.message || !args["main-frame"]) {
    console.error(
      "Usage: node scripts/validate-ios-bridge-message.mjs " +
      "--contract <contract.json> --origin <trusted-origin> " +
      "--main-frame true|false --message <message.json>"
    );
    process.exit(2);
  }

  const contract = JSON.parse(fs.readFileSync(args.contract, "utf8"));
  const message = JSON.parse(fs.readFileSync(args.message, "utf8"));
  const result = validateBridgeMessage({
    contract,
    trustedOrigin: args.origin,
    isMainFrame: args["main-frame"] === "true",
    message,
  });
  if (!result.ok) {
    for (const error of result.errors) console.error(`[ios-bridge] FAIL: ${error}`);
    process.exit(1);
  }
  console.log("[ios-bridge] PASS");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
