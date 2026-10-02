const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync('src/app/admin/tbm/create/page.tsx', 'utf8');
const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(name, context) {
  let initializer;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(initializer, name);
  const js = ts.transpileModule(`globalThis.handler = ${initializer.getText(tree)};`, {
    compilerOptions: {target: ts.ScriptTarget.ES2022},
  }).outputText;
  vm.runInNewContext(js, context);
  return context.handler;
}
test('recording stop drains and prepares the draft summary without publishing', async () => {
  const calls = [];
  const context = {
    recordingActionRef: {current: false}, isRecording: true,
    draftRef: {current: 'source'}, finalDraftRef: {current: ''},
    setBroadcastBusy: () => {}, setIsDraining: () => {}, setLiveFinalizing: () => {},
    setBroadcastActive: () => {}, setSttError: () => {}, showBroadcastError: () => {},
    stopAndDrain: async () => calls.push('drain'),
    broadcaster: {current: {stop: async () => calls.push('stop'), complete: async () => calls.push('publish')}},
    completeLiveTbm: async () => calls.push('draft-summary'),
  };
  await handler('handleRecording', context)();
  assert.deepEqual(calls, ['drain', 'stop', 'draft-summary']);
});
test('draft summary generation never invokes final publication', async () => {
  const calls = [], values = {};
  const context = {
    draftRef: {current: 'source'}, adminSiteId: '2', AbortSignal,
    useCallback: fn => fn, summaryRequestRef: {current: 0}, summaryAttemptRef: {current: ''},
    setSummaryBusy: () => {}, setSummaryError: value => { values.error = value; },
    setSummaryText: value => { values.text = value; }, setSummarySource: value => { values.source = value; },
    setNormalizeResult: () => {}, normalizeKoAsync: async text => ({normalized: text, changes: []}),
    fetch: async (url) => { calls.push(url); return {ok: true, json: async () => ({text: '- summary'})}; },
  };
  await handler('completeLiveTbm', context)();
  assert.deepEqual(calls, ['/api/tbm/summary']);
  assert.deepEqual(values, {error: false, text: '- summary', source: 'source'});
});
test('broadcast click publishes the reviewed source and summary exactly once', async () => {
  const calls = [];
  const context = {
    isSending: false, liveCompleted: false, isRecording: false, isDraining: false, summaryBusy: false,
    liveFinalizing: true, tbmText: 'source', summarySource: 'source', summaryText: '- edited',
    setIsSending: () => {}, setBroadcastResult: () => {}, setNormalizeResult: () => {},
    setLiveCompleted: value => calls.push(['completed', value]), t: {pushSuccess: 'sent'},
    normalizeKoAsync: async text => ({normalized: text, changes: []}),
    broadcaster: {current: {syncDraft: async text => calls.push(['sync', text]), complete: async (...args) => calls.push(args)}},
    fetchHistory: async () => {}, console,
  };
  await handler('handleSendTBM', context)();
  assert.deepEqual(calls, [['sync', 'source'], ['source', '- edited'], ['completed', true]]);
});
test('editing the source regenerates a stale summary instead of silently blocking broadcast', async () => {
  const calls = [];
  const context = {
    isSending: false, liveCompleted: false, isRecording: false, isDraining: false, summaryBusy: false,
    liveFinalizing: true, tbmText: 'corrected source', summarySource: 'old source', summaryText: '- stale',
    setIsSending: () => {}, setBroadcastResult: () => {}, setNormalizeResult: () => {},
    setLiveCompleted: () => {}, t: {pushSuccess: 'sent'},
    normalizeKoAsync: async text => ({normalized: text, changes: []}),
    broadcaster: {current: {syncDraft: async text => calls.push(['sync', text]), complete: async (...args) => calls.push(args)}},
    completeLiveTbm: async () => { calls.push(['regenerate']); return '- fresh'; },
    fetchHistory: async () => {}, console,
  };
  await handler('handleSendTBM', context)();
  assert.deepEqual(calls, [['sync', 'corrected source'], ['regenerate'], ['corrected source', '- fresh']]);
});
test('an older summary response cannot overwrite a newer edit', async () => {
  const values = [];
  const context = {
    draftRef: {current: 'old'}, adminSiteId: '2', AbortSignal, useCallback: fn => fn,
    summaryRequestRef: {current: 0}, summaryAttemptRef: {current: ''},
    setSummaryBusy: () => {}, setSummaryError: () => {}, setSummaryText: value => values.push(value),
    setSummarySource: () => {}, setNormalizeResult: () => {},
    normalizeKoAsync: async text => ({normalized: text, changes: []}),
    fetch: async () => { context.draftRef.current = 'new'; return {ok: true, json: async () => ({text: '- stale'})}; },
  };
  assert.equal(await handler('completeLiveTbm', context)(), null);
  assert.deepEqual(values, []);
});
