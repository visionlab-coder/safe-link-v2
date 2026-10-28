// Run only against a disposable emulator. Fixtures never call an authenticated API.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
const serial = process.env.ANDROID_TEST_SERIAL || 'emulator-5580';
assert.match(serial, /^emulator-\d+$/, 'Physical devices are not test targets');
const adb = '/opt/homebrew/share/android-commandlinetools/platform-tools/adb';
const command = (...args) => execFileSync(adb, ['-s', serial, ...args], {encoding:'utf8'}).trim();
const pid = command('shell','pidof','kr.co.safelink.mobile.dev');
assert.match(pid, /^\d+$/);
command('forward','tcp:9228',`localabstract:webview_devtools_remote_${pid}`);
const browser = await chromium.connectOverCDP('http://127.0.0.1:9228');
try {
  const context = browser.contexts()[0];
  await context.route('**/*', route => route.fulfill({contentType:'text/html',body:'<!doctype html><title>Local native Back fixture</title><main>Navigation fixture</main>'}));
  const page = context.pages()[0];
  await page.goto('https://app.safe-link.co.kr/auth?native-back-fixture=1');
  await page.evaluate(() => {
    sessionStorage.setItem('native-back-fixture','preserved');
    document.cookie='native_back_fixture=preserved; Path=/; Secure; SameSite=Lax';
    history.replaceState({__NA:true},'','/worker?lang=en');
    history.pushState({__NA:true},'','/worker/chat');
    history.pushState({__NA:true},'','/worker/chat/123');
  });
  command('shell','input','keyevent','4');
  await page.waitForFunction(()=>location.pathname==='/worker/chat');
  command('shell','input','keyevent','4');
  await page.waitForFunction(()=>location.pathname==='/worker');
  for(let i=0;i<3;i++) command('shell','input','keyevent','4');
  await page.waitForTimeout(500);
  assert.equal(new URL(page.url()).pathname,'/worker');
  assert.equal(command('shell','pidof','kr.co.safelink.mobile.dev'),pid);
  const resumed=command('shell','dumpsys','activity','activities');
  assert.ok(/(?:mResumedActivity:|topResumedActivity=).*kr\.co\.safelink\.mobile\.dev/.test(resumed), 'SQ Link must remain the resumed activity');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('native-back-fixture')),'preserved');
  assert.ok((await page.evaluate(()=>document.cookie)).includes('native_back_fixture=preserved'));
  console.log('PASS Android system Back: SPA detail → list → worker home; repeated root Back stays foreground; sessionStorage/cookie unchanged');
  for(const home of ['/admin','/control','/system','/worker/temporary']) {
    await page.evaluate(path=>{
      history.replaceState({},'','/auth'); history.pushState({},'',path);
    },home);
    command('shell','input','keyevent','4'); await page.waitForTimeout(200);
    assert.equal(new URL(page.url()).pathname,home);
  }
  console.log('PASS: all role homes do not navigate back into login');
} finally {
  await browser.close();
  command('forward','--remove','tcp:9228');
}
