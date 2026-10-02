const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const vm = require("node:vm");
const api = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync("src/lib/tbm-chat.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: api, URLSearchParams });

test("TBM link targets the persisted sender, preserves language and return destination", () => {
  const url = new URL(api.tbmChatHref(42, "123", "km"), "http://localhost");
  assert.equal(url.pathname, "/worker/chat");
  assert.equal(url.searchParams.get("admin_id"), "42");
  assert.equal(url.searchParams.get("tbm_id"), "123");
  assert.equal(url.searchParams.get("lang"), "km");
  assert.equal(api.tbmReturnHref("today", "zh"), "/worker/tbm/today?lang=zh");
  assert.equal(api.tbmReturnHref("123", "km"), "/worker/tbm/123?lang=km");
});

test("missing/invalid sender never falls back to a different administrator", () => {
  const admins = [{ id: "3" }, { id: "42" }];
  assert.equal(api.findTbmChatAdmin(admins, "42"), admins[1]);
  for (const id of [null, undefined, "", "null", "undefined", "999", "-1", "../3"]) {
    assert.equal(api.findTbmChatAdmin(admins, id), null);
  }
  for (const id of [null, undefined, 0, "null", "-1", "../3"]) assert.equal(api.tbmChatHref(id, "today", "ko"), null);
  assert.equal(api.tbmReturnHref("https://evil.example", "ko"), null);
  assert.equal(api.tbmReturnHref("../../system", "ko"), null);
});

test("question, unavailable and return labels exist in all 20 selected languages", () => {
  for (const lang of "ko en zh vi km th id my ne bn hi uz ph mn kk ru jp fr es ar".split(" ")) {
    const labels = api.tbmChatUI(lang);
    for (const key of ["ask", "unavailable", "back"]) assert.ok(labels[key]?.trim(), `${lang}:${key}`);
    if (lang !== "en") assert.notEqual(labels.ask, api.tbmChatUI("en").ask, lang);
  }
});

test("live sender is taken from session API/events, never the previous published TBM", () => {
  const receiver = fs.readFileSync("src/components/TbmLiveReceiver.tsx", "utf8");
  assert.match(receiver, /data\.started_by/);
  assert.match(receiver, /data\.session\?\.started_by/);
  assert.match(receiver, /allowQuestions = false/); // no permission expansion on other consumers
  assert.match(receiver, /adminId=\{broadcasterId\}/);
  const page = fs.readFileSync("src/app/worker/tbm/[id]/page.tsx", "utf8");
  assert.match(page, /!liveReceiving && <TbmQuestionLink adminId=\{tbm.created_by\}/);
  assert.equal(page.match(/<TbmLiveReceiver /g).length, 1);
  assert.ok(page.indexOf("<TbmLiveReceiver ") < page.indexOf("{liveReceiving || waitingForSummary ?")); // live works before first publication
});
