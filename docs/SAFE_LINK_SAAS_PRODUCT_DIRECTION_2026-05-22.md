# SAFE-LINK SaaS Product Direction

Date: 2026-05-22

## Core Positioning

SAFE-LINK is not just a safety app. It is a field safety automation SaaS that reduces repetitive work for safety managers and site engineers.

The product promise is:

> Workers only check, learn, and sign. SAFE-LINK creates the documents.

## Primary Users

### Worker

The worker experience must be simple enough for a first-time user.

The worker should only need to:

1. Open by QR or NFC
2. Select language
3. Complete health check
4. Review TBM or safety training
5. Sign
6. See completion

Do not expose technical concepts such as token, session, API, RLS, HMAC, database, or audit chain to workers.

### Safety Manager / Site Engineer

The manager experience must reduce daily paperwork.

The manager should be able to:

1. Start today's TBM or safety training
2. See entry and signature status
3. Check missing signatures
4. Generate required documents automatically
5. Export PDF, Excel, Word, and HWP where supported
6. Review site, date, worker, and training records later

The manager should not need to manually create attendance sheets, TBM signature sheets, education certificates, or daily safety summaries.

## Required Automation Flow

Minimum SaaS workflow:

1. Worker enters by QR or NFC
2. SAFE-LINK resolves site, worker, language, and session
3. Worker completes health check
4. Worker receives TBM or safety training in their language
5. Worker signs digitally
6. SAFE-LINK stores time, site, training, language, worker, manager, and signature evidence
7. SAFE-LINK automatically generates:
   - TBM attendance sheet
   - TBM signature sheet
   - Safety education confirmation
   - Daily safety log entry
   - Health check record
   - ESG safety report aggregates
8. Manager exports documents when needed

## UX Principles

### Worker Screens

- One screen, one action
- Large text
- Short sentences
- Clear primary button
- Native language first
- Status shown by simple color and icon
- No admin or system language
- No technical error text

Preferred worker labels:

- Select language
- Check today's condition
- Review safety training
- Sign here
- Completed
- Ask manager

Avoid worker labels:

- Token
- Session
- RLS
- API
- Sync failed
- Database error
- Auth provider
- HMAC

### Manager Screens

- Organize by field job, not by technical module
- Show today's work first
- Highlight missing actions
- Put exports near completed data
- Make auto-generated documents visible
- Keep advanced diagnostics under system/admin-only screens

Preferred manager actions:

- Start today's training
- Open QR/NFC entry
- Check unsigned workers
- Generate documents
- Export report
- Close session

## Product Differentiation

Compared with advanced site education rooms such as the current Daewoo example at Gwacheon T-Town, SAFE-LINK should go further:

- Works in education rooms, field gates, TBM locations, and temporary field spaces
- Supports QR and NFC from the same workflow
- Supports multilingual TBM and safety education by default
- Creates compliance documents automatically after signature
- Keeps audit evidence without making the user manage it manually
- Aggregates field safety data into ESG and head-office reports
- Can be sold as SaaS across multiple sites and contractors

## Implementation Guardrails

Do not break working safety flows.

When improving SAFE-LINK:

1. Do not change authentication, QR/NFC, RLS, signature, TBM, or document generation logic unless the task explicitly requires it.
2. Prefer UI copy, layout, and shared component changes before touching business logic.
3. Keep changes small and independently verifiable.
4. Do not mix UI work, security fixes, API integrations, and document automation in one commit.
5. Always run build after code changes.
6. If a change affects worker entry or signature, run a focused smoke test before deployment.

## Near-Term Execution Order

### Phase 1: POC Reliability

- QR guest entry must work without NFC vendor API
- Admin login and role routing must be stable
- Worker session creation errors must be understandable
- Signature save and TBM acknowledgement must be reliable
- Existing RLS/security fixes must be cross-checked

### Phase 2: Simple Field Flow

- Worker home should focus on today's required action
- QR/NFC entry should lead directly to language, health check, education, and signature
- Completion screen should clearly say documents are being prepared
- Manager dashboard should show today's progress and missing signatures

### Phase 3: Document Automation

- Generate TBM signature sheet after worker signatures
- Generate safety education confirmation after education signature
- Add daily safety log auto-entry
- Add export controls for PDF, Excel, Word, and HWP where feasible
- Keep document templates site-configurable

### Phase 4: SaaS Packaging

- Multi-site dashboard
- Contractor/company grouping
- Head-office ESG safety report
- Audit trail review
- Domain and PWA readiness
- POC onboarding guide

## Success Criteria

SAFE-LINK is successful when:

- A first-time worker can complete the flow without explanation.
- A safety manager can see who has not completed training immediately.
- Site engineers no longer recreate the same safety documents manually.
- Signed records can be exported as evidence.
- The product can be demonstrated as a repeatable SaaS workflow, not a one-site custom tool.
