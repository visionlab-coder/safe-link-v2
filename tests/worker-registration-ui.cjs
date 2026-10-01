const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
function load(path) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: () => load("src/app/auth/translations.ts"),
  });
  return exports;
}
const { workerRegistrationUI, workerRegistrationLanguages } = load("src/lib/worker-registration-ui.ts");
test("all 20 languages contain complete registration, consent and error messages", () => {
  assert.equal(workerRegistrationLanguages.length, 20);
  const keys = Object.keys(workerRegistrationUI("ko"));
  for (const lang of workerRegistrationLanguages) {
    const t = workerRegistrationUI(lang);
    for (const key of keys) assert.ok(t[key]?.trim(), lang + ":" + key);
    assert.ok(t.loginHint.includes("{id}"), lang);
    if (lang !== "ko") assert.ok(!/[가-힣]/.test(Object.values(t).join("")), lang);
  }
  assert.equal(workerRegistrationUI("ja").temporary, workerRegistrationUI("jp").temporary);
});
test("temporary signup uses selected display language without a second language selector", () => {
  const page = fs.readFileSync("src/app/auth/temporary/page.tsx", "utf8");
  assert.ok(page.includes("const language = useDisplayLanguage()"));
  assert.ok(page.includes("language, consent, consentVersion"));
  assert.ok(!page.includes('name="language"'));
  assert.ok(!page.includes('form.get("language")'));
});
