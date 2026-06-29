# SAFE-LINK V2 — 벤더(범소프트웨어) 이관 패키지

> 목적: 범소프트웨어가 **기존 자산을 최대한 재사용**하여 iOS/Android 네이티브 앱을 제작할 수 있도록, 백엔드·API·데이터·로직·디자인을 한 문서로 정리.
> 원칙: **Supabase 백엔드 + API + 비즈니스 로직은 그대로 재사용.** 네이티브로 새로 만드는 것은 **클라이언트 UI 층**뿐.
> ⚠️ 이 문서는 코드 기반 인벤토리입니다. **최종 진실은 소스코드**(`src/`)이며, 계약/스키마는 구현과 대조해 확정하세요.
> ⚠️ 시크릿 값은 본 문서에 없습니다(변수명만). 키는 별도 보안 채널로 전달.

작성: 2026-06-23 · 대상: 범소프트웨어 모바일 개발팀 · 레퍼런스: 살아있는 웹앱(`safe-link-v2.vercel.app`) + 본 repo

실행 계획: [`SAFE_LINK_2_3_DAY_HANDOFF_TODO.md`](./SAFE_LINK_2_3_DAY_HANDOFF_TODO.md)

미추적 파일 분류: [`SOURCE_HANDOFF_CLASSIFICATION.md`](./SOURCE_HANDOFF_CLASSIFICATION.md)

---

## 0. 시스템 개요

```
[네이티브 앱 (신규, 범소프트웨어)]  ← UI만 새로
        │ HTTPS (REST) + Supabase Realtime(WSS)
        ▼
[백엔드 (재사용)]
  ├─ Next.js API Routes (STT/TTS/번역/TBM/인증/NFC 등 67개)  ← 그대로
  └─ Supabase (PostgreSQL + Auth + Realtime + RLS)            ← 그대로
        │
[외부 AI 서비스]  Google Cloud(STT/TTS/Gemini) · OpenAI(Whisper/TTS) · Naver Papago · (선택)Flitto RTT
```

- **재사용 (새로 안 만듦)**: Supabase DB/스키마/RLS, 모든 API 라우트, 번역·STT·TTS 파이프라인 로직, 건설 용어/발음/존댓말 로직, 역할/권한 모델, 디자인 시스템.
- **신규 (네이티브)**: 화면 UI, 오디오 캡처/재생, 카메라/NFC 네이티브, 세션 저장, 푸시.

---

## 1. API 인벤토리 (네이티브가 호출)

> 전체 67개. 소스: `src/app/api/**/route.ts`. 아래는 핵심 + 그룹 요약. **정확한 요청/응답은 각 route.ts 확인.**

### 1-A. 핵심 API Top (네이티브 필수)

| 순위 | API | 메서드 | 인증 | 용도 |
|---|---|---|---|---|
| 1 | `/api/auth/worker-quick-login` | POST | 공개(IP limit) | 근로자 이니셜+뒷4자리 빠른 로그인 (모바일: session 토큰 응답) |
| 2 | `/api/auth/admin-login` | POST | 공개 | 관리자 이메일/비번 (모바일: session 토큰 응답) |
| 3 | `/api/auth/me` | GET | Bearer/Cookie | 현재 사용자+프로필, 세션 자동 갱신 |
| 4 | `/api/translate` | POST | Bearer/travel/Cookie | 다국어 번역(+발음/역번역) |
| 5 | `/api/stt` | POST | Cookie/Bearer | 음성→텍스트 (Whisper/Google + Gemini 보정) |
| 6 | `/api/tts` | GET | Cookie/Bearer | 텍스트→음성 MP3 |
| 7 | `/api/tbm/today` | GET | Bearer/Cookie | 오늘 TBM 조회(현장 스코프) |
| 8 | `/api/tbm/sign` | POST | Bearer/Cookie | TBM 서명 제출 |
| 9 | `/api/nfc/tbm-session/[id]/tap` | POST | admin/서명 | NFC 탭 참석 기록 |
| 10 | `/api/nfc/worker-preference` | POST | 공개(서명+GPS) | NFC 입퇴장(지오펜스) |
| 11 | `/api/qr/site-entry` | POST | 공개(IP limit) | QR 입장(백업 경로) |

