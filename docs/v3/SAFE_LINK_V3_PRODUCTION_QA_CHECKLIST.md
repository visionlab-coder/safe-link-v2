# SQ Link V3 운영 QA 체크리스트

작성일: 2026-07-23  
대상 환경: 회사 AWS 운영 서버  
프론트 URL: https://app.safe-link.co.kr  
API URL: https://api.safe-link.co.kr  
대표 도메인: https://safe-link.co.kr -> https://app.safe-link.co.kr  
기존 SQCM 주소: https://sqcm.safe-link.co.kr

## 목적

이 문서는 회사 AWS에 배포된 SQ Link V3를 실제 서비스처럼 검증하기 위한 QA 기준이다. 단순히 화면이 열리는지 보는 것이 아니라, 인증, 권한, 현장 격리, TBM, QR/NFC, 채팅, 번역, 서명, 운영 로그까지 실제 운영 흐름 기준으로 확인한다.

## QA 판정 기준

각 항목은 아래 상태 중 하나로 기록한다.

```text
PASS: 정상
FAIL: 오류 또는 운영 불가
BLOCKED: 테스트 계정, 데이터, 외부 API key 등 선행 조건 부족
N/A: 이번 운영 범위에서 제외
```

운영 오픈 전 최소 기준:

- P0 항목은 모두 PASS여야 한다.
- P1 항목은 FAIL이 있으면 원인과 우회 방법을 기록해야 한다.
- P2 항목은 운영 후 개선 항목으로 넘길 수 있다.

## QA 준비물

| 구분 | 필요 항목 | 상태 |
|---|---|---|
| 운영 URL | `https://app.safe-link.co.kr/auth` 접속 가능 | TODO |
| API URL | `https://api.safe-link.co.kr/actuator/health/readiness` 응답 `UP` | TODO |
| ROOT 계정 | 최초 시스템 관리자 계정 | TODO |
| 관리자 계정 | SITE_ADMIN 또는 SAFETY_MANAGER 계정 | TODO |
| 근로자 계정 | QR 또는 quick-login 테스트용 근로자 | TODO |
| 현장 데이터 | 최소 1개 운영 테스트 현장 | TODO |
| 모바일 기기 | iPhone Safari, Android Chrome | TODO |
| 카메라 권한 | QR/사진/AI 위험 감지 테스트용 | TODO |
| 마이크 권한 | STT/실시간 통역 테스트용 | TODO |
| AI vendor key | 번역/STT/TTS 실제 호출 테스트용 | TODO |

## 테스트 계정 매트릭스

| 역할 | 필요한 이유 | 테스트 계정 | 상태 |
|---|---|---|---|
| ROOT | 시스템 모드, 관리자 승인, 전체 현장 접근 | TODO | TODO |
| HQ_ADMIN | 본사 관리자 권한 검증 | TODO | TODO |
| SITE_ADMIN | 현장 관리자 메뉴 검증 | TODO | TODO |
| SAFETY_MANAGER | 안전관리자 메뉴 검증 | TODO | TODO |
| WORKER | 근로자 모바일 웹 검증 | TODO | TODO |
| PENDING | 승인 대기 접근 차단 검증 | TODO | TODO |

## P0. 배포/접속 기본 검증

| ID | 메뉴/기능 | 절차 | 기대 결과 | 상태 |
|---|---|---|---|---|
| P0-001 | HTTPS 접속 | `https://app.safe-link.co.kr/auth` 접속 | 로그인/언어 선택 화면 표시 | TODO |
| P0-002 | HTTP 리다이렉트 | `http://app.safe-link.co.kr/auth` 접속 | HTTPS로 자동 이동 | TODO |
| P0-003 | 대표 도메인 이동 | `https://safe-link.co.kr/auth` 접속 | `https://app.safe-link.co.kr/auth`로 이동 | TODO |
| P0-004 | API readiness | `https://api.safe-link.co.kr/actuator/health/readiness` 접속 | `{"status":"UP"}` | TODO |
| P0-005 | API CORS | 앱에서 로그인/내 정보 API 호출 | CORS 오류 없음 | TODO |
| P0-006 | 세션 쿠키 | 로그인 후 개발자도구 Application/Cookies 확인 | `SAFE_LINK_SESSION`이 HttpOnly, Secure, SameSite 적용 | TODO |
| P0-007 | CSRF 쿠키 | `/api/v1/auth/csrf` 응답 확인 | `XSRF-TOKEN` Secure, SameSite=Lax | TODO |
| P0-008 | 서버 서비스 | EC2에서 systemd 서비스 확인 | backend/frontend/nginx/docker active | TODO |
| P0-009 | DB/Redis 상태 | EC2에서 Docker health 확인 | PostgreSQL/Redis healthy | TODO |

