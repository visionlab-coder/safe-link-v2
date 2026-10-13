const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs')();
const { adminSignupIssues, adminPasswordHint } = load('src/lib/admin-signup-validation.ts');
const { T } = load('src/app/auth/translations.ts');
for (const [language, t] of Object.entries(T)) {
  const input = { language, email: 'test@example.invalid', nameReady: true, password: '1234567890', confirmation: '1234567890', emailLabel: 'Email', confirmationLabel: t.passConfirm, mismatchLabel: t.noMatch };
  assert.deepEqual(adminSignupIssues(input), []);
  assert.deepEqual(adminSignupIssues({...input, password:'123456789', confirmation:'123456789'}), [adminPasswordHint(language)]);
  assert.equal(adminSignupIssues({...input,nameReady:false}).length, 1);
  assert.deepEqual(adminSignupIssues({...input,confirmation:'1234567891'}), [t.noMatch]);
  assert.equal(adminSignupIssues({...input,confirmation:''}).length, 1);
  assert.equal(adminSignupIssues({...input,email:'  '}).length, 1);
  assert.match(adminPasswordHint(language), /10/);
  if(language !== 'en') assert.notEqual(adminPasswordHint(language),adminPasswordHint('en'));
}
console.log('20 languages: 9/10-character boundary, matching passwords, name confirmation and required-field reasons passed.');
