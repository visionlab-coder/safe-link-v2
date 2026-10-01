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
