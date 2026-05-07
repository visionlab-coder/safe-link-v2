import { hangulize } from '../src/utils/hangulize';

const tests: [string, string][] = [
  ['I think', 'en'],
  ['i think this is important', 'en'],
  ['Beware of falling', 'en'],
  ['Watch your rear', 'en'],
  ['years of experience', 'en'],
  ['Electric shock hazard', 'en'],
  ['working at height', 'en'],
  ['safety equipment required', 'en'],
  ['Keep away from heavy equipment', 'en'],
  ['Confirm power shutdown', 'en'],
  ['No entry without safety shoes', 'en'],
  ['Drink plenty of water', 'en'],
  ['something important', 'en'],
];

console.log('=== 영어 한글 발음 최종 테스트 ===\n');
for (const [text, lang] of tests) {
  console.log(`"${text}"\n   → ${hangulize(text, lang)}\n`);
}
