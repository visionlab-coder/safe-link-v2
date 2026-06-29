#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const excludedDirectories = new Set([".git", ".next", ".open-next", "node_modules", "vendor-delivery"]);

function walk(path = ".") {
  const files = [];
  for (const item of readdirSync(path, { withFileTypes: true })) {
    if (item.isDirectory() && excludedDirectories.has(item.name)) continue;
    const target = join(path, item.name);
    if (item.isDirectory()) files.push(...walk(target));
    else files.push(relative(".", target).split(sep).join("/"));
  }
  return files;
}

let tracked;
let source = "Git-tracked";
try {
  const gitRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (resolve(gitRoot) !== resolve(".")) throw new Error("current directory is not the Git root");
  tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\0")
    .filter(Boolean);
} catch {
  tracked = walk();
  source = "archive";
}

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

console.log(`[repository-secrets] green: ${tracked.length} ${source} files scanned`);
