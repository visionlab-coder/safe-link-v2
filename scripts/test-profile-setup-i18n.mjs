import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const { setupUI, SETUP_TRADES } = require('../tests/helpers/load-typescript.cjs')()('src/lib/profile-setup-ui.ts');
const locales = process.env.SETUP_TEST_LANGUAGES?.split(',') ?? ['ko','vi','zh','th','uz','ph','km','id','mn','my','ne','bn','kk','ru','en','jp','fr','es','ar','hi'];
const base = process.env.SETUP_TEST_ORIGIN || 'http://127.0.0.1:3000';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
fs.mkdirSync('outputs/profile-setup-qa', { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });

async function checkText(page, lang, expected) {
  await page.waitForFunction(text => document.querySelector('main')?.textContent.includes(text), expected).catch(async error => {
    console.error({ url: page.url(), expected, body: (await page.locator('body').innerText()).slice(0, 1200) });
    throw error;
  });
  if (lang !== 'ko') {
    // Native language names are deliberately shown in the language selector.
    const text = await page.locator('main').evaluate(main => {
      const clone = main.cloneNode(true);
      clone.querySelectorAll('select').forEach(select => select.remove());
      return clone.textContent;
    });
    assert.doesNotMatch(text, /[가-힣]/, `${lang}: unexpected Korean UI`);
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${lang}: horizontal overflow`);
}

try {
  for (const lang of locales) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('Browser error:', e.message); });
    let payload;
    // All APIs are fixtures: these tests never change local or production accounts.
    await page.route('**/api/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/api/auth/me') return route.fulfill({ json: {
        id: 99099, displayName: 'TEST WORKER', email: null, roles: ['WORKER'], siteIds: [],
      }});
      if (pathname === '/api/sites/options') return route.fulfill({ json: { sites: [{ id: '99001', name: 'TEST SITE', site_code: 'TEST' }] }});
      if (pathname === '/api/auth/setup-profile') {
        payload = route.request().postDataJSON();
        return route.fulfill({ status: 500, json: { error: 'fixture_save_failure' } });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto(`${base}/auth/setup?lang=ko&role=worker`);
    await page.waitForFunction(() => document.querySelector('input[name=name]')?.value === 'TEST WORKER');
    await page.locator('main select').selectOption(lang);
    const t = setupUI(lang);
    await checkText(page, lang, t.pgTitle);
    await page.locator('main input[type=checkbox]').check();
    await page.getByRole('button', { name: t.next, exact: true }).click();
    await page.getByPlaceholder(t.siteTitle).fill('TEST SITE');
    await page.locator('input[type=tel]').fill('01000000000');
    await page.getByRole('button', { name: SETUP_TRADES[0].label[lang], exact: true }).click();
    assert.equal(await page.getByPlaceholder(t.tradeTitle).inputValue(), SETUP_TRADES[0].label[lang]);
    await checkText(page, lang, t.phoneTitle);
    await page.getByRole('button', { name: t.next, exact: true }).click();
    await checkText(page, lang, t.autoEnabled);
    if (['en','vi','jp','ar'].includes(lang)) {
      await page.waitForFunction(label => {
        const button = [...document.querySelectorAll('button')].find(el => el.textContent === label);
        return button && getComputedStyle(button.parentElement.parentElement).opacity === '1';
      }, t.save);
      const bounds = await page.locator('main').evaluate(main => ({
        scrollLeft: main.scrollLeft, left: main.lastElementChild.getBoundingClientRect().left,
        right: main.lastElementChild.getBoundingClientRect().right,
      }));
      assert.equal(bounds.scrollLeft, 0, 'focus must not horizontally scroll the clipping container');
      assert.ok(bounds.left >= 0 && bounds.right <= 390, `${lang}: card is clipped`);
      await page.screenshot({ path: `outputs/profile-setup-qa/${lang}-step3.png`, fullPage: true });
    }
    const dialog = page.waitForEvent('dialog');
    await page.getByRole('button', { name: t.save, exact: true }).click();
    const alert = await dialog;
    assert.equal(alert.message(), t.saveFailed);
    await alert.dismiss();
    assert.equal(payload.preferred_lang, lang);
    assert.equal(payload.trade, SETUP_TRADES[0].ko, 'stored canonical trade remains stable');
    await page.getByRole('button', { name: t.prev, exact: true }).click();
    await page.getByPlaceholder(t.siteTitle).waitFor();
    await page.getByRole('button', { name: t.prev, exact: true }).click();
    await page.locator('main select').waitFor();
    await page.getByRole('button').filter({ hasText: t.safety_officer_desc }).click();
    await page.locator('main input[type=checkbox]').check();
    await page.getByRole('button', { name: t.next, exact: true }).click();
    await page.getByPlaceholder(t.posTitle).fill('LEAD');
    await page.locator('main select').selectOption('99001');
    await checkText(page, lang, t.siteSelected);
    // The shared header event must update the current step without resetting input.
    await page.evaluate(() => {
      localStorage.setItem('safe-link-lang', 'en');
      window.dispatchEvent(new Event('safe-link-language-changed'));
    });
    await checkText(page, 'en', setupUI('en').siteSelected);
    assert.equal(await page.getByPlaceholder(setupUI('en').posTitle).inputValue(), 'LEAD');
    assert.equal(await page.locator('main select').inputValue(), '99001');
    await page.reload();
    await checkText(page, 'en', setupUI('en').pgTitle); // stale URL ko must not win
    assert.equal(await page.locator('main select').inputValue(), 'en');
    assert.deepEqual(errors, []);
    console.log(`PASS ${lang}: dropdown, worker/admin steps, trade, save language, error, header sync, reload`);
    await context.close();
  }
} finally { await browser.close(); }
