const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/english-name.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText, {exports:exportsObject});
const {isEnglishName, normalizeEnglishName, englishNameUI, filterEnglishNameInput} = exportsObject;
test('input rejects non-English scripts, digits and emoji without transliterating', () => {
  assert.equal(filterEnglishNameInput('HONG홍길동中文ខ្មែរ123😀'), 'HONG');
  assert.equal(filterEnglishNameInput('홍길동'), '');
  assert.equal(filterEnglishNameInput("Anne-Marie O'Neill Jr."), "Anne-Marie O'Neill Jr.");
  assert.equal(filterEnglishNameInput('A'.repeat(81)), 'A'.repeat(80));
});
test('Roman names only; original-script input is not silently stripped', () => {
  for (const name of ['HONG GILDONG', "O\u0027NEILL", 'HJ.JONG', 'JEAN-PIERRE']) assert.equal(isEnglishName(name),true);
  for (const name of ['', '홍길동', '김 (KIM)', 'Nguyễn', 'A123', 'A\nB', 'A'.repeat(81)]) assert.equal(isEnglishName(name),false,name);
  assert.equal(normalizeEnglishName(' hong  gildong '), 'HONG GILDONG');
});
test('all 20 supported languages have dedicated name labels and notices', () => {
  const constants = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/constants/index.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:constants});
  assert.equal(constants.languages.length,20);
  for (const {code:lang} of constants.languages) {
    const ui = englishNameUI(lang);
    assert.equal(Object.keys(ui).length,5);
    assert.ok(ui.help.includes('A–Z'),lang);
    for (const text of Object.values(ui)) assert.ok(text.trim(),lang);
    if (lang !== 'en') assert.notEqual(ui.label,englishNameUI('en').label,lang);
    if (lang !== 'ko') assert.equal(/[가-힣]/.test(Object.values(ui).join('')),false,lang);
  }
});
