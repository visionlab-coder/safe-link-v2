// Loopback-only fixture login. Notification data mocked; never sends TBMs or calls AI.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import loadFactory from './helpers/load-typescript.cjs';
const load = loadFactory();
const { QR_LANGUAGE_OPTIONS } = load('src/utils/qr/language-options.ts');
const { TBM_TRADES } = load('src/lib/tbm-trades.ts');
const { tbmTradeLabel } = load('src/lib/tbm-trade-labels.ts');
const base = 'http://localhost:3000';
const browser = await chromium.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true });
try {
  const context = await browser.newContext({ viewport:{ width:390, height:844 } });
  const response = await context.request.post(base + '/api/auth/worker-quick-login', {
    headers:{ origin:base }, data:{ name_initials:'LEGACY', phone_last4:'9876', site_id:'99001', preferred_lang:'ko' },
  });
  assert.equal(response.status(), 200, 'Isolated local fixture login failed');
  const me = await (await context.request.get(base + '/api/auth/me')).json();
  assert.equal(String(me.user.id), '99002');
  // Real BFF + real local backend: endpoint wired and site isolation enforced.
  const pending = await context.request.get(base + '/api/tbm/pending?siteId=99001');
  assert.equal(pending.status(), 200);
  const realPending = await pending.json();
  assert.ok(Array.isArray(realPending.tbms));
  assert.equal(typeof realPending.has_more, 'boolean');
  assert.ok(Object.hasOwn(realPending, 'next_cursor'));
  assert.equal((await context.request.get(base + '/api/tbm/pending?siteId=12345')).status(), 403);
  const page = await context.newPage();
  // Fixed KST date, independent of the machine/browser timezone or test execution day.
  await page.clock.setFixedTime(new Date('2026-10-20T14:59:59.000Z'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let count = 1, live = false, fail = false, temporary = false, pendingRequests = 0, legacy = false;
  const rows = () => Array.from({ length:count }, (_, i) => ({
    id:String(8000+i), trade_types:legacy ? [] : [TBM_TRADES[i % 16]], published_at:'2026-10-20T05:07:23Z',
  }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/me') return route.fulfill({json: temporary
      ? {...me, profile:{...me.profile, role:'TEMP_WORKER'}, v3:{...me.v3, roles:['TEMP_WORKER']}} : me});
    if (url.pathname === '/api/tbm/daily-trades') return route.fulfill({json:{date:'2026-10-20',selected:true,trades:TBM_TRADES}});
    if (url.pathname === '/api/tbm/pending') {
      pendingRequests++;
      if (fail) return route.fulfill({status:503,json:{error:'fixture_failure'}});
      return route.fulfill({json:{tbms:rows(),has_more:false,next_cursor:null}});
    }
    if (url.pathname === '/api/live/sessions') return route.fulfill({json:live
      ? {active:true,session:{session_id:'tbm_fixture_live',trade_types:['거푸집'],started_at:'2026-10-20T05:00:00Z'}}
      : {active:false}});
    if (url.pathname === '/api/tbm/today') return route.fulfill({json:{tbms:[]}});
    if (url.pathname.endsWith('/events')) return route.fulfill({contentType:'text/event-stream',body:': fixture\n\n'});
    return route.fulfill({json:{}});
  });
  async function waitCount(expected) {
    await page.waitForFunction(n => document.querySelectorAll('[data-testid="tbm-notice"]').length === n, expected);
  }
  async function refresh() {
    const before = pendingRequests;
    await page.evaluate(() => window.dispatchEvent(new Event('sq-link:tbm-received')));
    for (let i=0; i<100 && pendingRequests === before; i++) await page.waitForTimeout(25);
    assert.ok(pendingRequests > before);
  }
  await page.goto(base + '/worker?lang=en');
  await waitCount(1);
  for (const width of [390, 1280, 320]) {
    await page.setViewportSize({width,height:900});
    for (count = 1; count <= 9; count++) {
      await refresh(); await waitCount(count);
      const boxes = await page.getByTestId('tbm-notice').evaluateAll(nodes => nodes.map(n => {
        const r=n.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,overflow:n.scrollWidth>n.clientWidth+1};
      }));
      const cols=count===4?2:Math.min(count,3);
      assert.equal(new Set(boxes.map(b=>Math.round(b.y))).size, Math.ceil(count/cols), `${width}px / ${count} rows`);
      for (let i=1;i<count;i++) {
        if (i%cols) assert.equal(Math.round(boxes[i].y),Math.round(boxes[i-1].y));
        else assert.ok(boxes[i].y>boxes[i-1].y);
      }
      assert.ok(boxes.every(b=>!b.overflow), `${width}px / ${count} card overflow`);
      assert.equal(await page.getByTestId('tbm-notice').first().getAttribute('href'), '/worker/tbm/8000?lang=en');
    }
  }
  count = 16;
  for (const {lang} of QR_LANGUAGE_OPTIONS) {
    await page.evaluate(lang => {
      localStorage.setItem('safe-link-lang', lang);
      document.cookie = `safe-link-lang=${lang}; Path=/`;
      window.dispatchEvent(new Event('safe-link-language-changed'));
    }, lang);
    await page.goto(base + '/worker?lang=' + lang); await waitCount(16);
    const text = await page.getByTestId('tbm-notice-trades').allTextContents();
    assert.deepEqual(text, TBM_TRADES.map(t=>tbmTradeLabel(t,lang)), lang);
    assert.equal(await page.getByTestId('tbm-notices').evaluate(n=>n.scrollWidth>n.clientWidth+1), false, lang+' grid overflow');
  }
  count=1;
  await page.evaluate(() => {
    localStorage.setItem('safe-link-lang', 'ko');
    document.cookie='safe-link-lang=ko; Path=/';
    window.dispatchEvent(new Event('safe-link-language-changed'));
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/worker?lang=ko'); await waitCount(1);
  await page.getByTestId('tbm-notices').screenshot({path:'/private/tmp/tbm-notifications-single-mobile.png'});
  legacy=true; await refresh();
  await page.waitForFunction(() => document.querySelector('[data-testid="tbm-notice-trades"]')?.textContent === '현장 공통');
  legacy=false; count=6; await refresh(); await waitCount(6);
  await page.getByTestId('tbm-notices').screenshot({path:'/private/tmp/tbm-notifications-six-mobile.png'});
  // A failed refresh must not erase valid cards; a successful empty response must.
  fail=true; await refresh(); await waitCount(6);
  fail=false; count=0; await refresh(); await waitCount(0);
  count=2; live=true; await refresh(); await waitCount(3);
  assert.equal(await page.getByTestId('tbm-notice').first().getAttribute('href'), '/worker/tbm/today?lang=ko');
  assert.ok((await page.getByTestId('tbm-notice').first().textContent()).includes('LIVE'));
  live=false; await refresh(); await waitCount(2);
  // Daily selection expiry is covered by worker-daily-trades-browser.mjs.
  // Temporary workers retain only live access, never a pending/signature card.
  temporary=true; live=true;
  await page.goto(base+'/worker/temporary?lang=ko'); await waitCount(1);
  assert.equal(await page.getByTestId('tbm-notice').getAttribute('href'), '/worker/live?lang=ko');
  assert.deepEqual(errors, []);
  console.log('PASS: real local BFF authorization; 1–9 cards at 320/390/1280px; 16 trades × 20 languages; exact TBM links; temporary-worker restrictions.');
} finally { await browser.close(); }