## P0. 인증/계정/권한 QA

| ID | 메뉴/기능 | 절차 | 기대 결과 | 상태 |
|---|---|---|---|---|
| P0-101 | 관리자 로그인 | `/auth`에서 관리자 선택 후 로그인 | 권한에 맞는 관리자 대시보드 진입 | TODO |
| P0-102 | 근로자 로그인 | `/auth`에서 근로자 선택 후 quick-login | 근로자 대시보드 진입 | TODO |
| P0-103 | 로그아웃 | 관리자/근로자 각각 로그아웃 | 세션 제거 후 `/auth`로 이동 | TODO |
| P0-104 | 잘못된 비밀번호 | 틀린 비밀번호 입력 | 내부 에러 노출 없이 사용자용 오류 표시 | TODO |
| P0-105 | 승인 대기 계정 | PENDING 계정 로그인 시도 | 로그인 차단, 승인 대기 안내 | TODO |
| P0-106 | 관리자 직접 가입 | 관리자 가입 신청 | 즉시 관리자 권한 부여 안 됨, PENDING 생성 | TODO |
| P0-107 | 셀프 승격 차단 | 가입/프로필 설정에서 role/site 조작 시도 | 서버에서 거부 | TODO |
| P0-108 | 권한별 접근 제한 | WORKER로 `/admin`, 관리자 메뉴 직접 URL 접근 | 접근 차단 또는 안전한 리다이렉트 | TODO |
| P0-109 | 현장 격리 | 다른 현장 데이터 URL/API 접근 시도 | 조회/수정 차단 | TODO |

## P0. 관리자 대시보드 QA

관리자 시작 화면: `https://app.safe-link.co.kr/admin`

| ID | 메뉴/기능 | 절차 | 기대 결과 | 상태 |
|---|---|---|---|---|
| P0-201 | 관리자 대시보드 | 로그인 후 `/admin` 접속 | 사용자명, 역할, 현장 정보 표시 | TODO |
| P0-202 | 시스템 상태 위젯 | 관리자 화면의 시스템 상태 확인 | API/핵심 서비스 상태가 표시됨 | TODO |
| P0-203 | 프로필 수정 | `Profile Edit` 이동 | `/auth/setup` 화면 진입, 허용 필드만 수정 | TODO |
| P0-204 | 메뉴 이동 | TBM, 채팅, 서명 현황, 용어사전 카드 클릭 | 각 메뉴로 정상 이동 | TODO |
| P0-205 | 권한 없는 메뉴 | SITE_ADMIN/SAFETY_MANAGER별 제한 메뉴 접근 | 권한 없는 기능 차단 | TODO |

## P0. TBM 생성/전파/서명 QA

관리자 메뉴:

- `/admin/tbm/create`
- `/admin/tbm/status`
- `/admin/tbm/live`
- `/admin/tbm/live/[sessionId]`

근로자 메뉴:

- `/worker`
- `/worker/tbm/[id]`
- `/worker/pledge`

