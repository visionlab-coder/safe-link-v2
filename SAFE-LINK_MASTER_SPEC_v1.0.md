# SAFE-LINK Master Roadmap & Architecture Spec (v1.0)

> 목적: 건설현장에서 **외국인 근로자(최대 15개국)**와 관리자(소장/안전관리자)가  
> **딜레이 최소**로 소통하고, **TBM(일일 안전브리핑)**을 **확실히 전달/확인(전자서명)**하며,  
> 대화/지시/서명을 **법적 증빙(블랙박스)**으로 저장하는 “현장 커뮤니케이션 OS” 구축.

---

## 0. 핵심 원칙 (절대 규칙)

- **Zero-Legacy**: 기존 실패한 코드/구조는 참고만, 새 구조로 정리해서 진행.
- **UI 먼저, 기능은 뒤에**: 라우팅/화면/흐름 고정 → Auth/DB → 번역 → 음성 → 고도화.
- **증빙 우선**: TBM/대화/서명/시간/현장/참여자를 “기록”이 최우선.
- **현장 최적화**: 큰 글씨/가로모드/다크모드/노이즈 환경/간단 동선.
- **Fail-safe**: AI가 실패해도 최소 기능(텍스트/전송/확인)은 계속 동작.
- **보안 기본값**: 키/토큰은 절대 프론트 노출 금지, 서버(또는 Edge)에서만 사용.
- **존댓말(Honorifics) 필수**: 모든 번역 결과(특히 한국어)는 반드시 존댓말(Polite Form)로 생성. 반말 금지.

---

## 1. 최종 사용자 시나리오

### 1.1 근로자(Worker)
1) 회원가입/로그인 → **국가/언어 선택(필수)**  
2) 로그인 후 첫 화면은 **TBM 강제 화면**  
3) TBM 수신(텍스트+음성) → 확인 → **전자서명/핀/지문 플래그**  
4) 서명 완료 후에만 → 관리자와 **1:1 대화창 활성화**  
5) 화면 옵션: **가로/세로 전환**, **글자 300% 확대**, 다크/라이트 토글  
6) 현장 소음 대응: “누르고 말하기 / 누르면 녹음 시작/정지” 모드 선택

### 1.2 관리자(Admin: 소장/안전/현장관리)
1) 로그인 → **관제 대시보드**  
2) 오늘 TBM 작성/녹음 → 자동 표준화(현장 은어→표준어) → 15개 언어 번역 → 전파  
3) 근로자별 “확인/미확인/서명완료” 상태 실시간 확인  
4) 1:1 대화(음성/텍스트) → 근로자 언어에 맞춰 자동 번역+TTS  
5) 모든 기록은 시간/현장/상대/원문/번역문/오디오로 저장

### 1.3 본사 통합 관제(Head Office / HQ)
- 모든 현장(site) 데이터 통합 조회  
- 사고 발생 시 TBM/대화 로그를 즉시 조회/다운로드(증빙 자료)

---

## 2. 기술 스택 (권장 고정)

### Frontend (Web)
- **Next.js (App Router)**
- Styling: **Tailwind CSS** (필요 시 shadcn/ui 추가)
- Realtime UI: **Supabase Realtime** (우선) / WebSocket(대안)

### Hosting/Deploy
- **Cloudflare Pages** (Next.js 배포)
- (선택) Cloudflare Workers / Pages Functions로 Edge API

### Backend / DB / Auth / Storage
- **Supabase**
  - Auth: Google OAuth + (옵션) Email/OTP
  - DB: Postgres + RLS
  - Storage: audio / signature image 저장
  - Realtime: TBM/ack/채팅 상태 실시간 반영

### AI / Speech / Translation (MVP 우선순위)
- 1차(MVP): **텍스트 번역 + TTS**
- 2차: **STT(음성→텍스트)**
- 3차: **노이즈 환경 최적화(VAD/전처리)**
- 4차: **상대국 은어 localize_slang**

> 원칙: **텍스트→TTS 성공**이 먼저. STT는 현장 소음 때문에 단계적으로.

---

## 3. 시스템 아키텍처 (논리 구조)

### 3.1 TBM 데이터 흐름
1) Admin 입력(텍스트 or 음성)  
2) `normalize_ko` : 현장 은어 → 표준어 변환(사전 기반)  
3) `translate` : 표준어 → 다국어 번역(15개국 또는 “현장 활성 언어만”)  
4) Worker에게 전달(Realtime + Push 옵션)  
5) Worker 확인/서명(ack)  
6) Admin/HQ에서 상태 집계(미확인/확인/서명완료)

### 3.2 1:1 대화 흐름
1) Admin→Worker 메시지(텍스트/음성)  
2) Worker 언어로 번역 + TTS  
3) Worker→Admin 응답(텍스트/음성)  
4) Admin 언어(한국어)로 번역 + TTS  
5) 메시지/오디오/메타데이터 저장(블랙박스)

---

## 4. UI/UX 설계 (필수 스펙)

