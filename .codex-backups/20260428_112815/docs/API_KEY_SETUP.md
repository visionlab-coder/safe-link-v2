# SAFE-LINK V2 API Key Setup

This guide reflects the current repository runtime. The app is configured for Cloudflare deployment, with Supabase as the backend and multiple speech/translation providers used across routes.

## Active Runtime Assumptions

Current code paths reference these keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GOOGLE_CLOUD_API_KEY=
OPENAI_API_KEY=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

## Provider Usage In Current Code

- `GOOGLE_CLOUD_API_KEY`
  Required by the main translation route, TTS route, vision route, quiz route, and several Gemini-backed helper routes
- `OPENAI_API_KEY`
  Used by the STT route for Whisper-based transcription when available
- `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET`
  Used by translation routes where Papago is enabled as a supported path

Important:

- The main translate route still requires `GOOGLE_CLOUD_API_KEY` even if Papago keys are present.
- Papago should be treated as a supported translation path, not as the sole production dependency for the current codebase.

## Local `.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GOOGLE_CLOUD_API_KEY=
OPENAI_API_KEY=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

## Cloudflare Setup

Configure runtime secrets and vars in Cloudflare for the Worker/Pages deployment used by this repository.

Public vars already appear in `wrangler.toml`, but sensitive keys should be stored as secrets, not committed config.

Examples:

```bash
wrangler secret put GOOGLE_CLOUD_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put NAVER_CLIENT_ID
wrangler secret put NAVER_CLIENT_SECRET
```

If you also need to set public Supabase values through the dashboard instead of file config, mirror:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Verification Checklist

1. `/auth` loads without missing Supabase env errors
2. `/admin/tbm/create` can open and submit a TBM notice
3. `/worker/tbm/[id]` can load a TBM and request translation
4. `/api/translate` succeeds with `GOOGLE_CLOUD_API_KEY` configured
5. `/api/stt` can use Whisper when `OPENAI_API_KEY` is configured
6. `/admin/chat` and `/worker/chat` can store translated messages

## Current Operational Caveat

If deployment or QA documentation still mentions Vercel as the default production path, treat that as stale. This repository is currently aligned to Cloudflare deployment.
