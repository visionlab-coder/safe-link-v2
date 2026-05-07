# SAFE-LINK V2 PoC Rehearsal Checklist

This checklist is for the current SAFE-LINK V2 PoC. It is designed to validate the field-critical flow, not every experimental feature in the repository.

## PoC Goal

Demonstrate that a site admin can deliver a TBM to foreign workers in each worker's own language, collect acknowledgment/signature, and continue with translated 1:1 communication while keeping a usable record.

## Test Roles

- `Admin`
  One site manager or safety officer account
- `Worker A`
  Foreign worker account in language 1
- `Worker B`
  Foreign worker account in language 2
- `Optional HQ`
  Observer for `/control`

## Required Environment

- Deployed environment or a stable local environment connected to the real Supabase project
- Valid environment variables for Supabase
- Translation/STT/TTS provider keys configured for the target test
- At least one test site in `sites`
- Test user profiles mapped to the same `site_id`

## Critical Rehearsal Flow

### 1. Auth And Setup

- [ ] Admin can sign in through `/auth`
- [ ] Worker A can sign in through `/auth`
- [ ] Worker B can sign in through `/auth`
- [ ] Each user has a valid profile and `site_id`
- [ ] Admin reaches `/admin`
- [ ] Workers reach `/worker`

Pass condition:
- No user is blocked by missing profile/setup state unless intentionally unconfigured

### 2. TBM Creation

- [ ] Admin opens `/admin/tbm/create`
- [ ] Admin enters Korean TBM content
- [ ] Korean slang normalization preview or result appears
- [ ] Admin sends the TBM successfully
- [ ] New TBM record is stored in `tbm_notices`

Pass condition:
- A fresh TBM is visible in storage and available to workers

### 3. Worker Receipt

- [ ] Worker A can open the latest TBM
- [ ] Worker B can open the latest TBM
- [ ] Each worker sees translated text in their preferred language
- [ ] Each worker can trigger or hear TTS if enabled

Pass condition:
- Workers receive the same TBM in their own language without manual DB intervention

### 4. Acknowledgment And Signature

- [ ] Worker A signs and completes the TBM
- [ ] Worker B signs and completes the TBM
- [ ] Signature completion stores rows in `tbm_ack`
- [ ] Admin sees updated status in `/admin/tbm/status`

Pass condition:
- Admin can distinguish signed vs unsigned workers from the UI

### 5. 1:1 Translated Chat

- [ ] Admin opens `/admin/chat`
- [ ] Admin selects Worker A
- [ ] Admin sends a Korean message
- [ ] Worker A receives translated content
- [ ] Worker A replies in their own language or translated flow
- [ ] Admin receives the reply
- [ ] Messages are stored in `messages`

Pass condition:
- Bidirectional translated text chat works and persists

### 6. Failure Handling

- [ ] If translation fails, the UI still preserves original content or usable fallback behavior
- [ ] If TTS fails, text remains readable
- [ ] If a worker reloads after receipt, the TBM state is still recoverable

Pass condition:
- No single speech/translation failure fully blocks the TBM communication cycle

## Optional Rehearsal Extensions

- [ ] `/admin/live` to `/worker/live` real-time interpretation check
- [ ] `/admin/glossary` term update and visible normalization impact
- [ ] `/control` observer walkthrough
- [ ] `/worker/vision` image hazard support demo

These are useful for demos but do not define PoC pass/fail on their own.

## Final PoC Pass Criteria

- [ ] Admin creates a TBM
- [ ] Workers receive it in their own language
- [ ] Workers can acknowledge/sign
- [ ] Admin can see completion state
- [ ] Admin and worker can continue in translated 1:1 chat
- [ ] Records remain queryable after the demo

## Rehearsal Log

Record one line per run:

| Date | Environment | Languages Tested | Result | Blocking Issue |
| --- | --- | --- | --- | --- |
| YYYY-MM-DD | local / deployed | ko->vi, ko->zh | pass / fail | short note |
