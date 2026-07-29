import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [snapshotPath, outputRoot, batchId] = process.argv.slice(2);
if (!snapshotPath || !outputRoot || !batchId) {
  throw new Error(
    "usage: node scripts/extract-supabase-signatures.mjs <snapshot.json> <output-root> <batch-id>",
  );
}

const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const inputs = [
  {
    table: "tbm_ack",
    directory: "tbm-signatures",
    records: snapshot.tables?.tbm_ack ?? [],
  },
  {
    table: "claim13_pledges",
    directory: "pledge-signatures",
    records: snapshot.tables?.claim13_pledges ?? [],
  },
];

const manifest = [];
for (const input of inputs) {
  const targetDirectory = path.join(
    outputRoot,
    "legacy",
    "supabase",
    `batch-${batchId}`,
    input.directory,
  );
  await mkdir(targetDirectory, { recursive: true, mode: 0o700 });

  for (const record of input.records) {
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)$/.exec(
      record.signature_data ?? "",
    );
    if (!match) {
      throw new Error(`${input.table}:${record.id}: invalid PNG data URI`);
    }

    const bytes = Buffer.from(match[1], "base64");
    if (
      bytes.length === 0 ||
      !bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
    ) {
      throw new Error(`${input.table}:${record.id}: invalid PNG signature`);
    }

    const fileName = `${record.id}.png`;
    const filePath = path.join(targetDirectory, fileName);
    await writeFile(filePath, bytes, { mode: 0o600 });
    manifest.push({
      sourceTable: input.table,
      sourceId: record.id,
      objectKey: path.posix.join(
        "legacy",
        "supabase",
        `batch-${batchId}`,
        input.directory,
        fileName,
      ),
      byteSize: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
}

await writeFile(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  { mode: 0o600 },
);

console.log(
  JSON.stringify({
    outputRoot,
    signatureCount: manifest.length,
    totalBytes: manifest.reduce((sum, item) => sum + item.byteSize, 0),
  }),
);
