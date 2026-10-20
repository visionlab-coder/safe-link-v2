// All requests are fixtures: no real accounts, microphone, vendor calls or production writes.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import loadFactory from './helpers/load-typescript.cjs';
const load=loadFactory();
const {QR_LANGUAGE_OPTIONS: options}=load('src/utils/qr/language-options.ts');
const {normalizeFreeTalkLanguage: normalize}=load('src/lib/free-talk-languages.ts');
const base='http://localhost:3000';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[], translations=[], voices=[], joins=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/free-talk/session',r=>r.fulfill({json:{ok:true}}));
  await page.route('**/api/free-talk/translate',async r=>{
    translations.push(r.request().postDataJSON());
    await r.fulfill({json:{translated:'Translation fixture',normalizedText:'Source fixture'}});
  });
  await page.route('**/api/free-talk/tts',async r=>{
    voices.push(r.request().postDataJSON());
    await r.fulfill({contentType:'audio/wav',body:Buffer.from('UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==','base64')});
  });
  await page.route('**/api/free-talk/join',async r=>{
    joins.push(r.request().postDataJSON()); await r.fulfill({json:{senderId:'guest',partnerLang:'ko'}});
  });
  await page.route('**/api/free-talk/events?*',r=>r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'}));
  await page.route('**/api/free-talk/signal',r=>r.fulfill({json:{ok:true}}));
  for(const option of options) {
    const code=normalize(option.lang), speaker=code==='ko'?'en':'ko';
    await page.goto(base+'/free-talk?lang='+option.lang);
    const mine=page.getByTestId('free-talk-my-languages');
    await mine.locator(`[data-language="${code}"][aria-pressed="true"]`).waitFor();
    assert.equal(await mine.locator('button').count(),20);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,code+' home overflow');
    await mine.locator(`[data-language="${speaker}"]`).click();
    await page.getByTestId('free-talk-solo-start').click();
    const choices=page.getByTestId('free-talk-partner-languages');
    assert.equal(await choices.locator('button').count(),19);
    await choices.locator(`[data-language="${code}"]`).click();
    await page.getByRole('textbox').fill('Language route fixture');
    await page.locator('button').filter({hasText:'↑'}).click();
    await page.getByText('Translation fixture',{exact:true}).waitFor();
    assert.equal(translations.at(-1).from,speaker);
    assert.equal(translations.at(-1).to,code);
    for(let i=0;i<40 && voices.at(-1)?.lang!==code;i++) await page.waitForTimeout(100);
    assert.equal(voices.at(-1).lang,code);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,code+' chat overflow');
    // QR join also has the full catalog and sends the same canonical code.
    await page.goto(base+'/free-talk?code=12345678&lang='+option.lang);
    const join=page.getByTestId('free-talk-join-languages');
    await join.locator(`[data-language="${code}"]`).waitFor();
    assert.equal(await join.locator('button').count(),20);
    await join.locator(`[data-language="${code}"]`).click();
    await page.getByRole('textbox').waitFor();
    assert.equal(joins.at(-1).lang,code);
    assert.equal(joins.at(-1).room,'12345678');
  }
  await page.goto(base+'/free-talk?lang=ko');
  await page.getByTestId('free-talk-my-languages').waitFor();
  await page.screenshot({path:'/private/tmp/free-talk-20-languages.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: all 20 SQ Link language links, 20/19/20 selector counts, one-phone translation/voice routing, QR join codes and mobile overflow. All APIs mocked.');
} finally {await browser.close();}
