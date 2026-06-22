# MOBILE_E2E_TEST_GUIDE — 실기기 수동 검증 가이드

> 대상 증분: M-010 · 작성 시점 기준 브랜치 `wip/ai-engine-upgrade-20260622`
> 목적: Done Bar **M1**(핵심 모바일 E2E 시나리오가 Android/iOS 실기기에서 통과) 검증을 위한 단계별 수동 절차 + 결과 기록 템플릿.
> 범위: 문서/절차만 정의. 운영 DB·배포 변경 없음. iOS 실행은 빌드 미확보 시 **BLOCKED(M-004)**.

---

## 0. 사전 준비 (공통)

| 항목 | 내용 |
|------|------|
| 앱 패키지 | `com.safelink.mobile.dev` (development) |
| Android 산출물 | debug APK (`apps/mobile/android` → `assembleDebug`), 약 4.19 MB |
| iOS 산출물 | **미확보** — macOS/Xcode 또는 CI 필요 (M-004 BLOCKED) |
| API base URL | 런타임 config에 운영/스테이징 API가 설정되어 있어야 함 (`CONFIG READY` 배지 확인) |
| 네트워크 | 실기기가 API 도메인에 도달 가능한 망 (HTTPS) |
| 계정 | 관리자 1, 근로자(현장 소속) 1 — 실데이터 노출 주의, 테스트 후 로그아웃 |
| HTTPS | Web NFC/카메라는 보안 컨텍스트(HTTPS) 필수. 로컬 http 미지원 |

### 빌드 산출물 만들기 (Android)
```bash
cd apps/mobile
npm run build          # Vite 번들 (.env의 VITE_* 공개 config 주입)
npm run cap:sync       # Capacitor 동기화
# JAVA_HOME=Android Studio JBR, ANDROID_HOME=C:\tmp\android-sdk
cd android && ./gradlew assembleDebug
# 산출 APK: apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```
APK를 실기기로 전송 후 설치(개발자 모드 / 출처 불명 앱 허용).

#### 현재 테스트 빌드 (MC-001 — 단일 앱 셸, 웹앱 전체 호스팅)
- 경로: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`
- 크기: 4,275,450 bytes
- SHA-256: `74ef9c49c0f68e1a9f1f72895ca90b7a8940543367f027c4a99c7e9e2a921172` (MC-006 오프라인 UX 포함)
- 동작: 앱 실행 시 `server.url`로 **배포 웹앱 전체**(`https://safe-link-v2.vercel.app`)를 first-party WebView로 로드. 관리자·근로자 모두 웹앱 로그인으로 전 기능 사용. 실행 시 마이크/카메라/알림 권한 요청. 네트워크 끊김 시 오프라인 안내 페이지(자동 재접속).
- 핵심 검증 대상(아래 T9~T13): 인증 지속, WebView 마이크, 라이브 통역, TBM 브로드캐스팅, 1:1 대화.
- 참고: 이전 로컬 SPA 패널(M-005~M-010)은 폴백/진단용으로 코드에 보존되나, 현재 앱 진입은 웹앱 전체 셸.

> ⚠️ **이 빌드의 핵심은 "WebView에서 웹앱 인증이 지속되고 마이크가 동작하는가"입니다(T9·T10). 이 둘이 안 되면 단일-앱-셸 접근 자체를 재검토해야 하므로, T9·T10을 가장 먼저 검증하세요.**

---

## 1. 시나리오 목록

| # | 시나리오 | 관련 증분 | 우선순위 |
|---|----------|-----------|----------|
| T1 | 런타임 진단 / config ready | M-003 | P0 |
| T2 | 관리자 로그인 → 세션 유지 | M-005, S-002 | P0 |
| T3 | 근로자 로그인 → 오늘 TBM 조회 | M-006 | P0 |
| T4 | TBM 터치 서명 → 제출 | M-008, S-004 | P0 |
| T5 | 번역 (모바일 Bearer) | S-005 | P1 |
| T6 | QR 스캔 | M-007 | P1 |
| T7 | NFC 스캔 | M-009 | P1 (Android Chrome 한정) |
| T8 | 오프라인/네트워크 전환 동작 | M-003 | P2 |

---

## 2. 시나리오 절차 + 기록란

> 기록 표기: ✅ Pass / ❌ Fail / ⏭ Skip(사유). Fail 시 화면/로그 캡처 첨부.

### T1 — 런타임 진단
- 사전조건: 앱 설치 완료, 네트워크 연결.
- 단계:
  1. 앱 실행.
  2. 상단 "런타임 상태" 카드 확인.
- 기대결과: Platform=ANDROID(또는 IOS), Native runtime=YES, Network=ONLINE, API base URL/Supabase URL/Publishable key=CONFIGURED, 배지 `CONFIG READY`.
- 기록: Android [ ] / iOS [ ] · 비고:

### T2 — 관리자 로그인
- 사전조건: 관리자 계정.
- 단계:
  1. 관리자 패널에서 이메일/비밀번호 입력 후 로그인.
  2. 앱 재시작 후에도 로그인 상태 유지 확인.
