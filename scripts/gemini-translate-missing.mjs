// Gemini 2.5 Flash 로 누락 언어 번역.
// Cloud Translate 보다 정확도 높음. 건설 컨텍스트 prompt 적용.
import dotenv from "dotenv";
import fs from "fs";
dotenv.config({ path: ".env.local" });

const API_KEY = process.env.GOOGLE_CLOUD_API_KEY?.trim();
if (!API_KEY) { console.error("❌ GOOGLE_CLOUD_API_KEY missing"); process.exit(1); }

const PAGE = process.argv[2];
const BASE = process.argv[3] ?? "ko";
if (!PAGE) { console.error("Usage: <page> [base=ko]"); process.exit(1); }

const MISSING = [
  { code: "uz", name: "우즈벡어 (Uzbek)" },
  { code: "ph", name: "필리핀어 (Tagalog/Filipino)" },
  { code: "km", name: "캄보디아어 (Khmer)" },
  { code: "mn", name: "몽골어 (Mongolian, 키릴 문자)" },
  { code: "my", name: "미얀마어 (Burmese)" },
  { code: "ne", name: "네팔어 (Nepali)" },
  { code: "bn", name: "방글라데시어 (Bengali)" },
  { code: "kk", name: "카자흐어 (Kazakh, 키릴 문자)" },
  { code: "ru", name: "러시아어 (Russian)" },
  { code: "jp", name: "일본어 (Japanese)" },
];

const text = fs.readFileSync(PAGE, "utf8");

// non-greedy 매칭 — 첫 번째 ko: {} 블록만 정확히 추출
const objRe = new RegExp(`${BASE}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`);
const objMatch = text.match(objRe);
if (!objMatch) { console.error(`❌ ${BASE} 객체 미발견`); process.exit(1); }
const body = objMatch[1];
const kv = [...body.matchAll(/(\w+)\s*:\s*["'`]([^"'`]+)["'`]/g)];
console.error(`📖 ${BASE} 객체에서 ${kv.length}개 키 추출`);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function geminiTranslate(items, langName) {
  // items: [{key, value}]
  const inputJson = JSON.stringify(Object.fromEntries(items));
  const prompt = `당신은 건설현장 안전 교육 UI 의 다국어 번역 전문가입니다.
다음 JSON 의 각 값을 ${langName} 로 번역하세요.

규칙 (반드시 준수):
1. 키 이름은 그대로 유지하고 값만 ${langName} 로 번역합니다.
2. 건설현장 외국인 근로자가 실제로 사용하는 자연스러운 문구로 번역합니다.
3. 건설 안전 도메인 (안전모, 안전벨트, 작업중지, 점검 등) 의 현지 일반적 표기를 사용합니다.
4. 라틴/키릴/현지 문자 등 해당 언어 표기 체계를 정확히 사용합니다.
5. 다른 언어 단어 혼입 금지. 영어/인도네시아어 단어를 그대로 두지 마세요.
6. JSON 응답만 반환합니다. 설명 / 마크다운 / 따옴표 없이 순수 JSON.

원본 (한국어):
${inputJson}

번역 (${langName} JSON):`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    }
  );
  if (!res.ok) {
    console.error(`   ❌ HTTP ${res.status}`);
    return null;
  }
  const data = await res.json();
  let textOut = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  // ```json 제거
  textOut = textOut.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(textOut);
  } catch (e) {
    console.error(`   ❌ JSON parse fail: ${e.message}`);
    console.error(`   ↳ raw: ${textOut.slice(0, 200)}…`);
    return null;
  }
}

console.error(`\n🌐 Gemini 2.5 Flash 로 ${MISSING.length}개 언어 번역 중…\n`);

for (const { code, name } of MISSING) {
  console.error(`   ▶ ${code} (${name})`);
  const items = kv.map(([, k, v]) => [k, v]);
  let obj = null;
  // rate limit (429) 대응 — 재시도 with backoff
  for (let attempt = 1; attempt <= 3; attempt++) {
    obj = await geminiTranslate(items, name);
    if (obj) break;
    console.error(`   ↻ ${code} 재시도 ${attempt}/3 (5초 대기)`);
    await sleep(5000);
  }
  if (!obj) {
    console.error(`   ❌ ${code} 최종 실패`);
    continue;
  }

  console.log(`  ${code}: {`);
  const lines = Object.entries(obj).map(
    ([k, v]) => `    ${k}: "${String(v).replace(/"/g, '\\"')}",`
  );
  console.log(lines.join("\n"));
  console.log(`  },`);
  console.error(`   ✅ ${code} 완료`);
  await sleep(2000); // 호출 사이 2초 — rate limit 회피
}

console.error("\n📌 위 출력을 페이지의 i18n 객체에 paste 하세요.");
