const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs')();
const { koreanHelpText, withKoreanHelp } = load('src/lib/korean-help.ts');
const { workerRegistrationUI } = load('src/lib/worker-registration-ui.ts');
const { workerLoginUI } = load('src/lib/worker-login.ts');
const { QR_LANGUAGE_OPTIONS } = load('src/utils/qr/language-options.ts');

test('display helper handles Korean, identical strings, disabled scope and parameterized messages', () => {
  assert.equal(koreanHelpText('手机号码', '핸드폰번호', 'zh'), '手机号码 (핸드폰번호)');
  assert.equal(koreanHelpText('TBM', 'TBM', 'en'), 'TBM');
  assert.equal(koreanHelpText('전화번호', '전화번호', 'ko-KR'), '전화번호');
  assert.equal(koreanHelpText('Phone', '전화번호', 'en', false), 'Phone');
  const source = { greeting: name => `Hello ${name}`, id: 10, label: 'Phone' };
  const help = withKoreanHelp(source, { greeting: name => `안녕하세요 ${name}`, id: 10, label: '전화번호' }, 'en');
  assert.equal(help.greeting('KIM'), 'Hello KIM (안녕하세요 KIM)');
  assert.equal(help.id, 10);
  assert.equal(source.label, 'Phone');
  assert.equal(withKoreanHelp(source, source, 'en', false), source);
});

test('all 20 registration/login dictionaries preserve selected text and append Korean once', () => {
  assert.equal(QR_LANGUAGE_OPTIONS.length, 20);
  for (const { lang } of QR_LANGUAGE_OPTIONS) {
    for (const dictionary of [workerRegistrationUI, workerLoginUI]) {
      const selected = dictionary(lang), korean = dictionary('ko');
      const actual = withKoreanHelp(selected, korean, lang);
      for (const key of Object.keys(selected)) {
        assert.equal(actual[key], lang === 'ko' || selected[key] === korean[key] ? selected[key] : `${selected[key]} (${korean[key]})`, `${lang}/${key}`);
      }
    }
  }
});
