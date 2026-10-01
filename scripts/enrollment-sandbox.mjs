// Separate local processes, no production deployment, no .env edits, no DB copies.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(["PATH", "HOME", "TMPDIR", "USER", "LANG"].filter(k => process.env[k]).map(k => [k, process.env[k]]));
const mode = process.argv[2];
let child;
if (mode === "backend") {
  env.JAVA_HOME = process.env.JAVA_HOME || "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home";
  child = spawn("./gradlew", ["enrollmentSandbox", "--console=plain"], { cwd: path.join(root, "backend"), env, stdio: "inherit" });
} else if (mode === "frontend") {
  Object.assign(env, {
    SQ_ENROLLMENT_SANDBOX: "1",
    SAFE_LINK_INTERNAL_API_BASE_URL: "http://127.0.0.1:18081",
    NEXT_PUBLIC_SAFE_LINK_API_BASE_URL: "http://127.0.0.1:18081",
    SAFE_LINK_PUBLIC_APP_URL: "http://127.0.0.1:3100",
    NEXT_PUBLIC_SAFE_LINK_APP_URL: "http://127.0.0.1:3100",
  });
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], { cwd: root, env, stdio: "inherit" });
} else {
  throw new Error("Usage: node scripts/enrollment-sandbox.mjs backend|frontend");
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => process.exit(code ?? 1));
