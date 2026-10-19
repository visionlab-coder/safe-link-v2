// Synthetic microphone + mocked paid endpoints. No real microphone, DB writes or vendor charges.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(()=>{
    navigator.mediaDevices.getUserMedia=async()=>{
      const audio=new AudioContext(); await audio.resume();
      const oscillator=audio.createOscillator(),volume=audio.createGain(),destination=audio.createMediaStreamDestination();
      volume.gain.value=0; oscillator.connect(volume);volume.connect(destination);oscillator.start();
      window.testVoiceVolume=volume;
      return destination.stream;
    };
  });
  const page=await context.newPage();
  const errors=[],speech=[],translations=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/free-talk/session',r=>r.fulfill({json:{ok:true}}));
  await page.route('**/api/free-talk/stt',async r=>{
    speech.push(r.request().postDataJSON());
    const part=speech.length;
    await new Promise(resolve=>setTimeout(resolve,400));
    await r.fulfill({json:{transcript:`문장${part}`}});
  });
  await page.route('**/api/free-talk/translate',async r=>{
    translations.push(r.request().postDataJSON());
    await r.fulfill({json:{translated:'Test translation',normalizedText:r.request().postDataJSON().text}});
  });
  await page.goto('http://localhost:3000/free-talk?lang=ko');
  await page.getByRole('button',{name:/폰 하나로 대화/}).click();
  await page.getByRole('button',{name:/English/}).click();
  await page.getByRole('button',{name:'🔊',exact:true}).click(); // No TTS or speaker echo.
  await page.getByRole('button',{name:/나 · 말하기/}).click();
  await page.getByRole('button',{name:/듣는 중/}).waitFor();
  await page.waitForTimeout(700);
  async function say(ms=2400) {
    await page.evaluate(()=>window.testVoiceVolume.gain.value=0.2);
    await page.waitForTimeout(ms);
    await page.evaluate(()=>window.testVoiceVolume.gain.value=0);
  }
  async function waitForCount(list,n) {
    for(let i=0;i<100&&list.length<n;i++) await page.waitForTimeout(100);
    assert.equal(list.length,n);
  }
  await say(); await waitForCount(speech,1); await page.waitForTimeout(700);
  assert.equal(translations.length,0,'pauses must not send a conversation message');
  assert.equal(await page.getByRole('button',{name:/듣는 중/}).count(),1);
  await say(); await waitForCount(speech,2); await page.waitForTimeout(700);
  assert.equal(translations.length,0,'multiple STT clips remain buffered');
  await say(800);
  await page.getByRole('button',{name:/듣는 중/}).click();
  assert.equal(await page.getByRole('button',{name:/나 · 말하기/}).isDisabled(),true,'draining blocks repeated taps');
  await waitForCount(translations,1);
  assert.equal(translations[0].text,'문장1 문장2 문장3','stop includes trailing speech');
  assert.equal(translations[0].from,'ko');assert.equal(translations[0].to,'en');
  const partner=page.getByRole('button',{name:/상대 · English/});
  await partner.click();await partner.click();
  await page.getByRole('button',{name:/듣는 중/}).waitFor();
  await page.waitForTimeout(700);await say(1200);
  await page.getByRole('button',{name:/듣는 중/}).click();
  await waitForCount(translations,2);
  assert.equal(translations[1].text,'문장4');
  assert.equal(translations[1].from,'en');assert.equal(translations[1].to,'ko');
  assert.equal(speech[3].lang,'en-US');
  assert.deepEqual(errors,[]);
  console.log('PASS: continuous recording across pauses, no per-sentence sends, one combined message on stop including final clip, repeat-tap lock, next speaker language preserved. Synthetic audio; paid APIs mocked.');
} finally {await browser.close();}
