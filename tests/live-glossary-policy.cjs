const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const assert = require("node:assert/strict");
const ts = require("typescript");
const code = ts.transpileModule(readFileSync(join(__dirname, "../src/utils/live-glossary-policy.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const mod = { exports: {} };
new Function("exports", "module", code)(mod.exports, mod);
const { canReuseLiveTranslation, hasLiveGlossaryTerm } = mod.exports;
const glossary = { 아시바: "비계", 전: "센티미터", 안전모: "안전모", 동바리: "동바리(지지대)" };
assert.equal(canReuseLiveTranslation("아시바 확인", "비계 확인", glossary), false);
assert.equal(canReuseLiveTranslation("비계 확인", "비계 확인", glossary), false);
assert.equal(canReuseLiveTranslation("안전모 착용", "안전모 착용", glossary), false);
assert.equal(canReuseLiveTranslation("안 센티미터", "안전", glossary), false);
assert.equal(canReuseLiveTranslation("안녕하세요", "안녕하세요", glossary), true);
assert.equal(hasLiveGlossaryTerm("안전하게 작업", { 전: "센티미터" }), false);
assert.equal(hasLiveGlossaryTerm("전", { 전: "센티미터" }), true);
assert.equal(hasLiveGlossaryTerm("동바리 확인", glossary), true);
console.log("8 live glossary policy checks passed");
