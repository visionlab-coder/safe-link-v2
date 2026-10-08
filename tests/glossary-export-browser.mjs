// Exercise the real glossary page against local fixtures, never production data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {chromium, webkit} from 'playwright-core';
import * as xlsx from 'xlsx';

const root = process.cwd();
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sq-glossary-export-'));
for (const file of ['package.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs']) {
  fs.copyFileSync(path.join(root, file), path.join(workspace, file));
}
fs.cpSync(path.join(root, 'src'), path.join(workspace, 'src'), {recursive: true});
fs.mkdirSync(path.join(workspace, 'src/app/lab/export-test'), {recursive: true});
fs.copyFileSync(path.join(root, 'tests/fixtures/export-download-page.tsx'), path.join(workspace, 'src/app/lab/export-test/page.tsx'));
for (const dir of ['node_modules', 'public']) fs.symlinkSync(path.join(root, dir), path.join(workspace, dir));

const user = {id: 11, displayName: 'EXPORT TEST', roles: ['SITE_ADMIN'], siteIds: [2], preferredLanguage: 'ko'};
const terms = [
  {id: 1, slang: '겐바', standard: '공사현장', category: '시설', is_active: true},
  {id: 2, slang: '공구리', standard: '콘크리트', category: '자재', is_active: false},
];
const fixture = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(user));
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));
const api = `http://127.0.0.1:${fixture.address().port}`;
const port = Number(process.env.SQ_EXPORT_TEST_PORT || 3113);
const origin = `http://127.0.0.1:${port}`;
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
let browser;
try {
  for (let i = 0; i < 120 && !logs.includes('Ready in'); i++) {
    if (frontend.exitCode != null) throw new Error(logs);
    await wait(500);
  }
  assert.ok(logs.includes('Ready in'), logs);
  // Compile the fixture before opening a browser: a dev-server full refresh
  // on first compilation can interrupt a WebKit navigation mid-test.
  await fetch(`${origin}/lab/export-test`, {headers: {cookie: 'SQ_TEST=fixture-only'}});
  browser = process.env.SQ_TEST_ENGINE === 'webkit' ? await webkit.launch({headless: true}) :
    await chromium.launch({...(process.env.SQ_TEST_CHROME ? {executablePath: process.env.SQ_TEST_CHROME} : {}), headless: true});
  const errors = [];
  for (const [label, width, height, touch] of [
    ['desktop', 1280, 900, false], ['mobile', 390, 844, true], ['narrow', 320, 568, true],
  ]) {
    const context = await browser.newContext({viewport: {width, height}, hasTouch: touch, isMobile: touch});
    await context.addCookies([{name: 'SQ_TEST', value: 'fixture-only', url: origin}]);
    // A mobile popup blocker must not prevent a PDF download.
    await context.addInitScript(() => {
      window.open = () => { throw new Error('Export must not open a popup'); };
      window.print = () => { throw new Error('Export must not use the print dialog'); };
      // Inspect the generated source without fetch(blob:), which the app's
      // connect-src CSP intentionally disallows. Do not weaken production CSP.
      const createObjectURL = URL.createObjectURL.bind(URL);
      window.__exportBlobs = new Map();
      URL.createObjectURL = blob => {
        const url = createObjectURL(blob);
        window.__exportBlobs.set(url, blob);
        return url;
      };
      const nativeClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.download && window.__blockAutomaticDownload) {
          window.__blockedDownloadCount = (window.__blockedDownloadCount || 0) + 1;
          return;
        }
        return nativeClick.call(this);
      };
    });
    let empty = false;
    let signatureBytes;
    let signatureRequests = 0;
    await context.route('**/api/**', route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/me') return route.fulfill({json: {
        user: {id: '11'}, profile: {role: 'SITE_ADMIN', preferred_lang: 'ko', site_id: '2'}, v3: user,
      }});
      if (url.pathname === '/api/v1/auth/me') return route.fulfill({json: user});
      if (url.pathname === '/api/glossary') return route.fulfill({json: {terms: empty ? [] : terms}});
      if (url.pathname === '/api/tbm/signature/1' && signatureBytes) {
        signatureRequests++;
        return route.fulfill({contentType: 'image/png', body: signatureBytes});
      }
      return route.fulfill({json: {ok: true}});
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.text().startsWith('Export failed:')) console.log(message.text());
    });
    await page.goto(`${origin}/admin/glossary?lang=ko`);
    const trigger = page.getByRole('button', {name: '내보내기', exact: true});
    await trigger.waitFor({timeout: 45000}).catch(async error => {
      await page.screenshot({path: path.join(workspace, `${label}-error.png`)});
      console.error({errors, url: page.url(), body: (await page.locator('body').innerText()).slice(-3000)});
      throw error;
    });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '내보내기' && !b.disabled));
    if (touch) assert.equal(await page.evaluate(() => matchMedia('(hover: hover)').matches), false, 'Mobile test has no mouse hover');

    if (process.env.SQ_EXPORT_EXPECT_OLD === '1') {
      if (touch) {
        await trigger.tap();
        await wait(350);
        assert.equal(await page.getByRole('button', {name: 'PDF', exact: true}).isVisible(), false, 'Old touch-only menu does not open');
        await page.screenshot({path: path.join(workspace, `before-${label}.png`)});
        console.log(`REPRODUCED ${label}: tapping Export does not show PDF on a touch-only device`);
        await context.close();
        continue;
      }
      await trigger.hover();
      await wait(350);
      await page.screenshot({path: path.join(workspace, 'before.png')});
      const hits = [];
      for (const format of ['PDF', 'Excel', 'Word', 'HWP']) {
        hits.push(await page.getByRole('button', {name: format, exact: true}).evaluate(el => {
          const r = el.getBoundingClientRect();
          const front = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return {format: el.textContent, clickable: el.contains(front), coveringClass: front?.className};
        }));
      }
      assert.ok(hits.some(hit => !hit.clickable), `Original menu must reproduce banner obstruction: ${JSON.stringify(hits)}`);
      console.log(`REPRODUCED: ${JSON.stringify(hits)}. Screenshot: ${workspace}/before.png`);
      await context.close();
      continue;
    }

    const menu = page.getByRole('menu', {name: '내보내기', exact: true});
    const activate = locator => touch ? locator.tap() : locator.click();
    const open = async () => {
      const preview = page.getByRole('dialog');
      if (await preview.isVisible()) await preview.getByRole('button', {name: '닫기', exact: true}).click();
      await activate(trigger);
      await menu.waitFor();
      assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    };
    await open();
    for (const format of ['PDF', 'Excel', 'Word', 'HWP']) {
      const item = menu.getByRole('menuitem', {name: format, exact: true});
      assert.equal(await item.evaluate(el => {
        const r = el.getBoundingClientRect();
        return r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight &&
          el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }), true, `${label}: ${format} must be visible and above the hero`);
    }
    await page.screenshot({path: path.join(workspace, `${label}.png`)});
    await activate(trigger);
    await menu.waitFor({state: 'hidden'});
    await open();
    await page.locator('.admin-concept-hero').click({position: {x: 20, y: 20}});
    await menu.waitFor({state: 'hidden'});
    await open();
    await page.keyboard.press('Escape');
    await menu.waitFor({state: 'hidden'});
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true, 'Escape restores trigger focus');

    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await menu.waitFor();
    assert.equal(await page.locator(':focus').textContent(), 'PDF');
    await page.keyboard.press('End');
    assert.equal(await page.locator(':focus').textContent(), 'HWP');
    await page.keyboard.press('Home');
    assert.equal(await page.locator(':focus').textContent(), 'PDF');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator(':focus').textContent(), 'Excel');
    await page.keyboard.press('Escape');

    await open();
    const pdfPromise = page.waitForEvent('download', {timeout: 90000});
    await activate(menu.getByRole('menuitem', {name: 'PDF', exact: true}));
    const pdfDownload = await pdfPromise.catch(async error => {
      console.error({body: (await page.locator('body').innerText()).slice(0, 600), frames: page.frames().map(f => f.url()), errors});
      await page.screenshot({path: path.join(workspace, `${label}-pdf-error.png`)});
      throw error;
    });
    assert.match(pdfDownload.suggestedFilename(), /^sqlink_glossary_.*\.pdf$/);
    await pdfDownload.saveAs(path.join(workspace, `${label}.pdf`));
    assert.equal(fs.readFileSync(await pdfDownload.path()).subarray(0, 5).toString(), '%PDF-');
    assert.equal(await page.locator('iframe[title="PDF export"]').count(), 0, 'PDF render frame removed');
    const preview = page.getByRole('dialog', {name: '파일 미리보기', exact: true});
    await preview.waitFor();
    const pdfLink = preview.getByRole('link', {name: '다운로드', exact: true});
    assert.equal(await pdfLink.getAttribute('target'), null, 'PDF download must not request a new viewer tab');
    const pdfTransport = await pdfLink.evaluate(async link => {
      const blob = window.__exportBlobs.get(link.href);
      return {type: blob.type, bytes: [...new Uint8Array(await blob.arrayBuffer())]};
    });
    assert.equal(pdfTransport.type, 'application/octet-stream', 'Safari download uses binary MIME, not inline PDF MIME');
    assert.deepEqual(Buffer.from(pdfTransport.bytes), fs.readFileSync(await pdfDownload.path()), 'Download preserves every original PDF byte');
    assert.equal(context.pages().length, 1, 'PDF download does not open an extra tab');
    assert.ok((await preview.innerText()).includes('자동 다운로드가 뜨지 않으면'));
    assert.equal(await page.frameLocator('iframe[title="파일 미리보기"]').getByText('공사현장', {exact: true}).count(), 1);
    const retryPromise = page.waitForEvent('download');
    await activate(preview.getByRole('link', {name: '다운로드', exact: true}));
    const retry = await retryPromise;
    assert.deepEqual(fs.readFileSync(await retry.path()), fs.readFileSync(await pdfDownload.path()), 'Manual retry reuses the exact file');
    await page.screenshot({path: path.join(workspace, `${label}-preview.png`)});
    if (label === 'mobile') {
      const source = fs.readFileSync(path.join(root, 'src/lib/export-preview-ui.ts'), 'utf8');
      const translations = [...source.matchAll(/^\s+(\w+): (\[[^\n]+\]),$/gm)].map(m => [m[1], JSON.parse(m[2])]);
      assert.equal(translations.length, 20);
      for (const [language, words] of translations) {
        await page.evaluate(lang => { localStorage.setItem('safe-link-lang', lang); window.dispatchEvent(new Event('safe-link-language-changed')); }, language);
        await page.getByRole('dialog', {name: words[0], exact: true}).waitFor();
        assert.equal(await page.getByRole('dialog').getByRole('link', {name: words[1], exact: true}).count(), 1);
      }
      await page.evaluate(() => { localStorage.setItem('safe-link-lang', 'ko'); window.dispatchEvent(new Event('safe-link-language-changed')); });
      await preview.waitFor();
    }
    await menu.waitFor({state: 'hidden'});

    await open();
    const downloadPromise = page.waitForEvent('download');
    await activate(menu.getByRole('menuitem', {name: 'Excel', exact: true}));
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^sqlink_glossary_.*\.xlsx$/);
    const book = xlsx.read(fs.readFileSync(await download.path()), {type: 'buffer'});
    assert.equal(await preview.getByRole('link', {name: '다운로드', exact: true}).evaluate(link =>
      window.__exportBlobs.get(link.href).type),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Other file MIME types stay unchanged');
    const rows = xlsx.utils.sheet_to_json(book.Sheets.data);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]['현장 표현'], '겐바');
    assert.equal(rows[0]['표준 표현'], '공사현장');
    await menu.waitFor({state: 'hidden'});

    for (const [format, extension] of [['Word', 'doc'], ['HWP', 'hwp']]) {
      await open();
      const promise = page.waitForEvent('download');
      await activate(menu.getByRole('menuitem', {name: format, exact: true}));
      const file = await promise;
      assert.ok(file.suggestedFilename().endsWith(`.${extension}`));
      assert.ok(fs.readFileSync(await file.path(), 'utf8').includes('공사현장'));
    }

    empty = true;
    await page.reload();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === '내보내기' && b.disabled));
    assert.equal(await menu.count(), 0, 'Empty glossary cannot export');

    if (label === 'mobile') {
      await page.goto(`${origin}/lab/export-test`);
      signatureBytes = Buffer.from(await page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = 150; canvas.height = 45;
        const pen = canvas.getContext('2d'); pen.strokeStyle = '#172554'; pen.lineWidth = 3;
        pen.beginPath(); pen.moveTo(5, 35); pen.lineTo(40, 10); pen.lineTo(28, 38); pen.lineTo(85, 15); pen.lineTo(140, 35); pen.stroke();
        return canvas.toDataURL().split(',')[1];
      }), 'base64');
      await open();
      const reportPromise = page.waitForEvent('download', {timeout: 90000});
      await activate(menu.getByRole('menuitem', {name: 'PDF', exact: true}));
      const report = await reportPromise;
      await report.saveAs(path.join(workspace, 'multipage-signature.pdf'));
      const bytes = fs.readFileSync(await report.path()).toString('latin1');
      assert.ok(Number(bytes.match(/\/Count (\d+)/)?.[1]) >= 4, 'Long report uses multiple PDF pages');
      assert.equal(signatureRequests, 1, 'Authenticated signatures embedded and duplicate fetches deduplicated');

      await open();
      const jsonPromise = page.waitForEvent('download');
      await activate(menu.getByRole('menuitem', {name: 'JSON', exact: true}));
      const json = await jsonPromise;
      assert.equal(JSON.parse(fs.readFileSync(await json.path(), 'utf8')).rows.length, 86);
      await page.getByRole('dialog').getByRole('button', {name: '닫기', exact: true}).click();

      await page.getByRole('button', {name: 'Simulate error'}).click();
      await open();
      await activate(menu.getByRole('menuitem', {name: 'PDF', exact: true}));
      const failure = page.getByRole('alert').filter({hasText: '파일을 만들지 못했습니다'});
      await failure.waitFor();
      assert.ok((await failure.textContent()).includes('다시 시도'));
      assert.equal(await trigger.isEnabled(), true, 'Can retry after a failed export');
      await page.getByRole('button', {name: 'Simulate error'}).click();
      await page.getByRole('button', {name: 'Delay export'}).click();
      await open();
      const busyPromise = page.waitForEvent('download');
      await activate(menu.getByRole('menuitem', {name: 'Excel', exact: true}));
      const busyButton = page.getByRole('button', {name: '파일 생성 중…', exact: true});
      await busyButton.waitFor();
      assert.equal(await busyButton.isDisabled(), true, 'No duplicate exports while preparing');
      await busyPromise;
      await page.getByRole('dialog').getByRole('button', {name: '닫기', exact: true}).click();
      await trigger.waitFor();

      // Model a mobile browser suppressing the asynchronous automatic click.
      // A real tap on the persistent link must still download without rendering.
      await page.getByRole('button', {name: 'Delay export'}).click();
      await page.evaluate(() => {
        window.__blockAutomaticDownload = true;
        Object.defineProperty(navigator, 'canShare', {configurable: true, value: data => data.files?.[0]?.type === 'application/pdf'});
        Object.defineProperty(navigator, 'share', {configurable: true, value: async data => {
          window.__sharedFile = {name: data.files[0].name, type: data.files[0].type, size: data.files[0].size, active: navigator.userActivation.isActive};
          window.__sharedBytes = [...new Uint8Array(await data.files[0].arrayBuffer())];
          if (window.__shareError) throw new DOMException('fixture', window.__shareError);
        }});
      });
      await open();
      await activate(menu.getByRole('menuitem', {name: 'PDF', exact: true}));
      await preview.waitFor({timeout: 90000});
      await page.waitForFunction(() => window.__blockedDownloadCount === 1);
      const manualPromise = page.waitForEvent('download');
      await activate(preview.getByRole('link', {name: '다운로드', exact: true}));
      const manual = await manualPromise;
      assert.equal(fs.readFileSync(await manual.path()).subarray(0, 5).toString(), '%PDF-');
      const share = preview.getByRole('button', {name: '공유 · 파일에 저장', exact: true});
      await activate(share);
      await page.waitForFunction(() => Array.isArray(window.__sharedBytes));
      const shared = await page.evaluate(() => window.__sharedFile);
      assert.equal(shared.active, true, 'Share called inside the fresh user gesture');
      assert.equal(shared.name, manual.suggestedFilename());
      assert.equal(shared.size, fs.statSync(await manual.path()).size);
      assert.equal(shared.type, 'application/pdf');
      assert.deepEqual(Buffer.from(await page.evaluate(() => window.__sharedBytes)), fs.readFileSync(await manual.path()), 'Shared PDF and binary download contain identical bytes');
      await page.evaluate(() => { window.__shareError = 'AbortError'; });
      await activate(share);
      assert.equal(await preview.getByRole('alert').count(), 0, 'Cancelling Share is not an export error');
      await page.evaluate(() => { window.__shareError = 'NotAllowedError'; });
      await activate(share);
      await preview.getByRole('alert').waitFor();
      assert.equal(await preview.getByRole('link', {name: '다운로드', exact: true}).isVisible(), true);
      await page.keyboard.press('Escape');
      await preview.waitFor({state: 'hidden'});
      assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'Closing restores page scrolling');
      console.log('PASS mobile recovery: blocked automatic download, direct tap, same-file sharing, cancellation, share failure, close');
    }
    await context.close();
    console.log(`PASS ${label}: menu layering, touch/keyboard, PDF download (no print/popup), Excel data, Word/HWP downloads, empty state`);
  }
  assert.deepEqual(errors, []);
  console.log(`Screenshots: ${workspace}`);
} catch (error) {
  console.error(logs.slice(-3000));
  throw error;
} finally {
  await browser?.close();
  frontend.kill('SIGTERM');
  fixture.closeAllConnections();
  await new Promise(resolve => fixture.close(resolve));
}
