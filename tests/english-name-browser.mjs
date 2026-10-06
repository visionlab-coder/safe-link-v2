// Real local BFF + backend + isolated DB. Never run against production.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const base = 'http://127.0.0.1:3100';
const browser = await chromium.launch({ executablePath: process.env.SQ_TEST_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const context = await browser.newContext({ viewport: {width:390,height:844} });
const page = await context.newPage();
const errors = [];
const suggestionRequests = [];
page.on('request', r => { if (r.url().includes('romanize')) suggestionRequests.push(r.url()); });
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(base + '/auth/temporary?lang=ko');
  const name = page.locator('input[name="name"]');
  await name.fill('홍길동');
  assert.equal(await name.inputValue(), '');
  await name.fill('HONG中文ខ្មែរ123😀');
  assert.equal(await name.inputValue(), 'HONG');
  // Browser IME composition must not leave native characters in the field.
  const cdp = await context.newCDPSession(page);
  await name.focus();
  await name.press('End');
  await cdp.send('Input.imeSetComposition', {text:'한',selectionStart:1,selectionEnd:1});
  await cdp.send('Input.insertText', {text:'한'});
  assert.equal(await name.inputValue(), 'HONG');
  // Paste through the real clipboard event path.
  await name.evaluate(el => {
    const paste = new ClipboardEvent('paste', {bubbles:true,cancelable:true,clipboardData:new DataTransfer()});
    paste.clipboardData.setData('text/plain', '中文');
    el.dispatchEvent(paste);
  });
  await cdp.send('Input.insertText', {text:'中文'});
  assert.equal(await name.inputValue(), 'HONG');
  await page.locator('input[name="phone"]').fill('010' + String(Date.now()).slice(-8));
  assert.equal(await page.getByRole('button', {name:'이 영문 이름 사용'}).count(),0);
  assert.deepEqual(suggestionRequests,[]);
  assert.equal(await page.getByRole('button', {name:'가입하기', exact:true}).isDisabled(), true);
  await name.fill('HONG GILDONG');
  await page.getByLabel('영문 이름을 확인했습니다.',{exact:true}).check();
  await name.fill('HONG GIL DONG');
  assert.equal(await page.getByLabel('영문 이름을 확인했습니다.',{exact:true}).isChecked(),false);
  await page.getByLabel('영문 이름을 확인했습니다.',{exact:true}).check();
  await page.locator('input[type="checkbox"]').last().check();
  await page.screenshot({path:'/tmp/sq-english-name-ko.png',fullPage:true});
  await page.getByRole('button', {name:'가입하기', exact:true}).click();
  await page.waitForURL('**/worker/temporary', {timeout:20000});
  const me = await (await context.request.get(base+'/api/auth/me')).json();
  assert.equal(me.profile.display_name,'HONG GIL DONG');
  assert.equal(me.profile.role,'TEMP_WORKER');
  const suggestion = await context.request.post(base+'/api/auth/romanize-name', {headers:{origin:base},data:{name:'Nguyễn Văn An'}});
  assert.equal(suggestion.status(),200,'TEMP user can request a suggestion');
  assert.equal((await suggestion.json()).romanized,'NGUYEN VAN AN');
  const denied = await context.request.post(base+'/api/auth/romanize-name',{headers:{origin:'https://untrusted.invalid'},data:{name:'김철수'}});
  assert.equal(denied.status(),403);
  await context.close();
  for (const lang of ['ko','en','zh','vi','th','ru','km','my','id','ne','bn','uz','kk','mn','ph','jp','fr','es','ar','hi']) {
    const c=await browser.newContext({viewport:{width:390,height:844}});
    const p=await c.newPage();
    await p.goto(base+'/auth/temporary?lang='+lang);
    await p.locator('input[name="name"]').waitFor();
    const label=await p.locator('label[for]').first().innerText();
    assert.ok(label.trim());
    if (lang!=='ko') assert.equal(/[가-힣]/.test(label),false,lang);
    if (lang==='km') await p.screenshot({path:'/tmp/sq-english-name-km.png',fullPage:true});
    await c.close();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: English-only input including IME/paste, no suggestion button/requests, confirmation reset, TEMP registration and stored English name, API security, 20 language screens. Local test account retained.');
} finally { await browser.close(); }