| ID | 메뉴/기능 | 절차 | 기대 결과 | 상태 |
|---|---|---|---|---|
| P0-301 | TBM 작성 | 관리자에서 제목/내용 입력 후 생성 | TBM 생성 성공 | TODO |
| P0-302 | 안전교육 라이브러리 | TBM 작성 중 라이브러리 항목 삽입 | 내용에 안전 항목 반영 | TODO |
| P0-303 | 다국어 전파 | 외국어 근로자가 있는 현장에 TBM 전송 | 근로자 언어 기준으로 표시 또는 번역 처리 | TODO |
| P0-304 | 근로자 TBM 수신 | 근로자 계정으로 `/worker` 접속 | 새 TBM 안내 표시 | TODO |
| P0-305 | TBM 상세 확인 | 근로자 `확인 및 서명하기` 클릭 | TBM 상세 화면 표시 | TODO |
| P0-306 | 서명 제출 | 모바일에서 손가락 서명 후 제출 | 서명 저장 성공 | TODO |
| P0-307 | 중복 서명 | 같은 TBM에 다시 서명 시도 | 중복 처리 방지 또는 이미 완료 표시 | TODO |
| P0-308 | 서명 현황 | 관리자 `/admin/tbm/status` 확인 | 근로자별 확인/서명 상태 반영 | TODO |
| P0-309 | 권한 없는 서명 조회 | 다른 현장 관리자 또는 근로자로 접근 | 파일/서명 접근 차단 | TODO |

## P0. QR/NFC 근로자 입장 QA

관리자 메뉴:

- `/admin/qrcode`
- `/admin/team-qr`
- `/admin/nfc`
- `/admin/nfc/daily-logs`
- `/admin/workers`
- `/admin/workers/enroll`

근로자/공개 진입:

- `/qr/site`
- `/qr/[token]`
- `/n/[workerId]`
- `/nfc/w/[workerId]`
- `/w/[token]`

| ID | 메뉴/기능 | 절차 | 기대 결과 | 상태 |
|---|---|---|---|---|
| P0-401 | 현장 QR 생성 | 관리자 QR 메뉴에서 현장 QR 생성 | QR 이미지/URL 생성 | TODO |
| P0-402 | 모바일 QR 스캔 | 휴대폰으로 QR 스캔 | `/qr/site` 입장 화면 표시 | TODO |
| P0-403 | 근로자 정보 입력 | 이니셜/전화번호 뒷자리 등 입력 | 등록 근로자 매칭 | TODO |
| P0-404 | 입장 기록 | 근로자 입장 처리 | 당일 입장 상태 저장 | TODO |
| P0-405 | 퇴장 기록 | 같은 근로자로 재스캔 | 퇴장 또는 상태 변경 기록 | TODO |
| P0-406 | 미등록 근로자 | 없는 정보 입력 | 내부 오류 없이 안내 표시 | TODO |
| P0-407 | NFC 근로자 등록 | `/admin/workers/enroll`에서 근로자 등록 | WORKER 계정/quick-login 생성 | TODO |
| P0-408 | NFC 스티커 발급 | `/admin/nfc`에서 스티커 발급 | 스티커 ID/토큰 생성 | TODO |
| P0-409 | NFC 탭 | 모바일 NFC 또는 QR 대체로 탭 처리 | 출석/접근 로그 저장 | TODO |
| P0-410 | 일일 로그 | `/admin/nfc/daily-logs` 확인 | 입퇴장/탭 기록 표시 | TODO |

## P1. 채팅/실시간 통신 QA

관리자 메뉴:

- `/admin/chat`

근로자 메뉴:

- `/worker/chat`

| ID | 메뉴/기능 | 절차 | 기대 결과 | 상태 |
|---|---|---|---|---|
| P1-501 | 관리자 채팅 목록 | 관리자 채팅 메뉴 접속 | 소속 현장 근로자 목록 표시 | TODO |
| P1-502 | 근로자 관리자 목록 | 근로자 채팅 메뉴 접속 | 대화 가능한 관리자 표시 | TODO |
| P1-503 | 메시지 전송 | 관리자 -> 근로자 메시지 전송 | 상대 화면에 표시 | TODO |
| P1-504 | 근로자 답장 | 근로자 -> 관리자 메시지 전송 | 상대 화면에 표시 | TODO |
| P1-505 | 읽음 처리 | 메시지 확인 후 새로고침 | 읽음/미읽음 상태 반영 | TODO |
| P1-506 | 자동 번역 | 서로 다른 언어 사용자 간 메시지 전송 | 번역문/원문 표시 정책 정상 | TODO |
| P1-507 | SSE 안정성 | 채팅 화면 5분 유지 | 끊김 시 자동 복구 또는 오류 안내 | TODO |
| P1-508 | 현장 격리 | 다른 현장 근로자와 대화 시도 | 목록/메시지 접근 차단 | TODO |