### 1-B. 그룹 요약

- **인증**: admin-login, admin-signup, worker-login, worker-quick-login, me, setup-profile, check-role
- **음성·언어**: stt, tts, translate, romanize
- **TBM**: nfc/tbm-session(+[id], /tap, /notify), tbm/today, tbm/sign, tbm/ack
- **NFC·QR**: nfc/worker-preference, nfc/workers(+[id], /qr-token), nfc/worker-info, nfc/sticker(/issue,/event), nfc/site-challenge, nfc/site-access-control, nfc/daily-safety-logs, qr/verify, qr/site-entry
- **퀴즈·인센티브**: quiz(+/respond,/daily,/generate,/send,/incentive), incentive/grant, safety-equipment
- **기타**: vision, sites/resolve, sites/current-location, travel/*, esg/report, pledge(+/sign), verify/[reportId], lab/engine-config(ROOT), admin/testbed-health

### 1-C. 모바일 CORS·세션 계약 (재사용 핵심)

- 모바일 식별 헤더: **`X-Safe-Link-Client: mobile`** → 이 헤더가 있으면 로그인 API가 쿠키 대신 **session 토큰(JSON)** 도 반환.
- 허용 origin: `https://localhost`, `capacitor://localhost`, `ionic://localhost`, +`MOBILE_ALLOWED_ORIGINS`.
- 네이티브는 토큰 저장 후 모든 요청에 `Authorization: Bearer <access_token>`.
- 구현 참고: `src/utils/auth/mobile-cors.ts`, `src/utils/auth/verify-access-token.ts`, `src/utils/auth/access-token-core.ts`.

---

## 2. Supabase 데이터 계층 (그대로 재사용)

> 소스: 코드의 `.from()`/`.channel()` + `supabase/migrations/`. **운영 DB 스키마와 대조 필수.**

### 2-A. 주요 테이블

| 테이블 | 용도 | Realtime |
|---|---|---|
| profiles | 사용자(관리자/근로자) 프로필, role, site_id, preferred_lang | - |
| sites | 현장(멀티테넌시), 위치/geofence | - |
| nfc_workers | 근로자 마스터(PII: 전화 등) — 관리자 전용 RLS | - |
| nfc_worker_stickers | NFC 스티커 발급/폐기 이력 | - |
| nfc_tbm_sessions / nfc_tbm_attendance | TBM 세션 / 참석 기록 | - |
| nfc_worker_daily_access | 일일 출퇴근 | - |
| tbm_notices | TBM 공지 | **INSERT** |
| tbm_ack | TBM 서명/확인 | - |
| messages | 1:1 채팅(번역 포함) | **INSERT/UPDATE** |
| live_translations | 라이브 통역 방송 | **INSERT** |
| tbm_quiz_sessions / _responses | 퀴즈 | **INSERT/UPDATE** |
| construction_glossary / site_term_translations | 건설 용어 사전(다국어) | - |
| claim13_pledges / claim13_hash_chain_events | 안전서약/감사체인 | - |
| stop_work_alerts / claim17_* | 작업중지 | INSERT/UPDATE |
| tbm_notification_log | TBM 알림 이력 | - |
| qr_token_nonces | QR 일회용 nonce(서버 전용) | - |

### 2-B. Realtime 채널 (네이티브가 구독)

| 채널/대상 | 테이블·이벤트 | 용도 |
|---|---|---|
| `worker_tbm_realtime` | tbm_notices INSERT | 근로자 홈: 새 TBM 감지 |
| `tbm_detail_realtime` | tbm_notices INSERT | TBM 상세 갱신 |
| `live_translation_feed_{profileId}` | live_translations INSERT | 라이브 통역 수신 |
| `live_worker_responses_{adminId}` | messages INSERT | 근로자 응답 수신(관리자) |
| (1:1) | messages INSERT/UPDATE | 채팅 |
| `live_audience_global` | presence | 온라인/리스너 추적 |

### 2-C. 보안/RLS 핵심 (네이티브 주의)

- **역할**: ROOT/SUPER_ADMIN/HQ_ADMIN/HQ_OFFICER/SAFETY_OFFICER/SITE_ADMIN/TEAM_LEADER/ADMIN/WORKER (`src/lib/roles.ts`).
- **멀티테넌시**: 대부분 테이블 `site_id` 스코프. 사용자는 `profiles.site_id` 1개. 쿼리에 site 필터 + RLS 적용.
- **PII**: `nfc_workers`(전화 등)는 관리자 전용(`is_safelink_admin()`). 근로자 앱 직접 조회 금지 → 본인 정보는 API 경유.
- **anon key**: 공개키(클라이언트 노출 정상). 단 민감 작업은 서버(API, service-role)에서만.
- **Realtime 인증**: 로그인 JWT로 구독해야 RLS 통과.
- **Supabase 클라이언트**: `src/utils/supabase/{client,server,service}.ts`. service-role 키는 **서버 전용**.
- **세션**: 쿠키 `sb-<projectRef>-auth-token`(base64 JSON), JWT(HS256), 만료 시 refresh. 미들웨어 `src/middleware.ts`가 Workers 호환 위해 raw fetch + apikey 쿼리 전달(네이티브는 SDK/표준 흐름 사용 가능).

> **네이티브 권장 아키텍처**: 가능한 한 **기존 API 경유**(PII 필터/nonce/번역 등 서버 로직 재사용). Supabase 직접 접근은 Realtime 구독 + 단순 read 위주로.

---

## 3. 핵심 기능 플로우 (네이티브 재구현 명세)

> 상세 시퀀스는 아래 파일을 레퍼런스로. 수치(타임아웃/임계값)는 **현장 검증값 — 변경 금지**.

### 3-A. 인증
- 관리자: `src/app/auth/page.tsx` → `/api/auth/admin-login` → 세션 저장 → `/admin`.
- 근로자: 이니셜+뒷4자리 → `/api/auth/worker-quick-login`. 복수 현장 매칭 시 **409 + sites[]** → 현장 선택 후 재호출.
- QR/NFC 진입: 스티커 URL(서명 sig) 파싱 → tap/worker-preference.

### 3-B. TBM 브로드캐스팅 (난이도 하)
1. 관리자: 텍스트/음성 입력 → 은어 정규화 → `/api/tbm/today` 발송(tbm_notices INSERT).
2. 근로자: `worker_tbm_realtime` 구독 → 알림(소리/배지/**로컬 푸시**) → TBM 카드.
3. 상세: `worker/tbm/[id]` → 선호언어 번역(병렬) → 서명 캔버스 → `/api/tbm/sign`(tbm_ack).
- 파일: `admin/tbm/*`, `worker/page.tsx`, `worker/tbm/[id]/page.tsx`, `api/nfc/tbm-session/*`.

### 3-C. 라이브 통역 (난이도 상 ⭐ 최난) 
- 관리자(`admin/live`): 마이크 → VAD 청크 → `/api/stt` → 근로자 언어들 **병렬 사전번역** → Realtime 자막 브로드캐스트.
- 근로자(`worker/live`): 자막 수신 → **TTS 큐 재생** → 역방향 발화(STT→번역→messages).
- 핵심: `src/hooks/useCloudSTT.ts`(VAD/청크/mute), `useFlittoRTT.ts`(WSS 스트리밍), `src/utils/tts.ts`(playPremiumAudio).
- 네이티브 주의: 오디오 스트리밍(MediaRecorder 등가), VAD(RMS 0.015, 침묵 2s, 청크 10s/라이브 6s), TTS 큐 순차재생, 자기발화 mute, 자동재생 언락.

### 3-D. 1:1 대화 (난이도 중상)
- `worker/chat`/`admin/chat`: messages Realtime + 병렬 번역 + presence(온라인). 음성 입력→번역→messages INSERT.

### 3-E. 번역 파이프라인 (난이도 상)
- `/api/translate`: 엔진 우선순위 **m2m100(로컬,옵션) → Papago → Gemini → Google**. 
- 한국어→외국어: 건설 용어 정규화 선처리. 결과: 번역+발음(hangulize)+역번역, 한국어는 존댓말(formalizeKo).

---

## 4. 반드시 이식할 비즈니스 로직 (재사용 코어)

| 항목 | 파일 | 우선 | 비고 |
|---|---|---|---|
| 한국어 존댓말 변환 | `src/utils/politeness.ts` | HIGH | 규칙 기반(예: 간다→갑니다, 갑시다 보존) |
| 다국어→한글 발음 | `src/utils/hangulize.ts` (+nonlatin) | HIGH | 20개어, pinyin/가나/태국/데바나가리 등 ~800줄+매핑 |
| 건설 은어 사전 | `src/constants/glossary.ts` (~209) | HIGH | STT 후 정규화 |
| STT 컨텍스트/Gemini 보정 프롬프트 | `src/constants/construction-terms.ts`, `api/stt` | HIGH | 인식률 핵심 |
| STT/TTS 파라미터 | `src/constants/quality-config.ts` | HIGH | 타임아웃/신뢰도 — **현장 검증값, 변경 금지** |
| 지원 언어 메타(20개) | `src/constants/index.ts` | HIGH | 앱코드↔ISO↔지역, STT/TTS 가용성 |
| 역할/권한(RBAC) | `src/lib/roles.ts` | HIGH | 역할 계층 + 접근 함수 |
| TTS 음성 선택(언어×성별) | `api/tts`, `src/utils/tts.ts` | HIGH | Neural2 우선, 일부 언어 OpenAI |
| 디자인 시스템 | `src/app/globals.css`, `DESIGN.md` | MED | 다크+글래스모피즘, 대형 터치타깃, 20개어 폰트 스택 |

핵심 STT/TTS 수치(참고): Whisper timeout 8s, Google STT 5s, Gemini 보정 3s, STT 신뢰도 0.6(라이브 0.65), 0.92↑면 Gemini 생략.

---

## 5. 환경변수 인벤토리 (이름만 — 값은 보안 채널)

> 네이티브 클라이언트는 대부분 **백엔드 API 경유**라 서버 env가 핵심. 클라이언트엔 공개값(NEXT_PUBLIC_*)만.

- **AI 엔진(서버)**: `GOOGLE_CLOUD_API_KEY`, `OPENAI_API_KEY`, `GEMINI_TRANSLATE_MODEL`
- **번역(서버)**: `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `DEEPL_API_URL`, `FLITTO_RTT_TOKEN`, `FLITTO_RTT_URL`, `NEXT_PUBLIC_FLITTO_TARGET_LANGS`
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`(공개), `NEXT_PUBLIC_SUPABASE_ANON_KEY`(공개), `SUPABASE_SERVICE_ROLE_KEY`(서버), `SUPABASE_JWT_SECRET`/`_PREV`(서버)
- **NFC/보안(서버)**: `NFC_HMAC_SECRET`, `NFC_STICKER_SECRET`, `SAFE_LINK_AES_KEY`, `SAFE_LINK_HASH_SALT`
- **권한**: `MASTER_EMAILS`, `HQ_OFFICER_EMAILS`
- **실시간/캐시**: `PUSHER_*`/`NEXT_PUBLIC_PUSHER_*`, `UPSTASH_REDIS_REST_URL`/`_TOKEN`
- **모바일/모드**: `MOBILE_ALLOWED_ORIGINS`, `MOBILE_WEBAPP_URL`, `APP_MODE`, `NEXT_PUBLIC_REALTIME_STT_ENGINE`, `M2M100_TRANSLATE_URL`
- **외부**: `HI_INFO_*`(근로자 신원), `TRAVEL_API_SECRET`

현재 PoC의 공개 Supabase URL·anon key 기본값은
`src/config/public-runtime.ts` 한 곳에서 관리하며 Preview build에도 주입된다.
이는 비밀값이 아니지만 범소프트웨어의 staging/production 환경에서는 각 환경변수로
명시적으로 덮어써야 하며, service-role·JWT secret은 이 파일에 추가하면 안 된다.

---

## 6. 역할 분담 (소스 vs 계정자산)

**우리(서원토건)가 제공 — 재사용 대상**
- 이 repo(웹앱 전체 소스, 살아있는 레퍼런스), 본 핸드오프 문서, Supabase 백엔드/스키마/RLS, API, 비즈니스 로직, 디자인 시스템(`DESIGN.md`), 시크릿(보안 채널).

**범소프트웨어가 보유/처리 — 우리가 못 주는 것**
- Apple Developer / Google Play 개발자 계정, 서명 인증서·키, App Store Connect/Play Console 앱 레코드, 프로비저닝 프로파일, 스토어 스크린샷/법무/개인정보 URL, (선택)프로덕션 푸시 크리덴셜.

---

## 7. 우리(서원토건) 측 할 일 — 이관 기간

1. **현장 PoC 안정 유지**: 현재 웹앱 + Capacitor APK(사이드로드)로 현장 지속. 운영/DB 안정 우선.
2. **범소프트웨어 지원**: 본 문서/소스/스키마/시크릿 전달, 질의 응답, 합의된 API 변경만 반영.
3. **우리 쪽 네이티브/스토어 자체제작 중단**(범소가 제작). Codex iOS Capacitor 산출물은 **참고자료**로만 제공.

## 8. 범소프트웨어와 확정할 사항
1. 백엔드 유지 범위(권장: Supabase/API 그대로, 네이티브는 클라이언트만).
2. 웹앱 "고도화/리뉴얼" 시 우리 repo 인수 여부 + 우리 웹 작업(AI 엔진/버그픽스) 지속 여부.
3. PoC 운영 주체(이관 기간 중 서원토건 유지).
4. 납품 일정 + 우선 인도물 + 시크릿 전달 보안 채널.

---

## 부록: 레퍼런스 파일 맵

| 영역 | 파일 |
|---|---|
| 인증 | `src/app/auth/page.tsx`, `src/app/api/auth/*`, `src/utils/auth/*`, `src/middleware.ts` |
| TBM | `src/app/admin/tbm/*`, `src/app/worker/tbm/[id]/page.tsx`, `src/app/api/tbm/*`, `src/app/api/nfc/tbm-session/*` |
| 라이브 통역 | `src/app/admin/live/page.tsx`, `src/app/worker/live/page.tsx`, `src/hooks/useCloudSTT.ts`, `src/hooks/useFlittoRTT.ts`, `src/utils/tts.ts` |
| 1:1 채팅 | `src/app/worker/chat/page.tsx`, `src/app/admin/chat/page.tsx`, `src/hooks/usePresence.ts` |
| 번역/언어 | `src/app/api/translate/route.ts`, `src/utils/politeness.ts`, `src/utils/hangulize*.ts`, `src/constants/glossary.ts`, `src/constants/index.ts`, `src/constants/quality-config.ts` |
| STT/TTS | `src/app/api/stt/route.ts`, `src/app/api/tts/route.ts`, `src/constants/construction-terms.ts` |
| 데이터 | `src/utils/supabase/*`, `supabase/migrations/*` |
| 권한 | `src/lib/roles.ts` |
| 디자인 | `src/app/globals.css`, iOS `DESIGN.md` |
