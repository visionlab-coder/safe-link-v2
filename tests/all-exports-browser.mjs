// Read-only UI audit. All APIs and live events use local fixtures; no production
// credentials, microphone, vendor API, DB writes, or production broadcasts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium, webkit} from 'playwright-core';
import * as xlsx from 'xlsx';

const root = process.cwd();
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-all-exports-'));
for (const file of ['package.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs']) {
  fs.copyFileSync(path.join(root, file), path.join(workspace, file));
}
fs.cpSync(path.join(root, 'src'), path.join(workspace, 'src'), {recursive: true});
for (const dir of ['node_modules', 'public']) fs.symlinkSync(path.join(root, dir), path.join(workspace, dir));
const user = {id: 11, displayName: 'EXPORT TEST', roles: ['SITE_ADMIN'], siteIds: [2], preferredLanguage: 'ko'};
let fixtureSignature;
const fixture = http.createServer((req, res) => {
  // Navigation downloads can bypass Playwright's page request routing.
  // Exercise the real signature BFF with an image-returning upstream too.
  if (req.url === '/api/v1/tbm/compat/signatures/1' && fixtureSignature) {
    res.setHeader('Content-Type', 'image/png');
    res.end(fixtureSignature);
    return;
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(user));
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const port = Number(process.env.SQ_EXPORT_TEST_PORT || 3117);
const origin = `http://127.0.0.1:${port}`;
const api = `http://127.0.0.1:${fixture.address().port}`;
const frontend = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
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
const now = '2026-10-08T02:00:00Z';
const worker = {id: '21', worker_code: 'EXPORT21', full_name: 'AUDIT WORKER', display_name: 'AUDIT WORKER',
  nationality: 'KR', trade: 'formwork', preferred_lang: 'ko', site_id: '2', is_active: true, consent_signed_at: now, created_at: now};
const tbm = {id: '31', title: 'AUDIT TBM', content_ko: '안전모 착용 확인', site_name: 'AUDIT SITE', created_at: now,
  started_at: now, status: 'ended', tbm_notices: {content_ko: '안전모 착용 확인', title: 'AUDIT TBM'}};
const question = {id: '41', keyword: '안전모', question_ko: '안전모를 착용해야 합니까?', options_ko: ['예', '아니오'], answer_index: 0};
const payloads = {
  '/api/v1/auth/me': user,
  '/api/auth/me': {user: {id: '11'}, profile: {role: 'SITE_ADMIN', preferred_lang: 'ko', site_id: '2', display_name: 'EXPORT TEST'}, v3: user},
  '/api/glossary': {terms: [{id: 1, slang: '겐바', standard: '공사현장', category: '시설', is_active: true}]},
  '/api/nfc/workers': {workers: [worker]},
  '/api/admin/chat/workers': {workers: [worker]},
  '/api/chat/messages': {messages: [{id: '51', from_user: '11', to_user: '21', source_lang: 'ko', target_lang: 'ko', source_text: '안전모 착용 확인', translated_text: '안전모 착용 확인', created_at: now, is_read: true}]},
  '/api/tbm/notices': {tbms: [tbm]},
  '/api/tbm/workers': {workers: [worker]},
  '/api/tbm/ack': {acks: [{worker_id: '21', ack_at: now, signature_data: '/api/tbm/signature/1'}]},
  '/api/nfc/daily-safety-logs': {logs: [{id: '61', worker_id: '21', site_id: '2', work_date: '2026-10-08', status: 'completed', check_in_at: now, check_out_at: now, tbm_signed_at: now, attendance_summary: {tbm_count: 1, tbm_signed_count: 1, has_tbm_signature: true}, worker}]},
  '/api/quiz/tbm-sessions': {sessions: [tbm]},
  '/api/quiz/sessions': {sessions: [{id: '71', tbm_session_id: '31', status: 'sent', created_at: now, sent_at: now}]},
  '/api/quiz/generate': {questions: [question], quizSessionId: '71', source: 'tbm'},
  '/api/quiz/responses': {responses: [{id: '81', worker_id: '21', lang: 'ko', status: 'answered', score_pct: 100, submitted_at: now, answered_at: now, nfc_workers: worker}]},
  '/api/incentive/grant': {grants: []},
  '/api/sites/options': {sites: [{id: '2', name: 'AUDIT SITE', site_code: 'AUDIT2'}]},
  '/api/esg/report': {siteId: '2', period: {from: '2026-09-08', to: '2026-10-08'}, tbm: {totalSessions: 1, totalAttendance: 1, certificationRate: 1}, quiz: {avgScore: 100}, safetyEquipment: {totalGrants: 0}, stopWork: {totalIncidents: 1, resolvedCount: 1}, pledges: {totalPledges: 1, signedCount: 1, signatureRate: 1}, auditChain: {totalEvents: 1}, interpretation: {totalSessions: 1}, generatedAt: now},
};
const cases = [
  ['glossary', '/admin/glossary', '공사현장'],
  ['workers', '/admin/workers', 'AUDIT WORKER'],
  ['chat', '/admin/chat', '안전모 착용 확인'],
  ['live', '/admin/live', '안전모 착용 확인'],
  ['tbm-status', '/admin/tbm/status', 'AUDIT WORKER'],
  ['daily-logs', '/admin/nfc/daily-logs', 'AUDIT WORKER'],
  ['quiz', '/admin/quiz', '안전모를 착용해야 합니까?'],
  ['incentive', '/admin/incentive', 'AUDIT WORKER'],
  ['esg', '/admin/esg', 'TBM'],
].filter(([name]) => !process.env.SQ_AUDIT_PAGES || process.env.SQ_AUDIT_PAGES.split(',').includes(name));
const results = [];
let browser;
try {
  for (let i = 0; i < 120 && !logs.includes('Ready in'); i++) {
    if (frontend.exitCode != null) throw new Error(logs);
    await wait(500);
  }
  assert.ok(logs.includes('Ready in'), logs);
  // Compile before browser navigation (avoids development HMR reload races).
  for (const url of [...cases.map(row => row[1]), '/admin/qrcode', '/admin/team-qr', '/download']) {
    await fetch(origin + url, {headers: {cookie: 'SQ_TEST=fixture-only'}});
  }
  const isWebKit = process.env.SQ_TEST_ENGINE === 'webkit';
  browser = isWebKit ? await webkit.launch({headless: true}) : await chromium.launch({
    executablePath: process.env.SQ_TEST_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  });
  const viewports = isWebKit ? [['mobile', 390, 844, true], ['narrow', 320, 568, true]] :
    [['desktop', 1280, 900, false], ['mobile', 390, 844, true], ['narrow', 320, 568, true]];
  for (const [label, width, height, touch] of viewports) {
    if (process.env.SQ_AUDIT_VIEWPORTS && !process.env.SQ_AUDIT_VIEWPORTS.split(',').includes(label)) continue;
    const context = await browser.newContext({viewport: {width, height}, isMobile: touch, hasTouch: touch});
    await context.addCookies([{name: 'SQ_TEST', value: 'fixture-only', url: origin}]);
    await context.addInitScript(() => {
      window.open = () => { throw new Error('Unexpected export popup'); };
      window.print = () => { throw new Error('Unexpected print dialog'); };
      window.__auditEvents = [];
      window.EventSource = class extends EventTarget {
        constructor(url) { super(); this.url = url; window.__auditEvents.push(this); }
        close() { window.__auditEvents = window.__auditEvents.filter(item => item !== this); }
      };
    });
    let signatureBytes;
    const unexpected = new Set();
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin && url.origin !== api) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      if (url.pathname === '/api/tbm/signature/1') return route.fulfill({contentType: 'image/png', body: signatureBytes});
      if (payloads[url.pathname]) return route.fulfill({json: payloads[url.pathname]});
      unexpected.add(url.pathname);
      return route.fulfill({status: 404, json: {error: 'AUDIT_UNMOCKED_API'}});
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    signatureBytes = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 40;
      const pen = canvas.getContext('2d'); pen.strokeStyle = '#172554'; pen.lineWidth = 3;
      pen.beginPath(); pen.moveTo(4, 35); pen.lineTo(30, 4); pen.lineTo(20, 38); pen.lineTo(96, 9); pen.stroke();
      return canvas.toDataURL().split(',')[1];
    }), 'base64');
    fixtureSignature = signatureBytes;
    const activate = locator => touch ? locator.tap() : locator.click();
    for (const [name, url, expected] of cases) {
      const result = {engine: isWebKit ? 'webkit' : 'chrome', viewport: label, page: url, files: [], issues: []};
      results.push(result);
      const pageErrors = [];
      const errorHandler = error => pageErrors.push(error.message);
      page.on('pageerror', errorHandler);
      try {
        await page.goto(`${origin}${url}?lang=ko`);
        if (name === 'chat') await activate(page.getByRole('button', {name: /AUDIT WORKER/}).first());
        if (name === 'incentive') await activate(page.getByRole('button', {name: /퀴즈 세션/}).first());
        if (name === 'quiz') {
          await activate(page.getByRole('button', {name: /AUDIT TBM/}));
          assert.equal(await page.getByRole('button', {name: '내보내기', exact: true}).count(), 0, 'Empty quiz cannot export');
          await activate(page.getByRole('button', {name: 'AI 문제 자동 생성', exact: true}));
        }
        if (name === 'live') {
          await page.waitForFunction(() => window.__auditEvents.some(event => event.url.includes('worker-responses')));
          await page.evaluate(() => window.__auditEvents.find(event => event.url.includes('worker-responses'))
            .dispatchEvent(new MessageEvent('worker-response', {data: JSON.stringify({id: '91', sourceText: '안전모 착용 확인', translatedText: '안전모 착용 확인'})})));
        }
        const trigger = page.getByRole('button', {name: '내보내기', exact: true});
        await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === '내보내기' && !button.disabled));
        const menu = page.getByRole('menu', {name: '내보내기', exact: true});
        await activate(trigger);
        await menu.waitFor();
        const hits = await menu.getByRole('menuitem').evaluateAll(items => items.map(item => {
          const r = item.getBoundingClientRect();
          const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return {format: item.textContent, hit: item.contains(top), withinWidth: r.left >= 0 && r.right <= innerWidth,
            withinHeight: r.top >= 0 && r.bottom <= innerHeight, coveringClass: item.contains(top) ? null : top?.className};
        }));
        await page.screenshot({path: path.join(workspace, `${label}-${name}.png`)});
        // A long page may place a menu near the bottom. Ordinary page scrolling
        // is allowed; do not misreport an off-screen item as banner obstruction.
        for (const hit of hits.filter(item => !item.hit && !item.withinHeight && item.withinWidth)) {
          const item = menu.getByRole('menuitem', {name: hit.format, exact: true});
          await item.scrollIntoViewIfNeeded();
          hit.hit = await item.evaluate(el => {
            const r = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          });
          hit.scrollRequired = true;
        }
        result.menu = hits;
        if (hits.some(hit => !hit.hit || !hit.withinWidth)) {
          result.issues.push('Export menu obscured or outside viewport; normal download not tested');
        } else {
          await page.keyboard.press('Escape');
          for (const [format, extension] of [['Excel', 'xlsx'], ['PDF', 'pdf'], ['Word', 'doc'], ['HWP', 'hwp'], ...(name === 'esg' ? [['JSON', 'json']] : [])]) {
            await activate(trigger);
            const promise = page.waitForEvent('download', {timeout: 60000});
            await activate(menu.getByRole('menuitem', {name: format, exact: true}));
            const download = await promise;
            assert.ok(download.suggestedFilename().endsWith(`.${extension}`));
            const bytes = fs.readFileSync(await download.path());
            assert.ok(bytes.length > 0);
            if (format === 'Excel') {
              const book = xlsx.read(bytes, {type: 'buffer'});
              const values = JSON.stringify(xlsx.utils.sheet_to_json(book.Sheets.data));
              assert.ok(values.includes(expected), `Missing expected export value: ${expected}`);
            } else if (format === 'PDF') {
              assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
              await download.saveAs(path.join(workspace, `${label}-${name}.pdf`));
            } else if (format === 'Word' || format === 'HWP') {
              assert.ok(bytes.toString().includes(expected));
              if (name === 'tbm-status') assert.ok(bytes.toString().includes('data:image/png;base64,'));
            } else assert.equal(JSON.parse(bytes.toString()).siteId, '2');
            result.files.push({format, filename: download.suggestedFilename(), bytes: bytes.length});
            await trigger.waitFor();
          }
        }
        if (name === 'tbm-status') {
          await activate(page.getByTitle('근로자 전자 서명', {exact: true}));
          const signatureDownload = page.waitForEvent('download');
          await activate(page.getByRole('button', {name: '이미지 다운로드', exact: true}));
          const signature = await signatureDownload;
          assert.equal(fs.readFileSync(await signature.path()).subarray(1, 4).toString(), 'PNG');
          result.files.push({format: 'Signature PNG', filename: signature.suggestedFilename()});
        }
      } catch (error) {
        result.issues.push(error.message.split('\n').slice(0, 4).join(' '));
        result.body = (await page.locator('body').innerText().catch(() => '')).slice(0, 2000);
        await page.screenshot({path: path.join(workspace, `${label}-${name}-error.png`)}).catch(() => {});
      }
      result.pageErrors = pageErrors;
      page.off('pageerror', errorHandler);
      console.log(JSON.stringify(result));
    }
    for (const [url, buttonName, expectedCount] of [['/admin/qrcode', '다운로드', 2], ['/admin/team-qr', 'QR 다운로드', 1]]) {
      const result = {engine: isWebKit ? 'webkit' : 'chrome', viewport: label, page: url, files: [], issues: []};
      results.push(result);
      try {
        await page.goto(`${origin}${url}?lang=ko`);
        const buttons = page.getByRole('button', {name: buttonName, exact: true});
        await buttons.first().waitFor();
        assert.equal(await buttons.count(), expectedCount);
        for (let i = 0; i < expectedCount; i++) {
          const promise = page.waitForEvent('download');
          await activate(buttons.nth(i));
          const file = await promise;
          const bytes = fs.readFileSync(await file.path());
          assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
          result.files.push(file.suggestedFilename());
        }
        if (new Set(result.files).size !== result.files.length) result.issues.push('Different QR roles share the same filename');
      } catch (error) {
        result.issues.push(error.message.split('\n').slice(0, 4).join(' '));
        result.buttons = await page.getByRole('button').allTextContents();
      }
      console.log(JSON.stringify(result));
    }
    if (process.env.SQ_AUDIT_APK === '1') {
      const result = {engine: isWebKit ? 'webkit' : 'chrome', viewport: label, page: '/download', issues: []};
      results.push(result);
      try {
        await page.goto(`${origin}/download`);
        const promise = page.waitForEvent('download');
        await activate(page.locator('a[download="sq-link.apk"]'));
        const download = await promise;
        assert.ok(fs.readFileSync(await download.path()).equals(fs.readFileSync(path.join(root, 'public/downloads/sq-link.apk'))));
        result.filename = download.suggestedFilename();
      } catch (error) { result.issues.push(error.message.split('\n')[0]); }
      console.log(JSON.stringify(result));
    }
    console.log('Unexpected API paths (blocked):', [...unexpected]);
    await context.close();
  }
} finally {
  fs.writeFileSync(path.join(workspace, 'results.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(workspace, 'server.log'), logs);
  await browser?.close();
  frontend.kill('SIGTERM');
  fixture.close();
  console.log(`Audit artifacts: ${workspace}`);
}
