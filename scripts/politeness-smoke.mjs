// Q-001 검증: formalizeKo "갑시다/합시다" 보존 + 기존 변환 회귀 확인
import { formalizeKo } from "../src/utils/politeness.ts";

const cases = [
  // [입력, 기대]
  ["갑시다", "갑시다"],        // 핵심 버그: 갑시습니다 금지
  ["합시다", "합시다"],        // 합시습니다 금지
  ["빨리 갑시다", "빨리 갑시다"],
  ["같이 갑시다.", "같이 갑시다."],
  // 회귀: 기존 변환은 그대로
  ["간다", "갑니다."],
  ["가자", "갑시다."],
  ["하자", "합시다."],
  ["먹는다", "먹습니다."],
  ["시작한다", "시작합니다."],
  ["위험하다", "위험합니다."],
  ["조심해", "조심하시기 바랍니다."],
  ["없다", "없습니다."],
];

let fail = 0;
for (const [input, expected] of cases) {
  const got = formalizeKo(input);
  const ok = got === expected;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  "${input}" → "${got}"${ok ? "" : `  (기대: "${expected}")`}`);
}
console.log(`\n${cases.length - fail}/${cases.length} pass`);
process.exit(fail ? 1 : 0);
