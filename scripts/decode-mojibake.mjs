// Mojibake (cp1252→utf-8 깨짐) 텍스트를 한국어 원문으로 복원.
import fs from "fs";

const raw = fs.readFileSync(process.argv[2], "utf8");
// cp1252 → bytes → utf-8 디코딩
const buf = Buffer.from(raw, "latin1");
const decoded = buf.toString("utf8");
fs.writeFileSync(process.argv[2].replace(/\.[^.]+$/, "_decoded.txt"), decoded, "utf8");
console.log(decoded.slice(0, 500));
console.log("...");
console.log(`[total ${decoded.length} chars 저장 완료]`);
