// Real chat UI, isolated mock backend; no production accounts, messages or microphone.
// Viewport resizing simulates the space available with a mobile keyboard open.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const root = process.cwd();
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-chat-noise-'));
for (const file of ['package.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs', 'eslint.config.mjs'])
  fs.copyFileSync(path.join(root, file), path.join(workspace, file));
fs.cpSync(path.join(root, 'src'), path.join(workspace, 'src'), {recursive: true});
for (const dir of ['node_modules', 'public']) fs.symlinkSync(path.join(root, dir), path.join(workspace, dir));

const fixture = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({id: 11, displayName: 'UI fixture', roles: ['WORKER'], siteIds: [2], preferredLanguage: 'ko'}));
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const api = `http://127.0.0.1:${fixture.address().port}`;
const origin = 'http://127.0.0.1:3112';
const frontend = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3112'], {
  cwd: workspace,
  env: {PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'development',
    SAFE_LINK_INTERNAL_API_BASE_URL: api, NEXT_PUBLIC_SAFE_LINK_API_BASE_URL: api,
    SAFE_LINK_PUBLIC_APP_URL: origin, NEXT_PUBLIC_SAFE_LINK_APP_URL: origin, NEXT_TELEMETRY_DISABLED: '1'},
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
frontend.stdout.on('data', data => { logs += data; });
frontend.stderr.on('data', data => { logs += data; });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;
try {
  for (let i = 0; i < 120 && !logs.includes('Ready in'); i++) {
    if (frontend.exitCode != null) throw new Error(logs);
    await wait(500);
  }
  assert.ok(logs.includes('Ready in'), logs);
  browser = await chromium.launch({...(process.env.SQ_TEST_CHROME ? {executablePath: process.env.SQ_TEST_CHROME} : {}), headless: true});
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  await context.addCookies([{name: 'SQ_TEST', value: 'fixture-only', url: origin}]);
  await context.addInitScript(() => {
    localStorage.setItem('sl_voice_enabled', 'false');
    // Exercise the existing STT error without requesting or recording real audio.
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => { throw new DOMException('Fixture denial', 'NotAllowedError'); },
    });
  });
  await context.route('**/api/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/me') return route.fulfill({json: {
      user: {id: '11'}, profile: {role: 'WORKER', preferred_lang: 'ko', site_id: '2'},
      v3: {id: 11, displayName: 'UI fixture', roles: ['WORKER'], siteIds: [2]},
    }});
    if (url.pathname === '/api/worker/chat/admins') return route.fulfill({json: {
      worker: {id: '11', site_id: '2', preferred_lang: 'ko'},
      admins: [{id: '10', display_name: 'TEST ADMIN', role: 'SITE_ADMIN', site_id: '2'}],
    }});
    if (url.pathname.includes('events')) return route.fulfill({status: 200, contentType: 'text/event-stream', body: ': fixture\n\n'});
    return route.fulfill({json: {messages: [], online_user_ids: [], tbms: [], active: false}});
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/worker/chat?lang=ko&admin_id=10`);
  const composer = page.getByTestId('worker-chat-composer');
  const textarea = composer.locator('textarea');
  const send = textarea.locator('..').locator('button');
  const mini = page.getByRole('button', {name: '소음 감지 open', exact: true});
  const close = page.getByRole('button', {name: '소음 감지 close', exact: true});
  await mini.waitFor({timeout: 60000});
  await textarea.fill('레이아웃 확인용 메시지 (전송하지 않음)');

  async function check(label, expanded = false) {
    await wait(350); // Let the existing Framer enter/exit animation finish.
    const hud = expanded ? close.locator('../../..') : mini;
    const [monitorBox, composerBox, sendBox] = await Promise.all([hud.boundingBox(), composer.boundingBox(), send.boundingBox()]);
    assert.ok(monitorBox && composerBox && sendBox, `${label}: visible controls`);
    assert.ok(monitorBox.y + monitorBox.height <= composerBox.y - 6, `${label}: noise monitor above composer`);
    assert.ok(monitorBox.y >= 0 && monitorBox.x >= 0, `${label}: monitor within viewport`);
    assert.ok(composerBox.y + composerBox.height <= page.viewportSize().height + 1, `${label}: composer visible`);
    assert.equal(await send.evaluate(el => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), true, `${label}: Send button receives taps`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${label}: no horizontal overflow`);
  }

  for (const [label, width, height] of [
    ['mobile', 390, 844], ['keyboard-open', 390, 430], ['small-keyboard-open', 320, 420], ['desktop', 1280, 900],
  ]) {
    await page.setViewportSize({width, height});
    await textarea.focus();
    await check(label);
    await mini.click();
    await close.waitFor();
    await check(`${label}: expanded`, true);
    if (label === 'keyboard-open') await page.screenshot({path: path.join(workspace, 'keyboard-expanded.png')});
    await close.click();
    await mini.waitFor();
  }
  await page.setViewportSize({width: 390, height: 430});
  // A taller composer must automatically lift the monitor with it (no magic pixel offset).
  await textarea.fill('첫 번째 줄\n두 번째 줄\n세 번째 줄');
  await textarea.evaluate(el => { el.style.height = '104px'; });
  await check('taller composer');
  await page.screenshot({path: path.join(workspace, 'keyboard-collapsed.png')});
  await composer.locator(':scope > button').click();
  const error = composer.getByRole('status');
  await error.waitFor();
  await check('STT error');
  const errorBox = await error.boundingBox(), miniBox = await mini.boundingBox();
  assert.ok(miniBox.y + miniBox.height <= errorBox.y, 'STT error and noise monitor do not overlap');
  assert.deepEqual(errors, []);
  console.log(`PASS: mobile/keyboard/narrow/desktop, collapsed/expanded HUD, taller composer, STT error, Send hit testing. Screenshots: ${workspace}`);
} catch (error) {
  console.error(logs.slice(-4000));
  throw error;
} finally {
  await browser?.close();
  frontend.kill('SIGTERM');
  fixture.closeAllConnections();
  await new Promise(resolve => fixture.close(resolve));
}
