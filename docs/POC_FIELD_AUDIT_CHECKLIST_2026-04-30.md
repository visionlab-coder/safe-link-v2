# SAFE-LINK V2.0 Field PoC Audit Checklist

Last updated: 2026-04-30
Scope: 2026-05 field PoC readiness check
Rule: Items already proven in repo review + rehearsal are marked simply. Items with dependency risk or incomplete UX are marked for field verification or follow-up.

## 1. Core PoC Flow

- `[PASS]` `/` first landing page opens and routes to admin/worker entry
- `[PASS]` `/auth` language -> role -> login flow works
- `[PASS]` `/auth/setup` profile setup and role-based redirect work
- `[PASS]` `/admin` admin dashboard opens after role check
- `[PASS]` `/worker` worker dashboard opens after role check
- `[PASS]` `/admin/tbm/create` TBM creation, normalization, save, broadcast flow works
- `[PASS]` `/worker/tbm/[id]` latest/today TBM receipt, translation, TTS, signature flow works
- `[PASS]` `/admin/tbm/status` acknowledgment/signature monitoring works
- `[PASS]` `/admin/chat` and `/worker/chat` 1:1 translated chat round-trip works
- `[PASS]` `profiles`, `tbm_notices`, `tbm_ack`, `messages`, `construction_glossary` PoC DB schema precheck passed

## 2. Fixed During Audit

- `[FIXED]` `/admin/qrcode` now has `RoleGuard` protection
- `[FIXED]` `/admin/qrcode` QR image download button now works
- `[FIXED]` `/admin/qrcode` QR target URL copy button now works

## 3. Must Recheck On Site

These are not declared broken, but they depend on live devices, browser permissions, or external APIs.

- `[VERIFY]` `/api/check`
  Confirm all required services show `ok` before the morning briefing.
- `[VERIFY]` `/api/translate`
  Test `ko -> vi`, `ko -> zh`, `ko -> th`, `ko -> en` with real TBM sentences.
- `[VERIFY]` `/api/tts`
  Confirm mobile device audio autoplay / button-trigger playback behavior.
- `[VERIFY]` `/api/stt`
  Confirm microphone permission and site noise tolerance.
- `[VERIFY]` `/admin/live` -> `/worker/live`
  Real-time live interpretation should be tested with 1 admin + 2 workers on actual site network.
- `[VERIFY]` `/admin/quiz` -> `/worker/quiz`
  Confirm active quiz creation, translated question rendering, answer submit, and response monitoring.
- `[VERIFY]` `/worker/vision`
  Confirm camera permission, image upload, Gemini response speed, and failure handling.
- `[VERIFY]` `/admin/glossary`
  Core CRUD is review-ready, but Google Sheets / Drive export depends on provider token and should be tested once with the real login method.

## 4. Not Core To May PoC Pass/Fail

These should not block PoC start. Treat them as optional or demo-extension surfaces.

- `[OPTIONAL]` `/control`
  HQ control dashboard is present, but much of it is visual / monitoring-oriented.
- `[OPTIONAL]` `/system`
  System site management exists, but it is not needed for daily field PoC operation.
- `[OPTIONAL]` `/api/agents/*`
  Agent orchestration and swarm endpoints are not core field PoC pass/fail criteria.
- `[OPTIONAL]` `/travel`, `/api/travel/*`
  Separate experimental flow, not part of core field TBM PoC.

## 5. Known PoC Risks

- `[RISK]` Worker dashboard includes some presentation-only values like static team sign rate text. This does not break the core flow, but it should not be used as an evidence source.
- `[RISK]` Live, quiz, vision, and advanced pronunciation paths rely on Google/Gemini and mobile permissions. If they fail, keep TBM text/signature/chat as the operational fallback.
- `[RISK]` Glossary export to Google services may fail depending on auth provider token availability.

## 6. Daily Start Checklist

- `[ ]` Open `/api/check` or admin dashboard health section and verify required services
- `[ ]` Admin login works
- `[ ]` Worker login works on at least 2 devices
- `[ ]` Create one test TBM and verify worker receipt
- `[ ]` Confirm one worker signature save
- `[ ]` Confirm admin status page reflects signature
- `[ ]` Confirm one admin->worker chat message and one worker reply
- `[ ]` If live interpretation is planned that day, test `/admin/live` and `/worker/live` once before the briefing
- `[ ]` If quiz is planned that day, create one sample quiz and answer it once
- `[ ]` If vision demo is planned that day, test one camera capture on the actual device

## 7. Immediate Triage Order If Something Breaks

1. `/api/check` and environment status
2. Supabase auth/session
3. `profiles.site_id`, `preferred_lang`, `role`
4. `tbm_notices` latest row creation
5. `tbm_ack` insert
6. `messages` insert/realtime delivery
7. External API-specific features: translate, tts, stt, live, quiz, vision

## 8. PoC Go/No-Go

- `GO` if core PoC flow in section 1 works and daily start checklist passes
- `GO WITH LIMITS` if live/quiz/vision fail but TBM + signature + chat still work
- `NO-GO` only if auth, TBM receipt, signature save, or chat round-trip fail
