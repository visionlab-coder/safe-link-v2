// Isolated real-page UI regression: no production DB, accounts, audio provider or credentials.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const root = process.cwd();
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-tbm-handoff-'));
for (const file of ['package.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs', 'eslint.config.mjs'])
  fs.copyFileSync(path.join(root, file), path.join(workspace, file));
fs.cpSync(path.join(root, 'src'), path.join(workspace, 'src'), { recursive: true });
for (const dir of ['node_modules', 'public']) fs.symlinkSync(path.join(root, dir), path.join(workspace, dir));
const clients = new Set();
let active = false, published = false, summaryAvailable = false, signCount = 0;
const sessionId = 'tbm_browser_fixture';
const summary = { sessionId, tbmId: '909', text: '- 보호구 확인\n- 위험 발생 시 작업 중지' };
const notice = {id: '909', site_id: '2', created_by: '10', content_ko: '보호구를 착용하고 위험하면 작업을 멈추세요.', summary_ko: summary.text, created_at: new Date().toISOString()};
const fixture = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const send = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
  if (url.pathname.endsWith('/auth/me')) return send({id: 11, displayName: 'UI fixture', roles: ['WORKER'], siteIds: [2], preferredLanguage: 'zh'});
  if (url.pathname.endsWith('/auth/csrf')) return send({token: 'fixture-only'});
  if (url.pathname.endsWith('/live/events')) {
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache'});
    res.write('event: connected\ndata: {}\n\n'); clients.add(res);
    res.on('close', () => clients.delete(res)); return;
  }
  if (url.pathname.endsWith('/live/sessions')) return send({active, session: active ? {session_id: sessionId, started_by: '10'} : null});
  if (url.pathname.endsWith('/live/summary')) return send(summaryAvailable ? {summary} : {});
  if (url.pathname.endsWith('/tbm/compat/today')) return send({tbms: published ? [notice] : []});
  if (url.pathname.endsWith('/tbm/compat/sign')) {
    if (req.method === 'POST') { signCount++; return send({ok: true}); }
    return send({signed: false});
  }
  send({});
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const api = `http://127.0.0.1:${fixture.address().port}`;
const origin = 'http://127.0.0.1:3111';
const frontend = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3111'], {
  cwd: workspace,
  env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'development',
    SAFE_LINK_INTERNAL_API_BASE_URL: api, NEXT_PUBLIC_SAFE_LINK_API_BASE_URL: api,
    SAFE_LINK_PUBLIC_APP_URL: origin, NEXT_PUBLIC_SAFE_LINK_APP_URL: origin, NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
frontend.stdout.on('data', data => { logs += data; });
frontend.stderr.on('data', data => { logs += data; });
const emit = (name, data) => { for (const res of clients) res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`); };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;
try {
  for (let i = 0; i < 60; i++) {
    if (logs.includes('Ready in')) break;
    if (frontend.exitCode != null) throw new Error(logs);
    await wait(500);
  }
  browser = await chromium.launch({...(process.env.SQ_TEST_CHROME ? {executablePath: process.env.SQ_TEST_CHROME} : {}), headless: true});
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  await context.addCookies([{name: 'SQ_TEST', value: 'fixture-only', url: origin}]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let translationFails = true;
  await context.route('**/api/translate', route => route.fulfill(translationFails
    ? {status: 503, json: {error: 'fixture_translation_failure'}}
    : {json: {translated: '- 检查防护用品\n- 发生危险时停止作业'}}));
  await page.goto(`${origin}/worker/tbm/today?lang=zh`);
  await page.getByText('今天没有简报', {exact: true}).waitFor({timeout: 60000});
  for (let i = 0; clients.size === 0 && i < 30; i++) await wait(100);
  assert.ok(clients.size > 0);
  active = true; emit('broadcast-start', {session_id: sessionId, started_by: '10'});
  await page.getByLabel('TBM live translation', {exact: true}).waitFor();
  active = false; emit('broadcast-stop', {session_id: sessionId});
  await page.getByText('正在保存最后的语音并发送摘要…', {exact: true}).waitFor();
  published = true; summaryAvailable = true;
  // Intentionally omit tbm-summary SSE: the same-page polling recovery must work.
  await page.getByRole('button', {name: '摘要翻译失败 — 重试', exact: true}).waitFor({timeout: 20000});
  const review = page.getByRole('checkbox');
  assert.equal(await review.isDisabled(), true, 'failed translation must not unlock signing');
  translationFails = false;
  await page.getByRole('button', {name: '摘要翻译失败 — 重试', exact: true}).click();
  await page.getByText('- 检查防护用品', {exact: false}).waitFor();
  await review.check();
  const submit = page.getByRole('button', {name: /确认并签名/});
  assert.equal(await submit.isEnabled(), true);
  assert.equal(await page.getByRole('button', {name: /语音播放/}).count(), 0, 'no mandatory second playback');
  assert.equal(page.url(), `${origin}/worker/tbm/today?lang=zh`, 'no exit/re-entry');
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 25, box.y + 30); await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 80, {steps: 8}); await page.mouse.up();
  await submit.click();
  await page.getByRole('heading', {name: '✓ 签名完成！', exact: true}).waitFor();
  assert.equal(signCount, 1);
  assert.deepEqual(errors, []);
  console.log('PASS: live → stop → polling recovery → translated summary retry → explicit review → signature, without navigation/replay');
} catch (error) {
  console.error(logs.slice(-6000));
  throw error;
} finally {
  await browser?.close();
  for (const res of clients) res.end();
  fixture.close();
  frontend.kill('SIGTERM');
  console.log(`Isolated build artifacts retained at ${workspace}`);
}
