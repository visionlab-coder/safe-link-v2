# SAFE-LINK Claim 13 and Claim 17 Additive Implementation Note

Date: 2026-05-08
Scope rule: only newly added files; no existing source file was modified.

## Claim 13: SHA-256 Hash Chain

Added a site-scoped append-only audit chain:

- `claim13_hash_chain_events` stores `payload_sha256`, `previous_hash`, and `current_hash`.
- `append_claim13_audit_event(...)` appends an event under a per-site transaction lock.
- `verify_claim13_hash_chain(site_id)` recomputes links and returns only broken rows.
- `src/utils/audit/sha256-hash-chain.ts` canonicalizes JSON, hashes it with SHA-256, and calls the database append function.
- `POST /api/audit/hash-chain` appends an admin-only audit event.
- `GET /api/audit/hash-chain?siteId=...` verifies the chain.

Design intent: TBM attendance, stop-work events, NFC taps, signatures, and translation events can all be recorded as normalized payloads without changing the original business tables.

## Claim 17: Improved Stop-Work Authority

Added an improved stop-work lifecycle table and API:

- `claim17_stop_work_interventions` stores worker, site, reason, hazard category, severity, language, optional GPS, optional photos, status, and escalation deadline.
- `POST /api/stop-work/improved` creates the existing base `stop_work_alerts` row, creates the improved intervention row, and appends a Claim 13 hash-chain audit event.
- Default escalation deadline is five minutes after request creation.

Status values:

- `requested`
- `acknowledged`
- `escalated`
- `resolved`
- `rejected`

## Files Added

- `supabase/migrations/20260508_claim13_17_hash_chain_stop_work.sql`
- `src/utils/audit/sha256-hash-chain.ts`
- `src/app/api/audit/hash-chain/route.ts`
- `src/app/api/stop-work/improved/route.ts`
- `docs/CLAIM_13_17_IMPLEMENTATION_NOTE_2026-05-08.md`

## Integration Notes

Run the new Supabase migration before using the new APIs. Existing screens are not wired to these endpoints yet because the requested constraint was to work only in completely new files.
