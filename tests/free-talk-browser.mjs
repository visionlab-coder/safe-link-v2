import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// Real local Spring/Redis + BFF for guest sessions, room membership and SSE.
// Only paid AI outputs are fixtures; this is NOT a real speech/translation accuracy test.
const base=process.env.FREE_TALK_TEST_URL || 'http://localhost:3000';
const out='outputs/free-talk-qa'; await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];
const pages=[];
try {
  const hostContext=await browser.newContext({viewport:{width:1280,height:900}});
  const guestContext=await browser.newContext({viewport:{width:390,height:844}});
  const outsiderContext=await browser.newContext({viewport:{width:390,height:844}});
  const host=await hostContext.newPage(), guest=await guestContext.newPage(), outsider=await outsiderContext.newPage();
  // Local BFF has no nginx. Simulate a test-network peer per run; Redis quota is tested separately.
  const peer='192.0.2.'+(1+Date.now()%250);
  for(const context of [hostContext,guestContext,outsiderContext]) await context.setExtraHTTPHeaders({'x-real-ip':peer});
  pages.push(host,guest,outsider);
  for(const page of [host,guest,outsider]) {
    page.setDefaultTimeout(15000);
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/free-talk/translate',async route=>{
      const {text}=route.request().postDataJSON();
      await route.fulfill({json:{translated:'Do not level it.',originalText:text,normalizedText:text.replace('나라시','평탄화'),glossaryChanges:[{from:'나라시',to:'평탄화'}]}});
    });
  }
  await host.goto(base+'/?lang=ko');
  const entry=host.getByRole('button',{name:/입장하기/});
  const free=host.getByRole('link',{name:/Free Talk/});
  await free.waitFor();
  const [a,b]=await Promise.all([entry.boundingBox(),free.boundingBox()]); assert.ok(b.x>a.x);
  await host.screenshot({path:out+'/landing-desktop.png',fullPage:true});
  await free.click(); await host.waitForURL('**/free-talk?lang=ko');
  await host.getByRole('button',{name:'새 대화 시작',exact:true}).click();
  const code=await host.getByTestId('free-talk-room-code').textContent(); assert.match(code,/^\d{8}$/);
  await host.screenshot({path:out+'/qr-room.png',fullPage:true});
  await guest.goto(base+`/free-talk?code=${code}&lang=en`);
  await guest.getByText('Select your language',{exact:true}).waitFor();
  await guest.getByRole('button',{name:/English/}).click();
  await guest.getByRole('textbox',{name:'Type a message',exact:true}).waitFor();
  await host.getByRole('textbox',{name:'직접 입력',exact:true}).waitFor();
  for(const page of [host,guest]) await page.getByRole('button',{name:'🔊',exact:true}).click();
  await host.getByRole('textbox',{name:'직접 입력',exact:true}).fill('나라시 하지 마세요.');
  await host.getByRole('button',{name:'입장',exact:true}).click();
  await guest.getByText('Do not level it.',{exact:true}).waitFor();
  assert.match(await host.locator('body').innerText(),/평탄화 하지 마세요\./);
  assert.equal(await guest.getByText('Do not level it.',{exact:true}).count(),1,'No duplicate/self echo');
  await guest.screenshot({path:out+'/conversation-mobile.png',fullPage:true});
  assert.equal(await guest.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No mobile horizontal overflow');
  assert.equal(await guest.evaluate(()=>document.cookie.includes('SAFE_LINK_FREE_TALK')),false,'Capability is HttpOnly');
  const cookie=(await guestContext.cookies()).find(c=>c.name==='SAFE_LINK_FREE_TALK'); assert.ok(cookie.httpOnly); assert.equal(cookie.sameSite,'Strict');
  const outsiderReady=outsider.waitForResponse(r=>r.url().endsWith('/api/free-talk/session')&&r.status()===200);
  await outsider.goto(base+'/free-talk?lang=en'); await outsiderReady;
  const unauthorized=await outsider.evaluate(async code=>{
    const res=await fetch('/api/free-talk/signal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:code,event:'speaking-start',payload:{}})});return res.status;
  },code); assert.equal(unauthorized,403);
  const full=await outsider.evaluate(async code=>{
    const res=await fetch('/api/free-talk/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room:code,lang:'en'})});return res.status;
  },code); assert.equal(full,409);
  const protectedStt=await outsider.evaluate(async()=> (await fetch('/api/stt',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status); assert.equal(protectedStt,401);
  await outsider.getByRole('button',{name:/One-phone conversation/}).click();
  await outsider.getByRole('button',{name:/한국어/}).click();
  await outsider.getByRole('button',{name:'🔊',exact:true}).click();
  await outsider.getByRole('textbox',{name:'Type a message',exact:true}).fill('나라시 하지 마세요.');
  await outsider.getByRole('button',{name:'Join',exact:true}).click();
  await outsider.getByText('Do not level it.',{exact:true}).waitFor();
  await outsider.screenshot({path:out+'/one-phone-mobile.png',fullPage:true});
  for(const [lang,title] of [['ko','새 대화 시작'],['en','Start a conversation'],['ja','新しい会話'],['zh','开始对话'],['vi','Bắt đầu trò chuyện']]) {
    await outsider.goto(base+'/free-talk?lang='+lang);
    await outsider.getByRole('button',{name:title,exact:true}).waitFor();
    assert.equal(await outsider.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: landing button, QR room, two isolated guests + SSE delivery, outsider denied/full room, existing STT protected, one-phone mode, 5 UI languages, mobile layout. Paid vendors mocked.');
} catch(error) {
  console.log('Page errors:',errors);
  for(let i=0;i<pages.length;i++) { await pages[i].screenshot({path:out+`/failure-${i}.png`,fullPage:true}).catch(()=>{}); console.log(i,pages[i].url(),await pages[i].locator('body').innerText().catch(()=>'')); }
  throw error;
} finally { await browser.close(); }
