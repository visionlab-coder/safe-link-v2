// Deliberately fixed local endpoints. Uses dummy #7; leaves #1-6 for manual testing.
import assert from "node:assert/strict";
const base = "http://127.0.0.1:3100";
const cookies = new Map();
async function call(path, body) {
  const res = await fetch(base + path, { method: body ? "POST" : "GET", redirect: "manual",
    headers: { cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join("; "), origin: base, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  for (const c of res.headers.getSetCookie()) { const pair = c.split(";")[0]; const i=pair.indexOf("="); cookies.set(pair.slice(0,i),pair.slice(i+1)); }
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }
  return { status: res.status, data };
}
const signup = {name:"테스트근로자7",phone:"01000009007",language:"ko",consent:true,consentVersion:"temporary-worker-2026-09-28"};
assert.equal((await call("/api/auth/temporary-worker",{...signup,consent:false})).status,400);
assert.equal((await call("/api/auth/temporary-worker",signup)).status,200);
const before = await call("/api/auth/me");
assert.equal(before.data.profile.role,"TEMP_WORKER");
assert.equal((await call("/api/worker/chat/admins")).status,403);
const sites=await call("/api/worker-upgrade?mode=sites");
assert.equal(sites.status,200);
const site = sites.data.find(s => s.name === "로컬 가입 테스트 현장");
assert.ok(site);
const input={name:signup.name,phone:signup.phone,siteId:site.id,irisId:"99001007",consent:true,consentVersion:"worker-upgrade-2026-09-28"};
for (const invalid of [{...input,consent:false},{...input,irisId:"1111"},{...input,siteId:999999},{...input,name:"다른사람"},{...input,phone:"01000009001"}]) {
  assert.equal((await call("/api/worker-upgrade",invalid)).status,400);
  assert.equal((await call("/api/auth/me")).data.profile.role,"TEMP_WORKER");
}
const upgraded=await call("/api/worker-upgrade",input);
assert.equal(upgraded.status,200);
assert.equal(upgraded.data.status,"APPROVED");
const after=await call("/api/auth/me");
assert.equal(after.data.user.id,before.data.user.id);
assert.equal(after.data.profile.role,"WORKER");
assert.equal((await call("/api/worker/chat/admins")).status,200);
assert.notEqual((await call("/api/worker-upgrade",input)).status,200);
console.log("PASS: consent required; TEMP chat blocked; invalid fixture/site/name/phone denied; same user immediately WORKER; chat allowed; duplicate conversion denied.");
await call("/api/auth/logout",{});