### 4.1 공통
- 다크/라이트 토글
- 가로/세로 전환 토글
- 글자 크기(기본/큰/초대형, 최소 300% 옵션)
- 네트워크 불안정: “재전송/재동기화” UI
- 접근성: 버튼 크게, 핵심 행동(확인/서명) 1~2탭 내 완료

### 4.2 근로자 화면(Worker)
- **TBM 강제 모드**(첫 화면)
- TBM 메시지 카드:
  - 번역문(기본), 핵심 안전 키워드 강조
  - (옵션) 한국어 발음 가이드(관리자용 독음) 표시
- 확인 버튼 + 전자서명 패드(또는 PIN)
- 서명 완료 후 “1:1 대화” 탭 활성화

### 4.3 관리자 화면(Admin)
- 오늘 TBM 작성/녹음/전송
- 근로자 리스트 + 언어/상태(미확인/확인/서명완료)
- 1:1 대화 대상 선택
- 기록/로그 탐색(날짜/현장/사용자 필터)

### 4.4 통합 관제(HQ)
- 현장별 TBM/미확인율/대화량/핵심 위험 키워드
- 사고 발생 시 “증빙 패키지” export

---

## 5. 라우팅(Next.js App Router)

권장 라우트(최소 실패 구조)

- `/` : 랜딩
- `/auth` : 역할 선택 + 로그인
- `/admin` : 관리자 홈(관제)
- `/worker` : 근로자 홈
- `/admin/tbm` : TBM 작성/전송
- `/worker/tbm` : TBM 확인/서명
- `/admin/chat` : 1:1 대화
- `/worker/chat` : 1:1 대화
- `/admin/glossary` : 용어 사전 관리/검수
- `/control` : 본사 통합 관제 (role=HQ)

---

## 6. DB 설계 (Supabase Postgres)

### 6.1 핵심 테이블

#### `profiles`
- `id uuid (PK, auth.users.id)`
- `role text` (admin|worker|hq)
- `name text`
- `language text` (ko, vi, th, en, zh, …)
- `country text` (VN, TH, …)
- `site_id uuid (FK sites.id, nullable)`
- `created_at timestamptz`

#### `sites`
- `id uuid (PK)`
- `name text`
- `address text`
- `created_at timestamptz`

#### `tbm_sessions`
- `id uuid`
- `site_id uuid`
- `admin_id uuid`
- `source_text text` (관리자 원문)
- `normalized_text text` (은어→표준어 결과)
- `audio_url text (optional)`
- `created_at timestamptz`

#### `tbm_translations`
- `id uuid`
- `tbm_session_id uuid`
- `lang text`
- `translated_text text`
- `tts_audio_url text (optional)`
- `created_at timestamptz`

#### `tbm_ack`
- `id uuid`
- `tbm_session_id uuid`
- `worker_id uuid`
- `ack_type text` (signature|pin|biometric_flag)
- `signature_url text (optional)`
- `ack_at timestamptz`

#### `messages`
- `id uuid`
- `site_id uuid`
- `from_user uuid`
- `to_user uuid`
- `source_lang text`
- `target_lang text`
- `source_text text`
- `translated_text text`
- `audio_url text (optional)`
- `created_at timestamptz`

### 6.2 RLS 정책(원칙)
- Worker: “본인 관련 TBM/메시지/ack”만 읽기
- Admin: “본인 site”의 데이터 읽기/쓰기
- HQ: 전체 읽기(감사/관리)

> MVP에서는 개발 속도를 위해 RLS를 느슨하게 시작하고, 안정화 후 강화.

---

## 7. Backend API 설계 (Next.js Route Handlers)

> Cloudflare Pages 배포를 감안해 Edge 친화 형태로 구성  
> (`app/api/**/route.ts`)

### 7.1 프로필
- `POST /api/profile/upsert`
  - role/language/country/site_id 저장

### 7.2 TBM
- `POST /api/tbm/create`
  - 입력: `site_id, source_text | audio_blob`
  - 처리: normalize → translate(활성 언어) → 저장 → realtime publish
- `POST /api/tbm/ack`
  - 입력: `tbm_session_id, ack_type, signature_blob(optional)`

### 7.3 Chat
- `POST /api/chat/send`
  - 입력: from/to/site_id + (text|audio)
  - 처리: translate → 저장 → realtime publish

### 7.4 Glossary
- `GET /api/glossary`
- `POST /api/glossary/import`
- `POST /api/glossary/apply` (normalize_ko)

---

## 8. AI/언어 파이프라인 (고정 모듈)

### 8.1 normalize_ko (현장 은어→표준어)
- 입력: 한국어 텍스트
- 사전: `master_glossary.json` (오빠가 가진 파일)
- **지침**: 변환된 문장은 반드시 존댓말(Polite Form)로 마감되어야 함.
- 출력: 표준 한국어 텍스트 + 변환 로그

### 8.2 translate (표준어→목표 언어)
- 입력: 표준 한국어 + target_lang
- **지침**: 한국어 결과는 반드시 존댓말(요/습니다)을 사용하며, 주어(나->저, 너->선생님/당신)를 고도화.
- 출력: 번역문
- 실패 시: 원문 표시 + “번역 재시도” 버튼

