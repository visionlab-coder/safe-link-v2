// 페이지의 i18n 객체에 누락된 언어 자동 생성 + 콘솔 출력 (paste 용).
// 사용법: node scripts/generate-missing-translations.mjs <page-path> <base-lang>
import dotenv from "dotenv";
import fs from "fs";
dotenv.config({ path: ".env.local" });

const API_KEY = process.env.GOOGLE_CLOUD_API_KEY?.trim();
if (!API_KEY) { console.error("❌ GOOGLE_CLOUD_API_KEY missing"); process.exit(1); }

const PAGE = process.argv[2];
const BASE = process.argv[3] ?? "ko";

if (!PAGE) {
  console.error("Usage: node generate-missing-translations.mjs <page-path> [base-lang=ko]");
  process.exit(1);
}

const MISSING_LANGS = [
  { code: "uz", g: "uz" },
  { code: "ph", g: "tl" },
  { code: "km", g: "km" },
  { code: "mn", g: "mn" },
  { code: "my", g: "my" },
  { code: "ne", g: "ne" },
  { code: "bn", g: "bn" },
  { code: "kk", g: "kk" },
  { code: "ru", g: "ru" },
  { code: "jp", g: "ja" },
];

const text = fs.readFileSync(PAGE, "utf8");

// 'ko: { ... }' 객체 추출 — 중괄호 균형
const baseStart = text.indexOf(`${BASE}: {`);
if (baseStart === -1) { console.error(`❌ ${BASE} 객체 미발견`); process.exit(1); }
let depth = 0;
let i = baseStart + BASE.length + 2;
let bodyStart = i;
while (i < text.length) {
  if (text[i] === "{") depth++;
  else if (text[i] === "}") { if (depth === 0) break; depth--; }
  i++;
}
const body = text.slice(bodyStart, i);

// key: "value" 쌍 추출
const kv = [...body.matchAll(/(\w+)\s*:\s*["'`]([^"'`]+)["'`]/g)];
console.error(`\n📖 ${BASE} 객체에서 ${kv.length}개 키 추출:`);
for (const [, k, v] of kv) console.error(`   ${k}: "${v}"`);

async function translate(q, src, tgt) {
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q, source: src, target: tgt, format: "text" }),
  });
  const data = await res.json();
  return data.data?.translations?.[0]?.translatedText ?? q;
}

const baseG = BASE === "ko" ? "ko" : BASE === "jp" ? "ja" : BASE;

console.error("\n🌐 누락 10개 언어 번역 중…\n");

for (const { code, g } of MISSING_LANGS) {
  const obj = {};
  for (const [, k, v] of kv) {
    obj[k] = await translate(v, baseG, g);
  }
  // JS 객체 리터럴 형식으로 출력
  console.log(`  ${code}: {`);
  const lines = Object.entries(obj).map(([k, v]) => `    ${k}: "${v.replace(/"/g, '\\"')}",`);
  console.log(lines.join("\n"));
  console.log(`  },`);
  console.error(`   ✅ ${code} 완료`);
}

console.error("\n📌 위 출력을 페이지의 i18n 객체에 paste 하세요.");