- 기대결과: 로그인 성공, 토큰 저장(@capacitor/preferences), 재시작 후 인증 유지, `getMe` 사용자 정보 표시.
- 기록: Android [ ] / iOS [ ] · 비고:

### T3 — 근로자 로그인 → 오늘 TBM
- 사전조건: 현장 소속 근로자 계정, 해당 현장에 오늘자 TBM 1건 이상.
- 단계:
  1. 근로자 로그인.
  2. WorkerTbmPanel에서 "오늘 TBM" 조회.
- 기대결과: 본인 현장(site)으로 스코프된 오늘 TBM 목록만 표시(RLS), 타 현장 TBM 미노출.
- 기록: Android [ ] / iOS [ ] · 비고:

### T4 — TBM 터치 서명 → 제출
- 사전조건: T3에서 조회된 미서명 TBM.
- 단계:
  1. TBM 선택 → 서명 캔버스에서 손가락으로 서명.
  2. 지우기/다시쓰기 동작 확인.
  3. 제출.
- 기대결과: 빈 서명 제출 차단, 서명 이미지(data URL) `signTbm` 전송 성공, 서버 검증(Bearer 서명검증) 후 서명 완료 상태 반영.
- 기록: Android [ ] / iOS [ ] · 비고:

### T5 — 번역
- 사전조건: 로그인 상태.
- 단계:
  1. 번역 입력에 한국어 문장 입력 → 대상 언어 선택 → 번역.
- 기대결과: 모바일 Bearer + `X-Safe-Link-Client: mobile` 헤더로 호출, 번역 결과 표시(여행 토큰 경로와 충돌 없음).
- 기록: Android [ ] / iOS [ ] · 비고:

### T6 — QR 스캔
- 사전조건: 카메라 권한, 테스트 QR(SAFE-LINK worker/site).
- 단계:
  1. QR 스캔 시작 → 카메라 권한 허용.
  2. QR 인식.
  3. 권한 거부/취소 케이스도 1회 확인.
- 기대결과: BarcodeDetector 인식, payload 파싱(worker/site/url), 권한 거부·취소·미지원 분기 메시지 정상.
- 기록: Android [ ] / iOS [ ] · 비고: (iOS WKWebView는 미지원 → 네이티브 후속)

### T7 — NFC 스캔
- 사전조건: **Android Chrome/WebView NFC 지원 단말**, NFC 활성화, 테스트 NFC 태그(SAFE-LINK URL payload).
- 단계:
  1. NFC 패널 배지 확인(SUPPORTED / ANDROID ONLY).
  2. 스캔 시작 → 권한 허용 → 태그 태깅.
  3. 권한 거부/취소 케이스 확인.
- 기대결과: NDEFReader 인식, serial + payload(worker/site/url) 파싱, 권한 거부·취소·미지원 분기 정상. iOS/미지원 단말은 버튼 비활성 + "Web NFC 미지원" 안내.
- 기록: Android [ ] / iOS [ ⏭ unsupported ] · 비고:

### T8 — 오프라인/네트워크 전환 (MC-006 오프라인 UX)
- 사전조건: 앱 실행 상태.
- 단계:
  1. 앱 실행 중 비행기 모드 ON → 앱을 종료 후 재실행(또는 화면 새로고침 유발).
  2. 빈 화면/브라우저 에러 대신 **로컬 오프라인 안내 페이지**("연결할 수 없습니다" + 다시 시도)가 뜨는지 확인.
  3. 비행기 모드 OFF → 안내 페이지가 **자동으로 운영 웹앱에 재접속**하는지 확인(또는 "다시 시도" 탭).
- 기대결과: 오프라인 시 복구 경로 있는 안내 화면 표시(크래시·빈 화면 없음), 네트워크 복구 시 자동/수동 재진입.
- 기록: Android [ ] / iOS [ ] · 비고:

---

## 2-B. 단일 앱 셸 핵심 시나리오 (MC 트랙 — 최우선)

> 앱이 `server.url`로 웹앱 전체를 로드하는 빌드(MC-001) 기준. **T9·T10이 게이팅 검증 — 먼저 수행.**

### T9 — (게이팅) WebView 인증 세션 지속
- 사전조건: MC-001 APK 설치, 네트워크.
- 단계:
  1. 앱 실행 → 웹앱 로그인 화면에서 **관리자** 계정 로그인.
  2. 앱 완전 종료(백그라운드 제거) 후 재실행.
  3. **근로자** 계정으로도 1·2 반복.
- 기대결과: 재실행 후에도 로그인 유지(Supabase 세션 쿠키/스토리지가 WebView에 first-party로 지속). 재로그인 불필요.
- ❗ Fail 시: WebView가 세션을 보존하지 못함 → 단일-앱-셸 접근 재검토 필요.
- 기록: 관리자 [ ] / 근로자 [ ] · 비고:

