#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const forbiddenFiles = tracked.filter((file) =>
  /(^|\/)(\.env(?:\..+)?|[^/]+\.(?:pem|key|p12|pfx))$/i.test(file),
);

const patterns = [
  { name: "private key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "OpenAI-style secret", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
];

const findings = [];
for (const file of tracked) {
  let size;
  try {
    size = statSync(file).size;
  } catch {
    continue;
  }
  if (size > 2 * 1024 * 1024) continue;

  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (content.includes("\0")) continue;

  for (const pattern of patterns) {
    if (pattern.regex.test(content)) findings.push(`${file}: ${pattern.name}`);
  }

  for (const token of content.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || []) {
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
      if (payload?.role === "service_role") findings.push(`${file}: Supabase service-role JWT`);
    } catch {
      // Malformed JWT-like text is handled by the other patterns or ignored.
    }
  }
}

if (forbiddenFiles.length || findings.length) {
  console.error("[repository-secrets] BLOCKED");
  for (const file of forbiddenFiles) console.error(`forbidden tracked file: ${file}`);
  for (const finding of findings) console.error(finding);
  process.exit(1);
}

console.log(`[repository-secrets] green: ${tracked.length} tracked files scanned`);