## P1. 실시간 통역/STT/TTS/AI QA

관리자 메뉴:

- `/admin/live`
- `/lab`
- `/lab/on-device-speech`
- `/worker/live`
- `/worker/vision`

| ID | 메뉴/기능 | 절차 | 기대 결과 | 상태 |
|---|---|---|---|---|
| P1-601 | 마이크 권한 | 관리자 live 화면에서 마이크 허용 | 권한 요청/허용 후 녹음 가능 | TODO |
| P1-602 | STT | 한국어 음성 입력 | 텍스트 변환 결과 표시 | TODO |
| P1-603 | 번역 | 한국어 -> 근로자 언어 번역 | 의미가 유지된 번역 표시 | TODO |
| P1-604 | TTS | 번역 결과 음성 재생 | 근로자 기기에서 재생 | TODO |
| P1-605 | 비용 제한 | 짧은 시간 반복 호출 | rate limit/quota 동작 | TODO |
| P1-606 | vendor 장애 | AI key 제거 또는 장애 상황 모사 | 앱 전체 장애 없이 안내/차단 | TODO |
| P1-607 | AI 위험 감지 | 근로자 `AI 위험 감지`에서 사진 촬영 | 분석 결과 또는 미구성 안내 표시 | TODO |
| P1-608 | 권한/현장 검증 | 다른 현장 live channel 접근 시도 | 접근 차단 | TODO |

주의:

- 현재 운영 서버에서 `SAFE_LINK_AI_VENDOR_ENABLED=false`이면 실제 vendor 호출 테스트는 BLOCKED로 기록한다.
- AI vendor key, 요금제, quota가 확정되기 전에는 실시간 통역 상용 QA를 PASS 처리하지 않는다.

## P1. 퀴즈/인센티브/작업중지 QA

관리자 메뉴:

- `/admin/quiz`
- `/admin/incentive`

근로자 메뉴:

- `/worker/quiz`
- `/worker`

| ID | 메뉴/기능 | 절차 | 기대 결과 | 상태 |
|---|---|---|---|---|
| P1-701 | 퀴즈 생성 | 관리자에서 TBM 선택 후 퀴즈 생성 | 3문제 생성 | TODO |
| P1-702 | 퀴즈 발송 | 근로자 전원 발송 | 근로자 화면에서 퀴즈 표시 | TODO |
| P1-703 | 근로자 응답 | 모바일에서 답 선택/제출 | 응답 저장 | TODO |
| P1-704 | 결과 집계 | 관리자 퀴즈 화면 확인 | 정답률/응답자 표시 | TODO |
| P1-705 | 인센티브 지급 | 우수자에게 안전장비 지급 기록 | 지급 기록 저장 | TODO |
| P1-706 | 작업중지 요청 | 근로자 대시보드 작업중지 클릭 | 관리자/감사 로그에 기록 | TODO |
| P1-707 | 작업중지 rate limit | 반복 요청 | 과도한 요청 차단 | TODO |

## P1. 용어사전/ESG/리포트 검증 QA

관리자 메뉴:

- `/admin/glossary`
- `/admin/esg`
- `/verify/[reportId]`

