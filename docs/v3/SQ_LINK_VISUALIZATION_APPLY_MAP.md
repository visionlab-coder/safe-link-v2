# SQ-LINK UI/UX 시각화 적용 맵

기준 자료: `docs/mocks/sq-link-page-visualization.html` (2026-08-07)

## 적용 원칙

- HTML mock은 화면 구조와 자산 적용 기준으로만 사용한다. mock의 브라우저·휴대폰 외곽 프레임은 운영 제품에 넣지 않는다.
- `웹` segment의 `website` 이미지는 데스크톱/태블릿 웹 화면에, `모바일` segment의 `android` 이미지는 639px 이하 모바일 웹에 적용한다. TBM은 별도 `mobile-v4/web` 및 `mobile-v4/mobile` 자산을 사용한다.
- 인증, 권한, API, QR/NFC, TBM 서명, 내보내기 등의 기존 이벤트와 데이터 흐름은 유지한다.

## Mock 화면과 V3 기능 매핑

| Mock 화면 | 기존 V3 화면 | 적용 기준 |
| --- | --- | --- |
| 로그인 · 본인 확인 | `/`, `/auth` | `access` 웹/모바일 자산과 접근 화면 구조 |
| 관리자 통합 현황 | `/admin` | `dashboard` 웹/모바일 자산과 관제 구조 |
| 신규 · QR 근로자 등록 | `/admin/workers/enroll`, `/qr/site` | `onboarding` |
| NFC · QR 출입 | `/admin/nfc`, `/admin/qrcode`, `/admin/team-qr` | `nfc-qr` |
| 다국어 TBM | `/admin/tbm/create`, `/admin/tbm/status`, `/worker/tbm/[id]` | `tbm` |
| 안전교육 · 퀴즈 | `/admin/quiz`, `/worker/quiz` | `education` |
| 실시간 현장 모니터링 | `/admin/live`, `/admin/tbm/live`, `/worker/live` | `live` |
| 다국어 통역 · 용어 | `/admin/chat`, `/worker/chat`, `/admin/glossary`, `/travel` | `translate` |
| ESG 안전 리포트 | `/admin/esg` | `esg` |

## Mock 미제공 또는 직접 매핑되지 않는 화면

아래 화면은 mock에 독립 화면이 없으므로, 위 디자인 토큰(밝은 캔버스, 네이비/블루 행동색, 지표 카드, 작업 단계, 웹/모바일 이미지 분기)을 기준으로 신규 설계한다.

| V3 화면 | 신규 설계 사유 |
| --- | --- |
| `/auth/reset-password`, `/auth/setup` | 비밀번호 재설정·프로필 설정 mock 없음 |
| `/root`, `/system`, `/control` | 시스템/본사 운영 화면 mock 없음 |
| `/lab`, `/lab/on-device-speech`, `/poc/ai-lab`, `/tts-test` | AI 실험·음성 테스트 화면 mock 없음 |
| `/verify/[reportId]` | 외부 보고서 검증 화면 mock 없음 |
| `/worker/vision`, `/worker/pledge` | 위험 감지와 서약 세부 흐름 mock 없음 |
| `/admin/incentive`, `/admin/guide/*` | 인센티브·가이드 세부 화면 mock 없음 |
| 건강 확인 | mock에는 `health` 시각화가 있으나 현재 독립 V3 라우트가 없음. 기존 기능이 확인되면 해당 흐름에 적용하고, 없으면 새 기능을 임의로 만들지 않는다. |
| 서명 · 확인서 자동화 | `documents` mock은 있으나 독립 통합 문서 페이지가 없음. 기존 TBM 서명/상태/내보내기 흐름에 적용한다. |
| 안전일지 자동화 | `diary` mock은 있으나 독립 안전일지 페이지가 없음. 기존 NFC 일일 기록 화면에 적용한다. |

## 검증 기준

1. 768px 이상에서 `website` 자산과 웹 레이아웃이 렌더링된다.
2. 639px 이하에서 `android` 자산과 모바일 전용 정보 밀도가 렌더링된다.
3. 화면 개편 후 기존 버튼의 URL, API 호출, 권한 guard, 폼 제출과 내보내기 기능이 유지된다.
