const { test } = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("src/utils/tbm-live-broadcast.ts", "utf8");
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
  exports: exportsObject, crypto: require("node:crypto").webcrypto, AbortSignal, URLSearchParams, fetch,
});
const { TbmLiveBroadcast } = exportsObject;
test("a lost nationwide start response retries the same operation instead of conflicting with itself", async () => {
  const ids=[];
  const broadcaster=new TbmLiveBroadcast(async (url,options)=>{
    ids.push(JSON.parse(options.body).sessionId);
    if(ids.length===1) throw new Error('network_lost_after_commit');
    return {ok:true};
  });
  await assert.rejects(broadcaster.start('nationwide'));
  await broadcaster.start('nationwide');
  assert.equal(ids[0],ids[1]);
});
test("nationwide uses one HQ fan-out API with explicit confirmation, including stop, draft and final summary", async () => {
  const calls=[];
  const broadcaster=new TbmLiveBroadcast(async (url,options)=>{
    calls.push({url,...options});
    return {ok:true,json:async()=>({sessionId:JSON.parse(options.body).sessionId,tbmId:'42',text:'- 전국 요약'})};
  });
  await broadcaster.start('nationwide');
  await broadcaster.announceSpeaking();
  await broadcaster.publish('전국 발화');
  await broadcaster.syncDraft('수정된 전국 원문');
  await broadcaster.stop();
  await broadcaster.complete('수정된 전국 원문','- 전국 요약');
  assert.deepEqual(calls.map(c=>c.url),['sessions','speaking','translations','draft','stop','summary'].map(p=>'/api/tbm/nationwide/'+p));
  assert.equal(JSON.parse(calls[0].body).confirmed,true);
  assert.equal(calls[4].method,'POST');
  assert.equal(JSON.parse(calls[5].body).summary_ko,'- 전국 요약');
  assert.equal(new Set(calls.map(c=>JSON.parse(c.body).sessionId)).size,1);
});
test("draft edits preserve request order and final publication waits for the last correction", async () => {
  const calls = [];
  const broadcaster = new TbmLiveBroadcast(async (url, options) => {
    calls.push({url, ...options});
    return {ok: true, json: async () => ({sessionId: JSON.parse(options.body).sessionId, tbmId: '11', text: '- final'})};
  });
  await broadcaster.start('2');
  const first = broadcaster.syncDraft('first');
  const second = broadcaster.syncDraft('second');
  await broadcaster.stop();
  await Promise.all([first, second]);
  await broadcaster.syncDraft('corrected after stop');
  await broadcaster.complete('corrected after stop', '- final');
  assert.deepEqual(calls.filter(call => call.url.includes('/tbm-draft')).map(call => JSON.parse(call.body).content),
    ['first', 'second', 'corrected after stop']);
  assert.equal(calls.at(-1).url, '/api/live/summary');
});
test("stopping does not publish a notice; explicit publication preserves the edited summary", async () => {
  const calls = [];
  const broadcaster = new TbmLiveBroadcast(async (url, options) => {
    calls.push({url, ...options});
    return {ok: true, json: async () => ({sessionId: JSON.parse(options.body).sessionId, tbmId: '10', text: '- edited'})};
  });
  await broadcaster.start('2');
  await broadcaster.publish('full source');
  await broadcaster.stop();
  assert.equal(calls.filter(call => call.url.includes('/summary')).length, 0);
  await broadcaster.complete('full source', '- edited');
  const published = calls.filter(call => call.url.includes('/summary'));
  assert.equal(published.length, 1);
  assert.equal(JSON.parse(published[0].body).summary_ko, '- edited');
  assert.equal(JSON.parse(published[0].body).content_ko, 'full source');
});
test("publishes while active, preserves order and sends stop after final clip", async () => {
  const calls = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const broadcaster = new TbmLiveBroadcast(async (url, options) => {
    calls.push({ url, ...options });
    if (options.body && JSON.parse(options.body).text_ko === "first") await gate;
    return { ok: true };
  });
  await broadcaster.start("2");
  const first = broadcaster.publish("first");
  const second = broadcaster.publish("second");
  const stop = broadcaster.stop();
  await Promise.resolve();
  assert.equal(calls.length, 2); // session + first utterance; not waiting for recording end
  release();
  await Promise.all([first, second, stop]);
  assert.equal(JSON.parse(calls[2].body).text_ko, "second");
  assert.equal(calls[3].method, "DELETE");
  assert.match(JSON.parse(calls[0].body).sessionId, /^tbm_/);
  assert.equal(JSON.parse(calls[2].body).siteId, "2");
  await broadcaster.publish("late");
  assert.equal(calls.length, 4);
});
test("start failure does not publish, send failure does not prevent stop", async () => {
  const noSession = new TbmLiveBroadcast(async () => ({ ok: false }));
  await assert.rejects(noSession.start("2"));
  await noSession.publish("ignored");
  const methods = [];
  const broadcaster = new TbmLiveBroadcast(async (url, options) => {
    methods.push(options.method);
    return { ok: !url.includes("translations") };
  });
  await broadcaster.start("2");
  await assert.rejects(broadcaster.publish("failed"));
  await broadcaster.stop();
  assert.deepEqual(methods, ["POST", "POST", "DELETE"]);
});
test("completion stops first and retries the same summary session after a timeout", async () => {
  const calls = [];
  let summaryAttempts = 0;
  const broadcaster = new TbmLiveBroadcast(async (url, options) => {
    calls.push({ url, ...options });
    if (url.includes('/summary')) {
      if (++summaryAttempts === 1) throw new Error('network timeout');
      const body = JSON.parse(options.body);
      return { ok: true, json: async () => ({sessionId: body.sessionId, tbmId: '9', text: '- 요약'}) };
    }
    return {ok: true};
  });
  await broadcaster.start('2');
  await broadcaster.publish('last clip');
  await assert.rejects(broadcaster.complete('drained draft including library'));
  const summary = await broadcaster.complete('drained draft including library');
  assert.equal(summary.tbmId, '9');
  assert.equal(calls[2].method, 'DELETE');
  assert.deepEqual(JSON.parse(calls[3].body), JSON.parse(calls[4].body));
  assert.equal(JSON.parse(calls[4].body).content_ko, 'drained draft including library');
});
