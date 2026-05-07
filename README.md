# SAFE-LINK V2

SAFE-LINK V2 is a field communication web app for construction sites. It is built to deliver TBM (Tool Box Meeting) safety briefings from managers to foreign workers in each worker's native language, collect acknowledgment and signature records, and support 1:1 translated communication on site.

## Current Product Scope

This repository is currently focused on the PoC/beta path for the following core loop:

1. Admin signs in and creates a TBM notice
2. The TBM is normalized from field slang into standard Korean
3. Workers receive the TBM and read or listen in their preferred language
4. Workers acknowledge and sign the TBM
5. Admin monitors signed vs unsigned workers
6. Admin and worker can continue with translated 1:1 chat

The swarm, HQ intelligence, and extended assistant layers in this repository should be treated as future-facing or demo-supporting features unless explicitly marked otherwise.

## Authoritative Documents

- `SAFE-LINK_MASTER_SPEC_v1.0.md`
  Current product and architecture baseline for the PoC
- `SITE.md`
  Route-level and feature-level implementation snapshot
- `SAFE-LINK_AGENT_SPEC_v2.0.md`
  Future vision for multi-agent expansion, not the current delivery baseline
- `docs/POC_REHEARSAL_CHECKLIST.md`
  End-to-end PoC pass/fail rehearsal checklist
- `docs/TRANSLATION_VALIDATION_MATRIX.md`
  Language validation sheet for field-safe TBM delivery
- `docs/POC_DB_PRECHECK_GUIDE.md`
  DB precheck and minimal-repair guide for PoC rehearsal
- `docs/PRODUCTION_HARDENING_CHECKLIST.md`
  File-by-file production hardening plan before commercialization
- `docs/RLS_AUDIT_2026-04-30.md`
  RLS audit findings and core policy hardening draft

## Stack

- Next.js App Router
- Tailwind CSS
- Supabase Auth / Postgres / Realtime
- Cloudflare Workers via OpenNext for deployment
- Google Cloud, OpenAI, and Naver Papago based speech/translation pipeline depending on route and fallback path

## Key Routes

- `/auth`
  Sign-in and role entry flow
- `/auth/setup`
  Profile and site setup flow
- `/admin`
  Admin dashboard
- `/admin/tbm/create`
  TBM authoring and broadcast
- `/admin/tbm/status`
  TBM acknowledgment monitoring
- `/admin/chat`
  Admin-to-worker translated chat
- `/worker`
  Worker dashboard
- `/worker/tbm/[id]`
  Worker TBM review and signature
- `/worker/chat`
  Worker-to-admin translated chat
- `/control`
  HQ control view

Additional feature routes exist for live interpretation, quiz, QR, vision, travel, and system administration.

## Local Development

Requirements:

- Node.js 20+
- npm
- Supabase project with required tables

Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Required Environment Variables

Browser and server:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Server-side integrations used by current routes:

```bash
GOOGLE_CLOUD_API_KEY=
OPENAI_API_KEY=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

Not every route requires every key, but the current translation and speech flows rely on these integrations across primary and fallback paths.

## Deployment

This repository is configured for Cloudflare deployment through OpenNext.

Relevant scripts:

```bash
npm run build
npm run preview
npm run deploy
```

Relevant config files:

- `wrangler.toml`
- `open-next.config.ts`
- `next.config.ts`

Do not follow Vercel-first deployment instructions for this repository unless you are intentionally creating a separate Vercel deployment path.

## Current PoC Readiness

The repository is closest to a strong PoC / beta candidate, not a fully production-hardened release.

Strong areas:

- Admin/worker split
- TBM create/read/sign flow
- 1:1 translated chat
- Speech and translation integrations
- Supabase-backed persistence

Still needs cleanup before a stable field PoC:

- Document consistency
- Route/API contract alignment in specs
- Translation quality validation by target language
- Deployment/ops documentation cleanup
- One full rehearsal log for the end-to-end TBM cycle
