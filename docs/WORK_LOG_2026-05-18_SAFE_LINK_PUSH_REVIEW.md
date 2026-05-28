# SAFE-LINK GitHub Push / Work Log - 2026-05-18

## 1. Repository

- Local path: `C:\Users\seowo\Documents\dev\seowon-projects\SAFE-LINK-V2`
- Remote: `https://github.com/visionlab-coder/safe-link-v2.git`
- Branch: `master`
- Current remote/local HEAD at check time: `9bde8a3`

## 2. Important Clarification

The repository currently contains a later commit:

- `9bde8a3 feat(pronunciation): v2.5 14개 언어 발음 시스템 v2.0 이식`

This commit is currently on `origin/master` and touches only:

- `src/utils/hangulize-nonlatin.ts`
- `src/utils/hangulize.ts`

The domain preparation commit pushed during the latest domain work was:

- `372ed05 docs(domain): add safe-link.co.kr cutover plan`

So, the latest repository HEAD is now the v2.5 pronunciation migration commit, but the domain work itself is commit `372ed05`.

## 3. Recent Commits

```text
9bde8a3 feat(pronunciation): v2.5 14개 언어 발음 시스템 v2.0 이식
372ed05 docs(domain): add safe-link.co.kr cutover plan
7905ec0 feat(brand): add SEOWON logo and PWA assets
8b00f59 feat(admin): 데이터 내보내기 + 보안 마이그레이션 반영
```

## 4. Commit Details

### 4.1 `8b00f59 feat(admin): 데이터 내보내기 + 보안 마이그레이션 반영`

Purpose:

- Admin pages with generated/admin data received export capability.
- ESG safety report was expanded with generated summary data and chart-ready data.
- Security SQL migration fixes were included.

Changed files:

```text
src/app/admin/chat/page.tsx
src/app/admin/esg/page.tsx
src/app/admin/glossary/page.tsx
src/app/admin/incentive/page.tsx
src/app/admin/live/page.tsx
src/app/admin/nfc/daily-logs/page.tsx
src/app/admin/quiz/page.tsx
src/app/admin/tbm/status/page.tsx
src/app/admin/workers/page.tsx
src/app/api/glossary/fetch-url/route.ts
src/components/ExportMenu.tsx
src/utils/export-files.ts
supabase/migrations/20260518_qr_guest_worker_unique.sql
supabase/migrations/20260518_sites_rls_worker_restrict.sql
```

Main changes:

- Added reusable `ExportMenu`.
- Added export utility support for PDF / Excel / Word / HWP-style document output.
- Added export buttons to admin data pages.
- Added ESG report summary and visual data support.
- Hardened QR guest worker unique index migration.
- Hardened `sites` RLS migration so workers only see their own site.
- Connected glossary URL DNS preflight check for SSRF hardening.

Verification:

- `npm.cmd run build` passed after fixes.
- `node scripts\simple_check.js` passed after escalation/network permission.

### 4.2 `7905ec0 feat(brand): add SEOWON logo and PWA assets`

Purpose:

- Add SEOWON branding to SAFE-LINK.
- Add PWA manifest and icons.
- Prepare app-like installation behavior.

Changed files:

```text
public/brand/seowon-logo-compact-transparent.png
public/brand/seowon-logo-compact.png
public/brand/seowon-logo-transparent.png
public/brand/seowon-logo.png
public/icons/apple-touch-icon.png
public/icons/icon-192.png
public/icons/icon-512.png
src/app/admin/page.tsx
src/app/auth/page.tsx
src/app/layout.tsx
src/app/manifest.ts
src/app/page.tsx
src/app/worker/page.tsx
src/components/BrandLogo.tsx
```

Main changes:

- Converted supplied SEOWON logo image into web-ready transparent PNG assets.
- Added `BrandLogo` component.
- Added PWA manifest.
- Added 192px / 512px / Apple touch icons.
- Applied SEOWON logo to landing, auth, admin, and worker screens.
- Updated metadata and app title branding.

Verification:

- `npm.cmd run build` passed.
- GitHub push succeeded to `origin/master`.

### 4.3 `372ed05 docs(domain): add safe-link.co.kr cutover plan`

Purpose:

- Prepare domain connection plan for `safe-link.co.kr`.
- Clarify POC domain structure before domain purchase approval is completed.

Changed files:

```text
docs/POC_DOMAIN_CUTOVER_SAFE_LINK_CO_KR.md
```

Main contents:

- POC representative domain: `https://safe-link.co.kr`
- Redirect: `https://www.safe-link.co.kr` to `https://safe-link.co.kr`
- Admin path: `https://safe-link.co.kr/admin`
- Worker path: `https://safe-link.co.kr/worker`
- QR path: `https://safe-link.co.kr/qr/site`
- Recommended environment variables:
  - `NEXT_PUBLIC_SITE_URL=https://safe-link.co.kr`
  - `NEXT_PUBLIC_NFC_BASE_URL=https://safe-link.co.kr`
- DNS setup checklist for Vercel or Cloudflare Workers.
- Reminder that QR/NFC stickers should be regenerated after final domain cutover.

Verification:

- GitHub push succeeded to `origin/master`.
- This was a documentation-only commit.

### 4.4 `9bde8a3 feat(pronunciation): v2.5 14개 언어 발음 시스템 v2.0 이식`

Purpose shown by commit title:

- Port v2.5 14-language pronunciation system into v2.0.

Changed files:

```text
src/utils/hangulize-nonlatin.ts
src/utils/hangulize.ts
```

Git stat:

```text
2 files changed, 504 insertions(+), 10 deletions(-)
```

Review note:

- This is currently the latest `origin/master` commit.
- It should be reviewed separately from the domain/branding/export/security work.
- Its blast radius appears limited to language/pronunciation utility code based on the file list.

## 5. Current Untracked Local Files

The following files/directories exist locally but are not committed:

```text
docs/generated/
scripts/capture-safe-link-screens.mjs
scripts/generate_safe_link_admin_manual.py
scripts/generate_safe_link_admin_manual_real.py
scripts/generate_safe_link_admin_manual_updated.py
scripts/inspect_pptx.py
scripts/inspect_pptx_fonts.py
scripts/prepare-training-admin.mjs
```

Interpretation:

- These are training PPT/manual generation artifacts and helper scripts.
- They were intentionally not mixed into the production app commits.
- If the team wants PPT generation tracked in GitHub, these should be reviewed and committed as a separate docs/tooling commit.

## 6. Domain Behavior

Current code fallback for QR/NFC base URL:

```ts
export const NFC_BASE_URL =
  process.env.NEXT_PUBLIC_NFC_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://safe-link-v2.vercel.app";
```

Implication:

- Before domain setup, the app falls back to `https://safe-link-v2.vercel.app`.
- After purchasing and connecting `safe-link.co.kr`, set:
  - `NEXT_PUBLIC_SITE_URL=https://safe-link.co.kr`
  - `NEXT_PUBLIC_NFC_BASE_URL=https://safe-link.co.kr`
- Then redeploy so newly generated QR/NFC links use the official domain.

## 7. Items For Claude Code Review

- Verify whether `9bde8a3` correctly ports the v2.5 pronunciation logic into v2.0.
- Review `src/utils/hangulize.ts` and `src/utils/hangulize-nonlatin.ts` for regression risk.
- Verify all call sites of `hangulize` still receive expected output.
- Confirm whether training PPT generator scripts should be committed or kept local.
- Confirm whether domain setup should remain Vercel-first or be migrated to Cloudflare Workers later.