### 8.3 TTS
- 입력: 번역문 + voice 옵션(남/여, 속도)
- 출력: audio_url or audio blob

### 8.4 STT (2차)
- 입력: 음성
- 전처리: VAD(음성 구간) + 노이즈 억제(가능 시)
- 출력: 텍스트

---

## 9. 성능/지연 최적화 (현장용)

- TBM “15개 언어 동시 번역”은 무거움 → **현장 활성 언어만** 우선.
- 문장 캐시: 동일 문장 번역 재사용(비용/지연 감소)
- TTS: 문장 단위 분할 + 선생성(스트리밍 느낌)
- 네트워크 불안정: 로컬 큐 → 재전송 / Realtime 끊김 표시

---

## 10. 보안/증빙(블랙박스)

- 모든 기록은:
  - `site_id`, `user_id`, `timestamp`, `original`, `normalized`, `translated`, `audio_url`
- 변경 불가 원칙:
  - 수정이 필요하면 “정정 레코드”를 추가(append-only)
- Export(2차):
  - 날짜/현장/사용자 기준 zip/pdf로 증빙 패키지 생성

---

## 11. 배포(Cloudflare Pages) 체크포인트

### 11.1 로컬 개발
- WSL에서:
  - `npm run dev -- --port 3003`
- 라우팅 404 없는지:
  - `/auth`, `/admin`, `/worker` 필수 확인

### 11.2 배포
- GitHub 연결 → Cloudflare Pages 연결
- 환경변수:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - (서버 전용) AI 키들 (절대 `NEXT_PUBLIC` 금지)
- 빌드/런타임: Next.js on Pages 설정에 맞춰 고정

---

## 12. 로드맵 (실패 없는 단계별)

### Phase 1 (Day 1~2) — UI/라우팅 뼈대
- [ ] `/auth` 역할 선택 + 가드
- [ ] `/admin`, `/worker` UI
- [ ] TBM/Chat 화면 뼈대
- 산출물: “앱이 살아있고 흐름이 고정”

### Phase 2 (Day 3~5) — Supabase Auth + Profiles
- [ ] Supabase 프로젝트 생성
- [ ] Google OAuth 연결
- [ ] `profiles`, `sites` 생성
- [ ] 로그인 후 role에 따라 자동 이동
- 산출물: “진짜 사용자 계정/역할/언어 저장”

### Phase 3 (Week 2) — TBM 텍스트 전파 + 확인(전자서명)
- [ ] TBM 생성/전파 저장
- [ ] worker ack 저장 + 관리자 상태 반영
- 산출물: “TBM MVP 완성”

### Phase 4 (Week 3) — 번역 + TTS (딜레이 최소)
- [ ] normalize_ko 적용
- [ ] 번역(활성 언어만)
- [ ] TTS(번역문 읽어주기)
- 산출물: “텍스트/음성 번역”

### Phase 5 (Week 4+) — 1:1 대화 + STT
- [ ] 채팅 저장/번역/리얼타임
- [ ] STT(노이즈 대응 점진 적용)
- 산출물: “현장 1:1 실시간 통역”

### Phase 6 — 본사 통합 관제 + 증빙 Export
- [ ] 통합 대시보드
- [ ] 로그 패키지 export

---

## 13. Gemini 3.1 Pro 작업 지시(추천 프롬프트)

### 13.1 Day 1: 역할 라우팅 + 가드
```text
Next.js(App Router) 프로젝트에서 /auth /admin /worker를 완성해라.
- /auth: role(admin|worker) 선택 UI, localStorage 저장, 버튼 클릭 시 해당 라우트로 이동
- /admin, /worker: 클라이언트에서 role 검사 후 아니면 /auth로 redirect
- Tailwind로 스타일링, 파일 경로는 app/**/page.tsx 규칙 준수
- 404 없이 동작하도록 필요한 파일 생성/수정 코드를 "파일별"로 출력해라.
- 마지막에 테스트 체크리스트(URL) 제공해라.
```

### 13.2 Day 3: Supabase Auth + profile 저장
```text
Supabase Google OAuth를 붙여서 로그인 후 profiles에 role/language/country/site_id를 저장해라.
- env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 사용
- 로그인 성공 시 role에 따라 /admin 또는 /worker로 자동 이동
- profiles upsert 로직 포함
- 필요한 SQL(테이블 생성/컬럼)도 함께 제공해라.
```

---

## 14. 완료 정의(성공 기준)

- TBM:
  - 관리자 발신 → 근로자 수신(본인 언어) → 전자서명 → 관리자 확인  
  - 이 사이클이 “끊김 없이” 된다.
- 1:1:
  - 관리자↔근로자 대화가 “저장 + 번역 + (가능하면 음성)”으로 된다.
- 증빙:
  - 사고 시 “누가/언제/무슨 지시/확인”이 DB에서 바로 추적된다.