| ID | 메뉴/기능 | 절차 | 기대 결과 | 상태 |
|---|---|---|---|---|
| P1-801 | 용어 등록 | 현장 은어/표준어 추가 | 목록에 반영 | TODO |
| P1-802 | 용어 수정/삭제 | 등록 용어 수정/삭제 | 변경 반영 | TODO |
| P1-803 | 번역 반영 | 용어 포함 문장 번역 | 표준어/현장 용어 정책 반영 | TODO |
| P1-804 | ESG 리포트 | `/admin/esg` 접속 | TBM/서약/감사 기반 점수 표시 | TODO |
| P1-805 | 검증 QR | 리포트 검증 URL 접속 | hash/검증 상태 표시 | TODO |
| P1-806 | 위변조 검증 | 잘못된 report id 접속 | 안전한 오류 표시 | TODO |

## P1. 시스템/운영자 화면 QA

운영 메뉴:

- `/system`
- `/root`
- `/control`

| ID | 메뉴/기능 | 절차 | 기대 결과 | 상태 |
|---|---|---|---|---|
| P1-901 | 시스템 화면 접근 | ROOT/HQ_ADMIN으로 `/system` 접속 | 시스템 요약 표시 | TODO |
| P1-902 | 권한 없는 접근 | WORKER/SITE_ADMIN으로 `/system` 접속 | 접근 차단 | TODO |
| P1-903 | 승인 대기 목록 | PENDING 관리자 계정 생성 후 확인 | 목록 표시 | TODO |
| P1-904 | 관리자 승인 | role/site 지정 후 승인 | 계정 ACTIVE, audit log 기록 | TODO |
| P1-905 | 현장 생성 | 시스템 화면에서 현장 생성 | 새 현장 표시 | TODO |
| P1-906 | 현장 수정 | 현장명/상태 수정 | 변경 반영 | TODO |
| P1-907 | 현장 삭제 | 삭제 요청 | 실제 삭제 대신 ARCHIVED 처리 | TODO |
| P1-908 | 보안 로그 | 로그인 실패/승인/권한 거부 후 확인 | 로그 표시, secret 미노출 | TODO |

## P0. 모바일 화면 QA

대상:

- iPhone Safari
- Android Chrome
- 모바일 앱 WebView/Capacitor 준비 환경

| ID | 메뉴/기능 | 절차 | 기대 결과 | 상태 |
|---|---|---|---|---|
| P0-1001 | 로그인 화면 | 작은 화면에서 `/auth` 접속 | 버튼/문구 겹침 없음 | TODO |
| P0-1002 | 관리자 화면 | 모바일에서 `/admin` 접속 | 카드/버튼 터치 가능 | TODO |
| P0-1003 | 근로자 화면 | 모바일에서 `/worker` 접속 | 주요 CTA가 한눈에 보임 | TODO |
| P0-1004 | TBM 서명 | 모바일 세로 화면에서 서명 | 서명 영역 정상 | TODO |
| P0-1005 | QR 입장 | 카메라/QR로 입장 | 모바일 브라우저에서 흐름 완료 | TODO |
| P0-1006 | 채팅 입력 | 모바일 키보드 열기/전송 | 입력창이 가려지지 않음 | TODO |
| P0-1007 | 다국어 UI | 한국어/영어/중국어/베트남어 등 전환 | 주요 문구 깨짐 없음 | TODO |
| P0-1008 | 새로고침/뒤로가기 | 진행 중 화면에서 뒤로가기/새로고침 | 세션/상태가 깨지지 않음 | TODO |

## P0. 보안/네트워크 QA

| ID | 메뉴/기능 | 절차 | 기대 결과 | 상태 |
|---|---|---|---|---|
| P0-1101 | DB 포트 외부 차단 | 외부에서 15432 접근 시도 | 접근 불가 | TODO |
| P0-1102 | Redis 포트 외부 차단 | 외부에서 16379 접근 시도 | 접근 불가 | TODO |
| P0-1103 | API 직접 포트 차단 | 외부에서 8080 접근 시도 | 접근 불가 | TODO |
| P0-1104 | nginx만 공개 | 외부 80/443 접속 | 정상 | TODO |
| P0-1105 | secret 노출 | HTML/JS/env/log에서 key 검색 | secret 미노출 | TODO |
| P0-1106 | CORS 차단 | 임의 origin에서 API 호출 | 차단 | TODO |
| P0-1107 | CSRF 차단 | token 없이 상태 변경 API 호출 | 차단 | TODO |
| P0-1108 | XSS 기본 방어 | 임의 script 문자열 입력 가능한 필드 테스트 | 실행되지 않음 | TODO |

