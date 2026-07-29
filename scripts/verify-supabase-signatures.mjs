import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const [manifestPath, sshKeyPath, sshTarget, container, bucket] =
  process.argv.slice(2);
if (!manifestPath || !sshKeyPath || !sshTarget || !container || !bucket) {
  throw new Error(
    "usage: node scripts/verify-supabase-signatures.mjs <manifest> <ssh-key> <ssh-target> <container> <bucket>",
  );
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
let verified = 0;
for (const item of manifest) {
  const result = spawnSync(
    "ssh",
    [
      "-i",
      sshKeyPath,
      "-o",
      "BatchMode=yes",
      sshTarget,
      "sudo",
      "docker",
      "exec",
      container,
      "mc",
      "cat",
      `local/${bucket}/${item.objectKey}`,
    ],
    { encoding: "buffer", maxBuffer: 10 * 1024 * 1024 },
  );
  if (result.status !== 0) {
    throw new Error(`download failed for ${item.objectKey}`);
  }
  const actualHash = createHash("sha256").update(result.stdout).digest("hex");
  if (actualHash !== item.sha256 || result.stdout.length !== item.byteSize) {
    throw new Error(`object verification failed for ${item.objectKey}`);
  }
  verified += 1;
}

console.log(JSON.stringify({ verified }));