### T10 — (게이팅) WebView 마이크 getUserMedia
- 사전조건: T9 로그인 상태.
- 단계:
  1. 앱 실행 직후 권한 팝업(마이크/카메라/알림)에서 **허용**.
  2. 라이브 통역 페이지 진입 → 마이크 시작.
- 기대결과: 권한 grant 후 getUserMedia 성공, 음성 입력이 STT로 전달됨(권한 거부 없이 캡처 동작).
- ❗ Fail 시: WebView가 getUserMedia를 막음 → MainActivity/WebChromeClient onPermissionRequest override 또는 네이티브 플러그인 필요.
- 기록: Android [ ] · 비고:

### T11 — 관리자/근로자 한 앱 전 기능 접근
- 사전조건: T9 통과.
- 단계: 한 앱에서 관리자 로그아웃→근로자 로그인 전환, 양쪽 주요 메뉴(관제/관리자 통합/근로자 화면) 접근.
- 기대결과: 역할별 전 기능이 한 앱에서 접근 가능.
- 기록: [ ] · 비고:

### T12 — 라이브 통역 (실기기, STT→번역→TTS)
- 사전조건: T9·T10 통과, 관리자·근로자 2대(또는 2계정).
- 단계: 관리자 음성 발화 → 근로자 단말에 번역 표시/음성 재생, 반대 방향도 확인.
- 기대결과: 양방향 실시간 통역 동작(레이턴시 허용 범위), TTS 재생.
- 기록: [ ] · 비고:

### T13 — TBM 브로드캐스팅 · 1:1 대화 (실기기)
- 사전조건: T9·T10 통과.
- 단계: 관리자가 TBM 공지/세션 전송 → 근로자 단말 수신 확인. 1:1 대화로 음성 메시지 교환.
- 기대결과: TBM 실시간 수신, 1:1 대화 양방향 동작.
- 기록: TBM [ ] / 1:1 [ ] · 비고:
- 의존성: TBM 실시간 전달은 웹앱 쪽 realtime(RLS site_id 매칭) 경로에 의존 — 웹에서 먼저 수신 정상인지 확인 후 모바일 검증.

### T14 — 딥링크 (App Links, #1)
- 사전조건: 최신 APK 설치 + 웹 배포 반영(assetlinks.json). 설치 후 잠시(Android가 도메인 검증).
- 단계: 인쇄된 SAFE-LINK QR/NFC를 **폰 기본 카메라/NFC**로 스캔 → `safe-link-v2.vercel.app` URL 열림.
- 기대결과: 브라우저가 아니라 **설치된 앱**이 열림(자동) 또는 앱 선택지 제시.
- 검증(선택): `adb shell pm get-app-links com.safelink.mobile.dev` → host가 `verified`.
- 기록: Android [ ] · 비고: (릴리스 빌드는 릴리스 서명 지문 추가 필요)

### T15 — TBM 알림 (#A) / 오프라인 캐시 (#3)
- 알림(A): 관리자가 새 TBM 발송 → 근로자 폰에서 (앱 포그라운드/백그라운드) **로컬 알림** 표시. 1:1 메시지도 동일.
- 오프라인 캐시(C): TBM 상세를 한 번 본 뒤 비행기 모드 → TBM 상세 재진입 시 **"📴 오프라인 — 저장된 TBM" 배너 + 저장 내용** 표시. 복구 후 최신으로 갱신.
- 기대결과: 알림 수신 / 오프라인 시 빈 화면 아닌 저장본 표시(온라인-무TBM 시엔 캐시 표시 안 함).
- 기록: 알림 [ ] / 오프라인캐시 [ ] · 비고:

---

## 3. 결과 요약 템플릿

```
실기기 E2E 결과 — <날짜> / 테스터 <이름>
단말: Android <모델/OS> / iOS <모델/OS 또는 BLOCKED(M-004)>
앱 버전: com.safelink.mobile.dev / APK SHA-256 <...>

T1 [ ]  T2 [ ]  T3 [ ]  T4 [ ]  T5 [ ]  T6 [ ]  T7 [ ]  T8 [ ]
Pass: __/8   Fail: __   Skip: __
Blocker(있으면):
다음 액션:
```

---

## 4. 통과 기준 (Done Bar M1 연동)

- **M1 충족 조건**: Android에서 P0(T1~T4) 전부 Pass + P1(T5~T7) Pass 또는 명시적 Skip 사유.
- iOS는 M-004(빌드 환경) 해소 전까지 BLOCKED — iOS 컬럼은 미실행으로 기록하고 M1 부분 충족(Android-only)으로 표기.
- Fail 1건 이상 → 해당 증분 재오픈(READY로 환원) 후 수정·재검증.

---

## 5. 주의 (Safety)

- 실데이터(근로자 개인정보) 노출 주의 — 캡처 시 마스킹, 테스트 후 로그아웃.
- 이 가이드 실행은 운영 DB를 변경하지 않음(읽기/서명 제출은 정상 업무 흐름). 스키마·RLS 변경은 별도 게이트(S-003).
- 배포(wip→master)·스토어 제출은 별도 게이트로 본 가이드 범위 밖.
