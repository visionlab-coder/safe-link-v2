const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./helpers/load-typescript.cjs')();
const { setupUI, setupLanguage, SETUP_UI_KEYS, SETUP_TRADES, displaySetupTrade, findSetupTrade } = load('src/lib/profile-setup-ui.ts');
const locales = ['ko','vi','zh','th','uz','ph','km','id','mn','my','ne','bn','kk','ru','en','jp','fr','es','ar','hi'];

test('all 20 setup locales have every rendered UI key and localized trades', () => {
  for (const lang of locales) {
    assert.equal(setupLanguage(lang), lang);
    const t = setupUI(lang);
    for (const key of SETUP_UI_KEYS) {
      assert.ok(t[key]?.trim(), `${lang}.${key}`);
      if (lang !== 'ko') assert.doesNotMatch(t[key], /[가-힣]/, `${lang}.${key}`);
    }
    for (const trade of SETUP_TRADES) {
      assert.ok(trade.label[lang], `${lang}.${trade.ko}`);
      assert.equal(displaySetupTrade(trade.ko, lang), trade.label[lang]);
      assert.equal(displaySetupTrade(`${trade.label.en} (${trade.ko})`, lang), trade.label[lang]);
      if (lang !== 'ko') assert.doesNotMatch(displaySetupTrade(trade.ko, lang), /[가-힣]/);
    }
  }
});
test('aliases, unknown language fallback, free text and exact trade matching', () => {
  assert.equal(setupUI('ja'), setupUI('jp'));
  assert.equal(setupUI('tl'), setupUI('ph'));
  assert.equal(setupUI('fil'), setupUI('ph'));
  assert.equal(setupUI('unknown'), setupUI('en'));
  assert.equal(findSetupTrade('Formwork (형틀목공)').ko, '형틀목공');
  assert.equal(displaySetupTrade('Custom task (형틀목공)', 'vi'), 'Custom task (형틀목공)');
  assert.equal(displaySetupTrade('직접 입력한 작업', 'en'), '직접 입력한 작업');
});
test('page binds shared language to all UI, not stale URL or independent dropdown state', () => {
  const page = fs.readFileSync('src/app/auth/setup/page.tsx', 'utf8');
  assert.match(page, /const language = setupLanguage\(displayLanguage\)/);
  assert.match(page, /const t = getT\(language\)/);
  assert.match(page, /persistDisplayLanguage\(event.target.value\)/);
  assert.doesNotMatch(page, /setLanguage|urlLang|계정 탈퇴|현장을 선택하세요|Phone Number|Auto-login is enabled/);
  for (const key of ['selectSite','sitePrompt','siteSelected','phoneTitle','autoEnabled','deleteAccount']) {
    assert.ok(page.includes(`t.${key}`), key);
  }
});
