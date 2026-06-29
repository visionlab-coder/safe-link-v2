#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const expected = JSON.parse(readFileSync("config/handoff-inventory.json", "utf8"));

function walk(path, predicate) {
  const files = [];
  for (const item of readdirSync(path, { withFileTypes: true })) {
    const target = join(path, item.name);
    if (item.isDirectory()) files.push(...walk(target, predicate));
    else if (predicate(target)) files.push(target);
  }
  return files;
}

const apiFiles = walk("src/app/api", (file) => file.endsWith("route.ts"));
const sourceFiles = walk("src", (file) => /\.(?:ts|tsx)$/.test(file));
const sqlFiles = walk("supabase", (file) => file.endsWith(".sql"));
let trackedMigrations;
try {
  trackedMigrations = execFileSync("git", ["ls-files", "supabase/migrations/*.sql"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).split(/\r?\n/).filter(Boolean);
} catch {
  // Official handoff archives contain Git-tracked files only, but no .git metadata.
  trackedMigrations = walk("supabase/migrations", (file) => file.endsWith(".sql"));
}
const source = sourceFiles.map((file) => readFileSync(file, "utf8")).join("\n");
const sql = sqlFiles.map((file) => readFileSync(file, "utf8")).join("\n");
const actual = {
  apiRouteFiles: apiFiles.length,
  trackedMigrationFiles: trackedMigrations.length,
  realtimeChannelCalls: (source.match(/\.channel\(\s*[`"']/g) || []).length,
  createPolicyStatements: (sql.match(/\bCREATE\s+POLICY\b/gi) || []).length,
  enableRlsStatements: (sql.match(/\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/gi) || []).length,
};
const mismatches = Object.entries(actual)
  .filter(([key, value]) => expected[key] !== value)
  .map(([key, value]) => `${key}: expected ${expected[key]}, actual ${value}`);
if (mismatches.length) {
  console.error("[source-inventory] BLOCKED");
  mismatches.forEach((message) => console.error(message));
  process.exit(1);
}
console.log(`[source-inventory] green: ${JSON.stringify(actual)}`);
