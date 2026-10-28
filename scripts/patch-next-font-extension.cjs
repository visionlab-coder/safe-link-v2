// Next 15's Google loader assumes every remote URL ends in a file extension.
// Keep downloaded font bytes unchanged; identify extensionless URLs by file signature.
const fs = require('node:fs');

function fontExtension(url, bytes) {
  const match = /\.(woff2?|eot|ttf|otf)$/i.exec(new URL(url).pathname);
  if (match) return match[1].toLowerCase();
  const signature = bytes.subarray(0, 4).toString('ascii');
  if (signature === 'wOF2') return 'woff2';
  if (signature === 'wOFF') return 'woff';
  if (signature === 'OTTO') return 'otf';
  if (bytes.length >= 4 && bytes.readUInt32BE(0) === 0x00010000) return 'ttf';
  throw new Error('Unrecognized Google font file format');
}

function patch(file = require.resolve('next/dist/compiled/@next/font/dist/google/loader.js')) {
  const source = fs.readFileSync(file, 'utf8');
  const marker = '/* SQLink: extensionless font URL compatibility */';
  if (source.includes(marker)) return;
  const before = "const ext = /\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1];";
  if (source.split(before).length !== 2) throw new Error('Next font loader changed: review compatibility patch');
  const after = `${marker}\n            const ext = (${fontExtension.toString()})(googleFontFileUrl, fontFileBuffer);`;
  fs.writeFileSync(file, source.replace(before, after));
  console.log('Next Google font URL compatibility applied (font bytes unchanged)');
}

module.exports = { fontExtension, patch };
if (require.main === module) patch();
