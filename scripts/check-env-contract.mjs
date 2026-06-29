#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

const contract = JSON.parse(readFileSync("config/env-contract.json", "utf8"));
const groups = ["public", "serverCore", "serverFeature", "optional", "platform"];
const names = groups.flatMap((group) => contract[group] ?? []);
const errors = [];
if (new Set(names).size !== names.length) errors.push("duplicate variable names");
for (const name of names) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(name)) errors.push(`invalid name: ${name}`);
  if (name.startsWith("NEXT_PUBLIC_") && !contract.public.includes(name)) {
    errors.push(`public variable outside public group: ${name}`);
  }
}

function walk(path) {
  const files = [];
  for (const item of readdirSync(path, { withFileTypes: true })) {
    if (["node_modules", ".next", ".open-next"].includes(item.name)) continue;
    const target = join(path, item.name);
    if (item.isDirectory()) files.push(...walk(target));
    else if ([".ts", ".tsx", ".js", ".mjs"].includes(extname(item.name))) files.push(target);
  }
  return files;
}

const discovered = new Set();
const pattern = /process\.env(?:\.([A-Z][A-Z0-9_]*)|\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\])/g;
for (const file of [...walk("src"), "next.config.ts"]) {
  for (const match of readFileSync(file, "utf8").matchAll(pattern)) {
    discovered.add(match[1] || match[2]);
  }
}
for (const name of discovered) if (!names.includes(name)) errors.push(`undocumented variable: ${name}`);
for (const name of names) if (!discovered.has(name)) errors.push(`stale contract variable: ${name}`);
if (errors.length) {
  console.error("[env-contract] BLOCKED");
  errors.forEach((error) => console.error(error));
  process.exit(1);
}
console.log(`[env-contract] green: ${names.length} variables, no values stored`);
