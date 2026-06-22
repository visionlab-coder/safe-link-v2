// 근로자 페이지 다국어 번역 커버리지 진단:
//   - 각 페이지의 번역 객체에서 누락된 언어 코드 식별
//   - 하드코딩된 한국어 텍스트 (translation 객체 외) 식별
//   - lang === 'ko' 분기에 다른 언어 폴백 없는 곳 식별
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const REQUIRED_LANGS = ["ko", "vi", "zh", "th", "uz", "ph", "km", "id", "mn", "my", "ne", "bn", "kk", "ru", "en", "jp"];

const PAGES = [
  "src/app/auth/page.tsx",
  "src/app/auth/translations.ts",
  "src/app/qr/site/page.tsx",
  "src/app/worker/page.tsx",
  "src/app/worker/chat/page.tsx",
  "src/app/worker/live/page.tsx",
  "src/app/worker/quiz/page.tsx",
  "src/app/worker/pledge/page.tsx",
  "src/app/worker/tbm/[id]/page.tsx",
  "src/app/worker/vision/page.tsx",
];

console.log("=".repeat(85));
console.log("근로자 페이지 다국어 번역 커버리지 진단");
console.log("=".repeat(85));
console.log(`필수 언어: ${REQUIRED_LANGS.length}개 (${REQUIRED_LANGS.join(",")})`);
console.log("=".repeat(85));

const summary = [];

for (const rel of PAGES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    console.log(`\n📄 ${rel}\n   ❌ 파일 없음`);
    continue;
  }
  const text = fs.readFileSync(full, "utf8");

  // 번역 객체 추출 — `ko:` `en:` 등 key 위치
  const langKeyMatches = [...text.matchAll(/^\s+(\w{2,5}):\s*\{/gm)];
  const foundLangs = new Set();
  for (const m of langKeyMatches) {
    if (REQUIRED_LANGS.includes(m[1])) foundLangs.add(m[1]);
  }

  const missing = REQUIRED_LANGS.filter((l) => !foundLangs.has(l));

  // 하드코딩 한국어 (한글 포함, JSX text 또는 string literal)
  const koreanInlines = (text.match(/["'`][^"'`]*[가-힣]+[^"'`]*["'`]/g) ?? []).length;

  // lang === 'ko' 분기 — 다른 언어 처리 누락 의심
  const koBranches = (text.match(/lang\s*===\s*["']ko["']/g) ?? []).length;
  const langElseifs = (text.match(/lang\s*===\s*["'](?!ko)/g) ?? []).length;

  // adminLang === 'ko' 패턴
  const adminKoBranches = (text.match(/adminLang\s*===\s*["']ko["']/g) ?? []).length;

  // alert 등 시스템 메시지 한국어 하드코딩
  const koreanAlerts = (text.match(/alert\(["'`][^)]*[가-힣][^)]*["'`]\)/g) ?? []).length;

  console.log(`\n📄 ${rel}`);
  console.log(`   번역 객체: ${foundLangs.size}/${REQUIRED_LANGS.length} 언어`);
  if (missing.length > 0) {
    console.log(`   ❌ 누락: ${missing.join(", ")}`);
  } else if (foundLangs.size > 0) {
    console.log(`   ✅ 모든 필수 언어 포함`);
  }
  console.log(`   하드코딩 한국어 문자열: ${koreanInlines}개${koreanInlines > 5 ? " ⚠️" : ""}`);
  if (koBranches + adminKoBranches > 0) {
    console.log(`   lang/adminLang === 'ko' 분기: ${koBranches + adminKoBranches}개 (대비 다른 lang 분기 ${langElseifs}개)`);
    if (langElseifs < koBranches + adminKoBranches) {
      console.log(`   ⚠️  ko 분기 후 다른 언어 폴백 부족 가능 — 확인 필요`);
    }
  }
  if (koreanAlerts > 0) {
    console.log(`   ⚠️ alert() 한국어 하드코딩: ${koreanAlerts}개 — 외국인 근로자 미번역 노출`);
  }

  summary.push({ rel, foundLangs: foundLangs.size, missing: missing.length, koreanInlines, koreanAlerts });
}

// ──────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(85));
console.log("📊 종합");
console.log("=".repeat(85));
console.log(
  ["파일", "번역어 수", "누락어 수", "하드코딩 한국어", "alert 한국어"]
    .map((s, i) => s.padEnd([45, 12, 10, 18, 14][i]))
    .join("")
);
for (const s of summary) {
  console.log(
    [
      s.rel.replace("src/app/", "").replace("/page.tsx", "/page"),
      s.foundLangs.toString(),
      s.missing.toString(),
      s.koreanInlines.toString(),
      s.koreanAlerts.toString(),
    ]
      .map((x, i) => x.padEnd([45, 12, 10, 18, 14][i]))
      .join("")
  );
}

const totalMissing = summary.reduce((n, s) => n + s.missing, 0);
const totalKoreanAlerts = summary.reduce((n, s) => n + s.koreanAlerts, 0);
const totalKoreanInlines = summary.reduce((n, s) => n + s.koreanInlines, 0);

console.log("\n" + "=".repeat(85));
console.log(`총 누락 번역어: ${totalMissing}건 | 총 하드코딩 한국어: ${totalKoreanInlines}건 | 총 alert 한국어: ${totalKoreanAlerts}건`);
console.log("=".repeat(85));
