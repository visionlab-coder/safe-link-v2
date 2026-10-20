const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs')();
const { tbmNotificationColumns, loadPendingTbms, todayTbmNotices } = load('src/lib/tbm-notifications.ts');
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
  const now = new Date('2026-10-20T15:00:00.000Z'); // Oct 21 00:00 KST, Oct 20 UTC.
  const midnightRows = [
    {id:'yesterday',published_at:'2026-10-20T14:59:59.999Z'},
    {id:'midnight',published_at:'2026-10-20T15:00:00.000Z',created_at:'2020-01-01T00:00:00Z'},
    {id:'lastMoment',published_at:'2026-10-21T14:59:59.999Z'},
    {id:'tomorrow',published_at:'2026-10-21T15:00:00.000Z'},
    {id:'legacy',published_at:null,created_at:'2026-10-20T15:00:00.000Z'},
    {id:'invalid',published_at:'invalid'},
    {id:'missing'},
  ];
  assert.deepEqual(todayTbmNotices(midnightRows, now).map(n=>n.id), ['midnight','lastMoment','legacy']);
  assert.deepEqual(todayTbmNotices(midnightRows, new Date(now.getTime()-1)).map(n=>n.id), ['yesterday']);
  assert.deepEqual(todayTbmNotices(midnightRows, new Date('2026-10-21T15:00:00Z')).map(n=>n.id), ['tomorrow']);
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
  console.log('PASS: KST midnight boundaries/expiry, 0–9 layout rules, 16 trades × 20 languages, pagination/deduplication and failure handling.');
})().catch(error => { console.error(error); process.exitCode = 1; });
