# SAFE-LINK POC Domain Cutover Plan

Target domain: `safe-link.co.kr`

Expected purchase approval window: 2026-05-26 or later

## Goal

Use one purchased domain for the POC and keep routing simple:

- Primary: `https://safe-link.co.kr`
- Alias: `https://www.safe-link.co.kr` redirects to `https://safe-link.co.kr`

Do not create separate `admin`, `app`, or `qr` subdomains for the first POC unless there is a clear operational need. Use app paths instead:

- Admin: `https://safe-link.co.kr/admin`
- Worker: `https://safe-link.co.kr/worker`
- Site QR: `https://safe-link.co.kr/qr/site`

## DNS Records

Set these after the domain is purchased.

### If production hosting is Vercel

Configure the domain in the Vercel project first, then add the DNS records Vercel shows.

Typical records:

```text
safe-link.co.kr      A      76.76.21.21
www.safe-link.co.kr  CNAME  cname.vercel-dns.com
```

### If production hosting is Cloudflare Workers

Configure the custom domain/route in Cloudflare Workers, then point DNS through Cloudflare.

Typical records are managed by Cloudflare after the zone is active. Do not guess Worker DNS records manually.

## Required Environment Variables

Set these in the production hosting environment after the domain is active:

```text
NEXT_PUBLIC_SITE_URL=https://safe-link.co.kr
NEXT_PUBLIC_NFC_BASE_URL=https://safe-link.co.kr
```

`NEXT_PUBLIC_NFC_BASE_URL` controls NFC sticker URLs. If it is absent, the code falls back to `NEXT_PUBLIC_SITE_URL`.

## Redirect Rule

Redirect `www` to the apex domain:

```text
https://www.safe-link.co.kr/* -> https://safe-link.co.kr/:splat
```

Keep only one canonical URL in QR codes and training materials: `https://safe-link.co.kr`.

## Cutover Checklist

1. Purchase `safe-link.co.kr`.
2. Enable blind registration if approved.
3. Add the domain to the production hosting provider.
4. Set DNS records.
5. Wait for DNS propagation.
6. Confirm HTTPS certificate is active.
7. Set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_NFC_BASE_URL`.
8. Redeploy production.
9. Confirm these URLs:

```text
https://safe-link.co.kr
https://safe-link.co.kr/auth
https://safe-link.co.kr/admin
https://safe-link.co.kr/qr/site
https://safe-link.co.kr/manifest.webmanifest
https://www.safe-link.co.kr
```

10. Generate new QR codes from the admin QR page.
11. Replace temporary URLs in PPT/manuals.
12. Test PWA install on Android Chrome and iPhone Safari.

## PWA Checks

Confirm:

- App name: `SAFE-LINK`
- Home-screen icon shows SEOWON branding.
- App opens in standalone mode.
- Login works after install.
- QR/NFC links open under `safe-link.co.kr`.

## Notes

- `safe-link.co.kr` is enough for the first POC.
- `admin.safe-link.co.kr`, `app.safe-link.co.kr`, and `qr.safe-link.co.kr` are optional future subdomains and do not require separate domain purchases.
- Existing generated QR codes must be regenerated after the domain cutover.
