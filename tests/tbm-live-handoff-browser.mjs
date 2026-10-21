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
let liveTrades = [];
let otherSessions = [];
const joinedSessions = [];
let editedDraft = null;
const participants = new Set();
const sessionId = 'tbm_browser_fixture';
const summary = { sessionId, tbmId: '909', text: '- 보호구 확인\n- 위험 발생 시 작업 중지' };
const notice = {id: '909', site_id: '2', created_by: '10', content_ko: '보호구를 착용하고 위험하면 작업을 멈추세요.', summary_ko: summary.text, created_at: new Date().toISOString()};
const fixture = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const workerId = req.headers.cookie?.includes('SQ_WORKER=late') ? 12 : 11;
  const send = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
  if (url.pathname.endsWith('/auth/me')) return send({id: workerId, displayName: 'UI fixture', roles: ['WORKER'], siteIds: [2], preferredLanguage: 'zh'});
  if (url.pathname.endsWith('/live/tbm-participation')) {
    if (req.method === 'POST') {
      let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>joinedSessions.push(JSON.parse(body).sessionId));
      if (!active) { res.statusCode = 400; return send({attended: false}); }
      participants.add(workerId); return send({attended: true});
    }
    const eligible = participants.has(workerId) && (url.searchParams.has('tbmId') ? published : !published);
    return send(eligible ? {attended: true, sessionId, tbmId: published ? '909' : ''} : {attended: false});
  }
  if (url.pathname.endsWith('/auth/csrf')) return send({token: 'fixture-only'});
  if (url.pathname.endsWith('/live/tbm-draft')) return send(editedDraft ? {draft: editedDraft} : {});
  if (url.pathname.endsWith('/live/events')) {
    res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache'});
    res.write('event: connected\ndata: {}\n\n'); clients.add(res);
    res.on('close', () => clients.delete(res)); return;
  }
  if (url.pathname.endsWith('/live/sessions')) {
    const requested=url.searchParams.get('sessionId');
    const sessions=[...(active?[{session_id:sessionId,started_by:'10',trade_types:liveTrades}]:[]),...otherSessions].filter(s=>!requested||s.session_id===requested);
    return send({active:sessions.length>0,sessions,...(sessions.length===1?{session:sessions[0]}:{})});
  }
  if (url.pathname.endsWith('/live/summary')) return send(summaryAvailable ? {summary} : {});
  if (url.pathname.endsWith('/tbm/compat/daily-trades')) return send({date:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(new Date()),selected:true,trades:['로프공']});
  if (url.pathname.endsWith('/tbm/compat/pending')) return send({tbms:published?[notice]:[],has_more:false,next_cursor:null});
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
  let fullTranslationFails = true;
  await context.route('**/api/translate', route => {
    const draftText = route.request().postDataJSON().text;
    if (draftText.startsWith('수정 테스트')) return route.fulfill({json: {translated: `修改后的内容 ${draftText.slice(-1)}`}});
    const {text} = route.request().postDataJSON();
    if (text === '안전대를 점검하세요') return route.fulfill({json: {translated: '请检查安全带。'}});
    const isSummary = text === summary.text;
    return route.fulfill((isSummary ? translationFails : fullTranslationFails)
      ? {status: 503, json: {error: 'fixture_translation_failure'}}
      : {json: {translated: isSummary ? '- 检查防护用品\n- 发生危险时停止作业' : '请穿戴防护用品，遇到危险时停止作业。'}});
  });
  await page.goto(`${origin}/worker/tbm/today?lang=zh`);
  await page.getByText('今天没有简报', {exact: true}).waitFor({timeout: 60000});
  for (let i = 0; clients.size === 0 && i < 30; i++) await wait(100);
  assert.ok(clients.size > 0);
  emit('broadcast-start', {session_id: 'tbm_stale_start', started_by: '10'});
  await wait(4000);
  assert.equal(await page.getByTestId('tbm-live-state').count(), 0, 'stale start SSE cannot override inactive server state');
  active = true; liveTrades = ['철근'];
  emit('broadcast-start', {session_id: sessionId, started_by: '10'});
  await wait(4000);
  assert.equal(await page.getByTestId('tbm-live-state').count(), 0, 'unselected trade must not auto-join');
  assert.equal(participants.has(11), false, 'unrelated live must not register attendance');
  liveTrades = ['로프공'];
  active = true; emit('broadcast-start', {session_id: sessionId, started_by: '10'});
  await page.getByLabel('TBM live translation', {exact: true}).waitFor();
  await page.getByTestId('tbm-briefing-hero').waitFor();
  await page.getByTestId('tbm-live-badge').waitFor();
  emit('translation', {id: 'fixture_line_1', session_id: sessionId, text_ko: '안전대를 점검하세요'});
  await page.getByText('请检查安全带。', {exact: true}).waitFor();
  // The first dev request may compile this API route. Keep the fixture broadcast
  // active until the join has actually reached the server before testing stop.
  for (let i = 0; !participants.has(11) && i < 150; i++) await wait(100);
  assert.equal(participants.has(11), true, 'live participant saved at server');
  await page.screenshot({path: path.join(workspace, 'live-mobile.png'), fullPage: true});
  editedDraft = {sessionId, content: '수정 테스트 1', revision: 1};
  emit('tbm-draft', editedDraft);
  await page.getByTestId('tbm-live-edited-draft').getByText('수정 테스트 1', {exact: true}).waitFor();
  await page.getByText('修改后的内容 1', {exact: true}).waitFor();
  emit('tbm-draft', {sessionId: 'tbm_other', content: '다른 방송', revision: 999});
  emit('tbm-draft', {sessionId, content: '오래된 수정', revision: 0});
  assert.equal(await page.getByText('다른 방송', {exact: true}).count(), 0);
  // A server idle timeout can be missed during mobile backgrounding or on another API instance.
  // Deliberately omit broadcast-stop SSE: polling must restore the ordinary TBM page.
  active = false;
  await page.getByText('今天没有简报', {exact: true}).waitFor();
  assert.equal(await page.getByTestId('tbm-live-state').count(), 0);
  assert.equal(await page.getByTestId('tbm-live-badge').count(), 0, 'LIVE badge only while broadcasting');
  assert.equal(await page.getByText('直播已结束。管理员发布最终 TBM 后，请查看摘要并签名。', {exact: true}).count(), 0);
  await page.screenshot({path: path.join(workspace, 'pending-mobile.png'), fullPage: true});
  // Drafts remain stored but must not force a stopped broadcast back onto the screen.
  editedDraft = {sessionId, content: '수정 테스트 2', revision: 2};
  await page.reload();
  await page.getByText('今天没有简报', {exact: true}).waitFor();
  await wait(4000);
  assert.equal(await page.getByTestId('tbm-live-state').count(), 0);
  published = true; summaryAvailable = true;
  // Intentionally omit tbm-summary SSE: the same-page polling recovery must work.
  await page.getByRole('button', {name: '摘要翻译失败 — 重试', exact: true}).waitFor({timeout: 20000});
  const review = page.getByRole('checkbox');
  assert.equal(await review.isDisabled(), true, 'failed translation must not unlock signing');
  translationFails = false;
  await page.getByRole('button', {name: '摘要翻译失败 — 重试', exact: true}).click();
  await page.getByText('检查防护用品', {exact: true}).waitFor();
  const fullText = page.getByTestId('tbm-full-transcript');
  await fullText.getByText(notice.content_ko, {exact: true}).waitFor();
  await fullText.getByRole('button', {name: '重试翻译'}).waitFor();
  await review.check();
  const submit = page.getByRole('button', {name: /确认并签名/});
  assert.equal(await submit.isEnabled(), true);
  // Full transcript failure is supplementary: summary review still unlocks signing.
  fullTranslationFails = false;
  await fullText.getByRole('button', {name: '重试翻译'}).click();
  await fullText.getByText('请穿戴防护用品，遇到危险时停止作业。', {exact: true}).waitFor();
  assert.equal(await fullText.locator('details').count(), 0, 'original must not be collapsed');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no mobile horizontal overflow');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({path: path.join(workspace, 'completed-mobile.png'), fullPage: true});
  await page.setViewportSize({width: 1280, height: 900});
  await page.screenshot({path: path.join(workspace, 'completed-desktop.png'), fullPage: true});
  await page.setViewportSize({width: 390, height: 844});
  await page.reload();
  await review.waitFor();
  assert.equal(await page.getByRole('button', {name: /语音播放/}).count(), 0, 'participation survives reload after publication');
  await review.check();
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
  const lateContext = await browser.newContext({viewport: {width: 390, height: 844}});
  await lateContext.addCookies([{name: 'SQ_WORKER', value: 'late', url: origin}]);
  await lateContext.route('**/api/translate', route => route.fulfill({json: {translated: '请穿戴防护用品，遇到危险时停止作业。'}}));
  const latePage = await lateContext.newPage();
  await latePage.goto(`${origin}/worker/tbm/909?lang=zh`);
  await latePage.getByRole('button', {name: /语音播放/}).waitFor();
  assert.equal(await latePage.getByRole('checkbox').count(), 0, 'late worker cannot bypass audio with summary review');
  await latePage.getByText('🔒 请先完整听取简报语音。', {exact: true}).waitFor();
  assert.equal(participants.has(12), false, 'finished broadcast cannot create new attendance');
  await lateContext.close();
  // Common + today's rope trade are both visible, other trades stay optional.
  published=false; summaryAvailable=false; active=true; liveTrades=['로프공']; editedDraft=null;
  otherSessions=[{session_id:'tbm_common',started_by:'12',trade_types:[]},{session_id:'tbm_rebar',started_by:'12',trade_types:['철근']}];
  await page.goto(`${origin}/worker?lang=zh`);
  await page.waitForFunction(()=>document.querySelectorAll('[data-testid="tbm-notice"]').length===2);
  const links=await page.getByTestId('tbm-notice').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
  assert.ok(links.some(h=>h.includes('broadcastSession=tbm_common')));
  assert.ok(links.some(h=>h.includes('broadcastSession='+sessionId)));
  assert.ok(!links.some(h=>h.includes('tbm_rebar')));
  await page.goto(`${origin}/worker/tbm/today?lang=zh`);
  await page.getByTestId('tbm-live-choices').waitFor();
  assert.equal(await page.getByTestId('tbm-live-state').count(),0,'never randomly choose between two live broadcasts');
  await page.getByTestId('tbm-live-choices').locator(`a[href*="broadcastSession=${sessionId}"]`).click();
  await page.getByTestId('tbm-live-state').waitFor();
  emit('broadcast-start',{session_id:'tbm_common',started_by:'12'});
  emit('translation',{id:'wrong_stream',session_id:'tbm_common',text_ko:'DO NOT MIX COMMON'});
  emit('tbm-draft',{sessionId:'tbm_common',content:'DO NOT MIX DRAFT',revision:100});
  emit('broadcast-stop',{session_id:'tbm_common'});
  emit('translation',{id:'correct_stream',session_id:sessionId,text_ko:'안전대를 점검하세요'});
  await page.getByText('请检查安全带。',{exact:true}).waitFor();
  await wait(3500);
  assert.equal(await page.getByText('DO NOT MIX COMMON',{exact:true}).count(),0);
  assert.equal(await page.getByText('DO NOT MIX DRAFT',{exact:true}).count(),0);
  assert.ok(joinedSessions.every(id=>id===sessionId),'attendance belongs only to selected broadcast');
  active=false; published=true; summaryAvailable=true;
  emit('broadcast-stop',{session_id:sessionId});
  await page.getByText('检查防护用品',{exact:true}).waitFor({timeout:20000});
  assert.equal(await page.getByTestId('tbm-live-state').count(),0,'other live broadcasts cannot replace selected summary');
  await page.getByRole('checkbox').check();
  assert.equal(await page.getByRole('button',{name:/确认并签名/}).isEnabled(),true);
  await page.screenshot({path:path.join(workspace,'concurrent-selected-summary.png'),fullPage:true});
  otherSessions=[];
  assert.deepEqual(errors, []);
  console.log('PASS: live → stop → polling recovery → summary retry + full translated/original transcript → explicit review → signature, without navigation/replay; mobile/desktop screenshots saved');
} catch (error) {
  console.error(logs.slice(-6000));
  throw error;
} finally {
  for (const res of clients) res.end();
  fixture.close();
  frontend.kill('SIGTERM');
  console.log(`Isolated build artifacts retained at ${workspace}`);
  await browser?.close();
}
