# SAFE-LINK Site Map And Status

## Product Position

SAFE-LINK is a construction-site communication app focused on:

- TBM delivery in workers' native languages
- acknowledgment and signature capture
- translated 1:1 communication between admin and workers
- field-friendly mobile-first interaction

This file reflects the implementation status in the current repository, not the original early roadmap.

## Global UI Direction

- Mobile-first layouts
- Large touch targets
- High-contrast dark visual system
- Admin and worker role separation
- Realtime or near-realtime field communication

## Core Routes

- `[x] /`
  Landing page
- `[x] /auth`
  Sign-in / role entry
- `[x] /auth/setup`
  Profile setup
- `[x] /admin`
  Admin dashboard
- `[x] /worker`
  Worker dashboard
- `[x] /control`
  HQ control dashboard

## TBM Flow

- `[x] /admin/tbm/create`
  Admin writes or records TBM and broadcasts it
- `[x] /admin/tbm/status`
  Admin monitors worker acknowledgment and signature status
- `[x] /worker/tbm/[id]`
  Worker reviews translated TBM and signs it

## Communication Flow

- `[x] /admin/chat`
  Admin-side translated chat
- `[x] /worker/chat`
  Worker-side translated chat

## Extended Field Features

- `[x] /admin/live`
  Admin live interpretation view
- `[x] /worker/live`
  Worker live interpretation view
- `[x] /admin/quiz`
  Safety quiz creation
- `[x] /worker/quiz`
  Safety quiz participation
- `[x] /admin/glossary`
  Glossary management
- `[x] /admin/qrcode`
  QR workflow support
- `[x] /worker/vision`
  Vision-based hazard support
- `[x] /system`
  System/site administration
- `[x] /travel`
  Separate travel-talk style communication feature branch

## Current PoC Baseline

The current PoC should be evaluated against these flows first:

1. Admin login and profile setup
2. TBM creation and storage
3. Worker TBM receipt and signature
4. Admin signature monitoring
5. Admin-worker translated chat

## Out Of Scope For PoC Pass/Fail

These may support demos, but they should not define PoC success on their own:

- swarm visualization
- HQ narrative intelligence demos
- travel sub-product behavior
- advanced vision and quiz expansion

## Next Cleanup Targets

- align spec route names with real route names
- align documented API contracts with actual data flow
- separate core SAFE-LINK scope from experimental feature branches