## P0. 운영 로그/백업/복구 QA

| ID | 메뉴/기능 | 절차 | 기대 결과 | 상태 |
|---|---|---|---|---|
| P0-1201 | 서비스 재시작 | backend/frontend 재시작 | 자동 재기동, health `UP` | TODO |
| P0-1202 | 서버 재부팅 | EC2 재부팅 | Docker/systemd 자동 복구 | TODO |
| P0-1203 | Flyway 상태 | DB migration history 확인 | 최신 version 적용 | TODO |
| P0-1204 | 로그 확인 | `journalctl`/nginx log 확인 | 오류 원인 추적 가능, secret 미노출 | TODO |
| P0-1205 | DB 백업 | 백업 스크립트 또는 수동 dump 실행 | 백업 파일 생성 | TODO |
| P0-1206 | 복구 리허설 | 백업 파일로 별도 DB 복구 테스트 | 복구 가능 | TODO |
| P0-1207 | 인증서 갱신 | certbot timer 확인 | 자동갱신 예약 존재 | TODO |
| P0-1208 | 디스크 사용량 | `df -h` 확인 | 여유 공간 확보 | TODO |

## 실제 QA 실행 순서

1. 운영 접속 smoke test를 먼저 한다.
2. ROOT 계정을 준비하고 관리자 승인 흐름을 확인한다.
3. 테스트 현장 1개와 근로자 2명 이상을 준비한다.
4. 관리자 TBM 생성 -> 근로자 수신 -> 서명 -> 관리자 현황 반영까지 끝까지 수행한다.
5. QR/NFC 입장 흐름을 모바일에서 수행한다.
6. 채팅, 번역, 통역, 퀴즈, 인센티브를 순서대로 수행한다.
7. 권한 없는 계정으로 주요 URL/API 직접 접근을 시도한다.
8. 운영 로그, DB, Redis, 인증서, 백업 상태를 확인한다.
9. 실패 항목을 재현 절차와 함께 기록한다.
10. P0가 모두 PASS일 때만 외부 사용자 파일럿 테스트로 넘긴다.

## QA 결과 기록 양식

```text
QA 일시:
테스터:
환경: 회사 AWS 운영 / 회사 AWS 스테이징 / 개인 AWS 테스트
프론트 URL:
API URL:
빌드/배포 기준:
사용 계정:
사용 기기:

PASS:
FAIL:
BLOCKED:
N/A:

운영 오픈 가능 여부: 가능 / 불가 / 조건부 가능
조건부 가능 사유:
즉시 수정 필요:
운영 후 개선:
첨부 화면:
```

## 현재 배포 기준으로 바로 확인된 항목

2026-07-23 회사 AWS 배포 직후 확인:

| 항목 | 결과 |
|---|---|
| `https://app.safe-link.co.kr/auth` | 200 |
| `https://api.safe-link.co.kr/actuator/health/readiness` | 200, `UP` |
| `https://safe-link.co.kr/auth` | `https://app.safe-link.co.kr/auth`로 301 |
| HTTP -> HTTPS | 정상 |
| API CORS | `https://app.safe-link.co.kr` 허용 |
| CSRF cookie | `Secure; SameSite=Lax` |
| 인증서 | Let's Encrypt 발급 완료, 만료일 2026-10-21 |
| `sqcm.safe-link.co.kr` | 가비아 CNAME -> Cloudflare Tunnel, 시크릿 창 접속 확인 |

아직 실제 사용자 기능 QA는 진행 전이다. 위 표는 배포 smoke test 결과이며, 운영 오픈 판정은 본 문서의 P0/P1 기능 QA를 수행한 뒤 결정한다.
