const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = require('./helpers/load-typescript.cjs')();
const { FREE_TALK_LANGUAGES: langs, normalizeFreeTalkLanguage: normalize, isFreeTalkLanguage: allowed } = load('src/lib/free-talk-languages.ts');
const { QR_LANGUAGE_OPTIONS: sq } = load('src/utils/qr/language-options.ts');
assert.equal(Object.keys(langs).length, 20);
assert.deepEqual(Object.keys(langs), sq.map(option => normalize(option.lang)));
const backend = fs.readFileSync('backend/src/main/java/com/safelink/v3/travel/FreeTalkController.java', 'utf8');
const locales = Object.fromEntries([...backend.matchAll(/Map.entry\("([a-z]+)", "([a-z]+-[A-Z]+)"\)/g)].map(match => [match[1], match[2]]));
assert.deepEqual(Object.fromEntries(Object.entries(langs).map(([code, info]) => [code, info.stt])), locales);
for (const [code, info] of Object.entries(langs)) {
  assert.ok(info.label && info.flag && info.stt, code);
  assert.equal(normalize(info.stt), code);
  assert.equal(allowed(code), true);
}
for (const [input, expected] of [['jp','ja'],['JA-jp','ja'],['ph','tl'],['fil-PH','tl'],['tl_PH','tl']]) assert.equal(normalize(input), expected);
for (const input of ['xx', '', 'constructor', '__proto__', null, 123]) assert.equal(allowed(input), false);
console.log('Free Talk: SQ Link 20-language parity, backend speech locales, aliases and invalid-language rejection passed.');
