# SQ Link V3 Supabase → PostgreSQL 이관 대조

검증일: 2026-08-05

## 원본 재추출 결과

Supabase를 읽기 전용으로 다시 추출했다. 운영 PostgreSQL의 최신 이관 배치 2번(2026-07-29)과 비교했을 때 아래 주요 원본 건수는 변하지 않았다.

| 원본 | 건수 | 운영 매핑 결과 |
|---|---:|---|
| auth.users | 77 | users 77 IMPORTED |
| profiles | 42 | users 42 MAPPED |
| nfc_workers | 19 | worker_profiles 19 IMPORTED, 추가 users 5 IMPORTED |
| sites | 33 | sites 33 IMPORTED |
| tbm_notices | 95 | tbm_notices 95 IMPORTED |
| tbm_ack | 20 | acknowledgements 20, file_objects 20 IMPORTED |
| claim13_pledges | 6 | pledges 6, file_objects 6 IMPORTED |
| messages | 40 | chat_messages 29 IMPORTED, 11 BLOCKED |
| live_translations | 2,115 | live_translation_events 2,115 IMPORTED |
| construction_glossary | 277 | 277 IMPORTED |
| safety_education_library | 451 | 451 IMPORTED |
| stop_work_alerts | 15 | 15 IMPORTED |
| claim17_stop_work_interventions | 16 | 16 IMPORTED |
| tbm_quiz_sessions / responses | 13 / 31 | 13 / 31 IMPORTED |
| nfc_worker_daily_access | 30 | 30 IMPORTED |

원본의 나머지 0건 테이블도 재추출 목록에 포함했다. 전체 원본 테이블 목록은 `scripts/export-supabase-v3-source.mjs`가 관리한다.

## 파일 무결성

- `tbm_ack` 서명 20건과 `claim13_pledges` 서명 6건을 원본 base64에서 다시 디코딩했다.
- 26개 파일, 총 535,169 bytes에 대해 SHA-256을 산출했다.
- 운영 MinIO `safe-link-v3` bucket의 대응 object를 전건 다운로드해 byte size와 SHA-256을 비교했고 26/26건이 일치했다.

## 미해결 경고

운영 이관 배치에는 ERROR는 없고 WARNING 178건이 있다.

| 경고 | 건수 | 필요한 결정/조치 |
|---|---:|---|
| CREDENTIAL_RESET_REQUIRED | 77 | 이관 계정에 비밀번호 재설정 안내/전달 |
| SITE_REASSIGNMENT_REQUIRED | 72 | 서원건설이 계정별 정식 현장 지정 |
| UNSUPPORTED_NON_WORKER_CHAT | 11 | 비근로자 대화를 활성 채팅으로 변환할지 기록 보관만 할지 승인 |
| REFERENCE_ONLY_WORKER_PROFILE | 10 | 참조 전용 근로자 유지/통합 승인 |
| MISSING_ORIGINAL_ACTOR | 5 | 원 작성자 부재 기록의 대체 작성자 승인 |
| ROOT_REAPPROVAL_REQUIRED | 2 | ROOT 권한 재승인 |
| SYNTHETIC_STOP_WORK_ALERT | 1 | 합성된 작업중지 알림 이력 승인 |

## 판정

- 이관 범위와 원본 건수 확정: 완료
- 서명 파일 hash 대조: 완료
- 최종 업무 이관/UAT 판정: 보류. 위 178건 경고에 대한 발주처 승인과 현장 재지정이 필요하다.
- 최종 증분 전환: 원본 건수 변화는 없었지만, 공식 동결 시각과 담당자 승인이 없으므로 완료로 처리하지 않는다.

