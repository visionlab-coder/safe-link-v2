const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fontExtension, patch } = require('../scripts/patch-next-font-extension.cjs');
assert.equal(fontExtension('https://fonts.gstatic.com/a.woff2', Buffer.from('wOF2')), 'woff2');
assert.equal(fontExtension('https://fonts.gstatic.com/a.woff2?v=2', Buffer.from('wOF2')), 'woff2');
for (const [magic, ext] of [['wOF2','woff2'], ['wOFF','woff'], ['OTTO','otf']]) {
  assert.equal(fontExtension('https://fonts.gstatic.com/l/font?kit=example', Buffer.from(magic)), ext);
}
assert.equal(fontExtension('https://fonts.gstatic.com/l/font', Buffer.from([0,1,0,0])), 'ttf');
assert.throws(() => fontExtension('https://fonts.gstatic.com/l/font', Buffer.from('<html>')));
assert.throws(() => fontExtension('https://fonts.gstatic.com/l/font', Buffer.alloc(0)));
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sqlink-font-test-'));
const fixture = path.join(directory, 'loader.js');
try {
  fs.copyFileSync(require.resolve('next/dist/compiled/@next/font/dist/google/loader.js'), fixture);
  patch(fixture);
  const first = fs.readFileSync(fixture, 'utf8');
  patch(fixture);
  assert.equal(fs.readFileSync(fixture, 'utf8'), first);
  assert.ok(first.includes('extensionless font URL compatibility'));
} finally {
  fs.unlinkSync(fixture);
  fs.rmdirSync(directory);
}
console.log('Font URL compatibility: 10 assertions passed');
