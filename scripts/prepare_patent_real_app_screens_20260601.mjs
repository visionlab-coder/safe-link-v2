import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REAL = path.join(ROOT, "docs", "generated", "real-screens");
const OUT = path.join(ROOT, "docs", "generated", "patent-real-app-screens-20260601");
fs.mkdirSync(OUT, { recursive: true });

for (const file of fs.readdirSync(OUT)) {
  if (file.endsWith(".png") || file.endsWith(".md")) fs.rmSync(path.join(OUT, file), { force: true });
}

const mapping = [
  ["C1", "02-admin-dashboard.png", "시스템_기본_구성_관리자대시보드"],
  ["C2", "09-nfc.png", "NFC_검증매체_관리"],
  ["C3", "09-nfc.png", "다매체_매핑_재발급_관리"],
  ["C4", "05-tbm-status.png", "TBM_세션_유효성_서명현황"],
  ["C5", "04-tbm-create.png", "위험성평가_TBM_작성"],
  ["C6", "14-live.png", "원문_번역_실시간통역"],
  ["C7", "06-chat.png", "다국어_1대1_채팅"],
  ["C8", "11-quiz.png", "퀴즈_이수_이해도확인"],
  ["C9", "05-tbm-status.png", "안전약속_전자서명_현황"],
  ["C10", "12-esg.png", "보고서_무결성_증빙"],
  ["C11", "10-qr-code.png", "QR_검증_URL"],
  ["C12", "14-live.png", "작업중지_안전신고_다국어소통"],
  ["C13", "12-esg.png", "ESG_이력집계"],
  ["C14", "04a-tbm-filled.png", "방법청구_TBM_운영흐름"],
  ["C15", "06-chat.png", "안전대화_로그_위험표현"],
];

const readme = [
  "# SAFE-LINK v2.0 특허출원용 실제 앱 화면 캡처",
  "",
  "생성일: 2026-06-01",
  "",
  "이 폴더는 도식화 이미지가 아니라 SAFE-LINK 실제 구동 화면 캡처를 청구항별로 재분류한 자료입니다.",
  "",
  "| 청구항 | 파일 | 실제 화면 | 대응 기능 |",
  "| --- | --- | --- | --- |",
];

for (const [claim, source, title] of mapping) {
  const src = path.join(REAL, source);
  if (!fs.existsSync(src)) continue;
  const destName = `${claim}_${title}.png`;
  fs.copyFileSync(src, path.join(OUT, destName));
  readme.push(`| ${claim} | ${destName} | ${source} | ${title.replaceAll("_", " ")} |`);
}

fs.writeFileSync(path.join(OUT, "README.md"), `${readme.join("\n")}\n`, "utf8");
console.log(OUT);
