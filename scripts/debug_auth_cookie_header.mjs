const res = await fetch("http://127.0.0.1:3001/api/auth/admin-login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email: "training-admin@safe-link.local",
    password: "SafeLink!2026",
  }),
});
console.log(res.status);
console.log(res.headers.get("set-cookie"));
console.log(await res.text());
