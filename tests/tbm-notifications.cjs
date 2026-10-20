const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs')();
const { tbmNotificationColumns, loadPendingTbms } = load('src/lib/tbm-notifications.ts');
const { tbmTradeLabel } = load('src/lib/tbm-trade-labels.ts');
const { TBM_TRADES } = load('src/lib/tbm-trades.ts');
const { QR_LANGUAGE_OPTIONS } = load('src/utils/qr/language-options.ts');

(async () => {
  assert.deepEqual(Array.from({ length: 10 }, (_, count) => tbmNotificationColumns(count)), [1,1,2,3,2,3,3,3,3,3]);
  for (const { lang } of QR_LANGUAGE_OPTIONS) {
    for (const trade of TBM_TRADES) {
      const label = tbmTradeLabel(trade, lang);
      assert.ok(label?.trim(), `${lang}/${trade}`);
      if (lang !== 'ko') assert.ok(!/[가-힣]/.test(label), `${lang}/${trade}: Korean fallback`);
    }
  }
  assert.equal(tbmTradeLabel('정리', 'ja'), tbmTradeLabel('정리', 'jp'));
  assert.equal(tbmTradeLabel('정리', 'fil-PH'), tbmTradeLabel('정리', 'ph'));
  let calls = 0;
  global.fetch = async url => {
    const query = new URL(url, 'http://fixture').searchParams;
    assert.equal(query.get('siteId'), '2');
    calls++;
    if (calls === 1) return { ok: true, json: async () => ({ tbms: [{id:'3'}, {id:'2'}], has_more:true, next_cursor:'2' }) };
    assert.equal(query.get('cursor'), '2');
    return { ok:true, json:async () => ({ tbms:[{id:'2'}, {id:'1'}], has_more:false, next_cursor:null }) };
  };
  assert.deepEqual((await loadPendingTbms('2', new AbortController().signal)).map(n => n.id), ['3','2','1']);
  global.fetch = async () => ({ ok:false });
  await assert.rejects(loadPendingTbms('2', new AbortController().signal), /unavailable/);
  global.fetch = async () => ({ ok:true, json:async () => ({ tbms:[], has_more:true, next_cursor:'1' }) });
  await assert.rejects(loadPendingTbms('2', new AbortController().signal), /cursor_invalid/);
  global.fetch = async () => ({ ok:true, json:async () => ({ tbms:[], has_more:false, next_cursor:null }) });
  assert.deepEqual(await loadPendingTbms('2', new AbortController().signal), []);
  console.log('PASS: 0–9 layout rules, 16 trades × 20 languages, language aliases, pagination/deduplication and failure handling.');
})().catch(error => { console.error(error); process.exitCode = 1; });
