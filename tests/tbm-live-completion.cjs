const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/tbm-live-completion.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: api });
test('handoff uses only the observed session and a valid persisted notice', () => {
  assert.equal(api.matchedTbmSummary({ sessionId: 'old', tbmId: '5', text: 'old' }, 'current'), null);
  assert.equal(api.matchedTbmSummary({ sessionId: 'current', tbmId: null, text: 'text' }, 'current'), null);
  assert.equal(api.matchedTbmSummary({ sessionId: 'current', tbmId: '5', text: ' ' }, 'current'), null);
  assert.equal(api.matchedTbmSummary({ sessionId: 'current', tbmId: '5', text: '- 보호구 확인' }, 'current').tbmId, '5');
});
test('live attendee reviews translated summary then signs without replay', () => {
  const state = { liveActive: false, pending: false, liveSummary: true, summaryReady: true, summaryReviewed: true, audioFinished: false };
  assert.equal(api.canSignTbm(state), true);
  for (const change of [{liveActive: true}, {pending: true}, {summaryReady: false}, {summaryReviewed: false}]) {
    assert.equal(api.canSignTbm({...state, ...change}), false);
  }
});
test('ordinary notices still use the existing audio requirement', () => {
  const state = { liveActive: false, pending: false, liveSummary: false, summaryReady: true, summaryReviewed: true, audioFinished: false };
  assert.equal(api.canSignTbm(state), false);
  assert.equal(api.canSignTbm({...state, audioFinished: true}), true);
});
