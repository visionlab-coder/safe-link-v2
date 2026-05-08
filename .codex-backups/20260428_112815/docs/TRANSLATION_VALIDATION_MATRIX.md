# SAFE-LINK V2 Translation Validation Matrix

This document defines how to validate whether SAFE-LINK translation quality is good enough for a field PoC.

## Validation Goal

The goal is not literary translation quality. The goal is whether a foreign worker can correctly understand a TBM safety instruction in the field with low ambiguity.

## Priority Languages

Validate at least these languages first:

- Vietnamese (`vi`)
- Chinese (`zh`)
- English (`en`)
- Thai (`th`)

Add other active site languages after the first pass.

## Evaluation Rules

Each test sentence should be checked for:

1. `Meaning preserved`
   The core instruction is still present
2. `Risk keyword preserved`
   Danger/action terms are not softened away
3. `Action clarity`
   The worker can tell what to do
4. `Politeness / tone`
   Korean-side normalization remains formal where applicable
5. `Field usability`
   The sentence is understandable in a construction context

Use this rating:

- `PASS`
  Safe enough for PoC use
- `WARN`
  Understandable but awkward, should be improved
- `FAIL`
  Dangerous, misleading, or unclear

## Core TBM Sentence Set

Use these as the minimum PoC validation set.

| ID | Korean Source | Validation Focus |
| --- | --- | --- |
| T1 | 작업 전 안전모와 안전벨트를 반드시 착용해 주세요. | PPE instruction |
| T2 | 고소 작업 구역에서는 추락 위험이 있으니 이동 시 주의해 주세요. | fall risk |
| T3 | 크레인 작업 반경 안으로 들어가지 마세요. | restricted area |
| T4 | 전기 패널 주변에서는 젖은 손으로 작업하지 마세요. | electric hazard |
| T5 | 위험한 상황을 발견하면 즉시 관리자에게 알려 주세요. | report escalation |
| T6 | 오늘은 타설 작업이 있으니 통제선 밖에서 대기해 주세요. | task-specific waiting |
| T7 | 장비 점검이 끝나기 전에는 기계를 작동하지 마세요. | machine lockout behavior |
| T8 | 비계 위에서는 뛰거나 장난치지 마세요. | unsafe behavior stop |
| T9 | 작업을 시작하기 전에 오늘 TBM 내용을 꼭 확인해 주세요. | TBM acknowledgment intent |
| T10 | 몸이 아프거나 위험하다고 느끼면 즉시 작업을 중지해 주세요. | stop work authority |

## Validation Sheet Template

Copy this table and fill one row per sentence/language pair.

| ID | Target Lang | Output Summary | Meaning Preserved | Risk Keyword Preserved | Action Clear | Pass/Warn/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T1 | vi | short note | yes/no | yes/no | yes/no | PASS |  |

## Failure Patterns To Watch

- Danger terms become generic or weaker
- “Do not” becomes optional wording
- Waiting/stopping instructions sound like recommendations rather than commands
- Construction-specific words are mistranslated into everyday meanings
- The sentence is technically correct but too unnatural for a worker to act on quickly

## PoC Acceptance Threshold

- No `FAIL` allowed in the top 10 sentence set for the 4 priority languages
- `WARN` is acceptable only if the core action remains obvious
- If a language has 2 or more `FAIL` rows, do not use it in the live PoC without glossary or prompt correction

## Recommended Workflow

1. Run each source sentence through the current app flow
2. Capture translated output from the worker-side TBM view
3. Review with a fluent speaker or bilingual reviewer if available
4. Log `WARN` and `FAIL` cases
5. Update glossary or translation prompt behavior
6. Re-run the same sentence set
