// Cloudflare Workers는 단일 정적 자산 25 MiB 한도가 있다. onnxruntime-web의
// ort-*.wasm(>25MiB)은 /lab/on-device-speech 실험 전용이라 운영엔 불필요.
// 배포 직전 .open-next/assets 에서 한도 초과 파일만 제거해 wrangler deploy 통과.
// (소스·Vercel 빌드엔 영향 없음 — CF 업로드 번들에서만 빠짐)
import { readdir, stat, rm } from "node:fs/promises";
import { join } from "node:path";

const ASSETS_DIR = join(process.cwd(), ".open-next", "assets");
const LIMIT = 25 * 1024 * 1024; // 25 MiB

async function walk(dir) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); }
    catch { return []; }
    const files = [];
    for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) files.push(...await walk(p));
        else files.push(p);
    }
    return files;
}

const files = await walk(ASSETS_DIR);
let removed = 0;
for (const f of files) {
    const { size } = await stat(f);
    if (size > LIMIT) {
        await rm(f);
        removed += 1;
        console.log(`  ✂️  removed ${(size / 1024 / 1024).toFixed(1)}MiB > 25MiB limit: ${f.replace(ASSETS_DIR, "assets")}`);
    }
}
console.log(removed
    ? `[strip-cf-assets] removed ${removed} oversized asset(s) for Cloudflare 25MiB limit (on-device wasm; experimental /lab only)`
    : "[strip-cf-assets] no oversized assets");
