# SAFE-LINK V2 화면·권한 계약

## 화면 계층

| 화면 | 경로 | 허용 역할 | 업무 범위 | 리뉴얼 원칙 |
|---|---|---|---|---|
| 현장 운영 | `/admin` | 현장 관리자 계열과 상위 역할 | TBM·근로자·서명·채팅 | site/trade 범위를 서버에서 강제 |
| 본사 관제 | `/control` | `HQ_ADMIN`, 상위 역할 | 다현장 통합 현황 | 조회·보고 중심 |
| 시스템 관리 | `/system` | `SUPER_ADMIN`, `ROOT`, `HQ_OFFICER` | 현장·계정·전역 설정 | 운영 권한과 개발 권한 분리 |
| 개발자 콘솔 | `/root` | 검증된 `DEVELOPER_EMAILS`만 | AI 엔진·런타임 키 | 일반 관리자 메뉴에서 분리 |
| 근로자 | `/worker` | `WORKER` | TBM 확인·서명·통역·채팅 | 본인·본인 현장만 허용 |

## 역할 계층

| 역할 | 기본 진입 | 데이터 범위 | 비고 |
|---|---|---|---|
| `WORKER` | `/worker` | 본인/소속 현장 | 관리자 API 금지 |
| `TEAM_LEADER` | `/admin` | 본인 site + trade | API/RLS 강제 보강 필요 |
| `SAFETY_OFFICER` | `/admin` | 본인 site | TBM·서명·근로자 운영 |
| `SITE_ADMIN` | `/admin` | 본인 site | 현장 행정 |
| `HQ_ADMIN` | `/control` | 승인된 전체 현장 | 본사 관제 |
| `HQ_OFFICER` | `/system` | 승인된 전체 현장 | 현재 `/admin`도 허용 |
| `ROOT` | `/system` | 전역 | 레거시 최상위 역할 |
| `SUPER_ADMIN` | `/system` | 전역 | 최고 플랫폼 권한 |
| 개발자 allowlist | `/root` | 런타임 설정 | DB role이 아닌 email allowlist |

## 보안 경계

- `RoleGuard`는 UX용 2차 방어이며 최종 권한선이 아니다.
- middleware, API, Supabase RLS가 동일한 role/site/trade 계약을 강제해야 한다.
- `/root`는 `ROOT` DB 역할만으로 접근시키지 않는다.
- `TEAM_LEADER`의 팀 범위는 UI 필터 의존 지점이 있어 상용화 보안 점검 대상이다.
- 운영 RLS 변경은 별도 승인·백업·migration 검증 후 적용한다.
