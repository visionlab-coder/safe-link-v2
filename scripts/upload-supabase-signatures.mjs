import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const [manifestPath, payloadRoot, sshKeyPath, sshTarget, container, bucket] =
  process.argv.slice(2);
if (
  !manifestPath ||
  !payloadRoot ||
  !sshKeyPath ||
  !sshTarget ||
  !container ||
  !bucket
) {
  throw new Error(
    "usage: node scripts/upload-supabase-signatures.mjs <manifest> <payload-root> <ssh-key> <ssh-target> <container> <bucket>",
  );
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
let uploaded = 0;
for (const item of manifest) {
  if (
    !/^legacy\/supabase\/batch-[0-9]+\/(?:tbm|pledge)-signatures\/[0-9a-f-]+\.png$/.test(
      item.objectKey,
    )
  ) {
    throw new Error(`unsafe object key: ${item.objectKey}`);
  }

  const bytes = await readFile(path.join(payloadRoot, item.objectKey));
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
      "-i",
      container,
      "mc",
      "pipe",
      `local/${bucket}/${item.objectKey}`,
    ],
    { input: bytes, encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(
      `upload failed for ${item.objectKey}: ${result.stderr || result.stdout}`,
    );
  }
  uploaded += 1;
}

console.log(JSON.stringify({ uploaded }));
