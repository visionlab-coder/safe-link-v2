# Android 시스템 뒤로가기 수정 (2026-10-23)

## 목표와 확인한 원인

APK에서 시스템 뒤로가기 버튼을 누르면 앱이 종료되는 대신 이전 웹 화면으로 이동한다.
기존 실제 Activity(`kr.co.safelink.mobile.dev.MainActivity`)에는 WebView 이력과
시스템 Back을 연결하는 처리가 없었다. V2도 읽기 전용으로 비교했고 같은 처리가 없었다.
사용자가 보고한 서버 로그인 세션 삭제 자체는 재현/확정하지 않았다.

## 동작 명세

- AndroidX `OnBackPressedDispatcher`에서 WebView `canGoBack()` / `goBack()`으로 처리한다.
- 근로자/임시근로자/관리자/본사/시스템 첫 화면에서는 머문다. 로그인 페이지로 되돌아가거나 Activity를 종료하지 않는다.
- 이전 기록이 없는 직접 진입 화면에서는 그대로 머문다.
- 명시적 로그아웃, 인증 정책, 쿠키 설정, 서버 API와 DB는 변경하지 않는다.
- 앱의 별도 모달/편집 취소 흐름을 새로 정의하지 않고 기존 브라우저 이력 이동을 사용한다.

## 변경 파일

- `apps/mobile/android/app/src/main/java/kr/co/safelink/mobile/dev/MainActivity.java`
- 같은 경로 `BackNavigation.java`: 첫 화면 및 이전 이력 판단
- `apps/mobile/android/app/src/test/java/kr/co/safelink/mobile/dev/BackNavigationTest.java`
- `tests/android-back-navigation.mjs`: 임시 에뮬레이터의 실제 시스템 Back 검증
- `apps/mobile/android/app/build.gradle`: 기본 버전 코드 2, 버전명 1.0.1

## 검증 증빙

- 모바일 TypeScript/Vite 빌드 및 Capacitor Android 동기화 성공.
- Gradle `:app:testDebugUnitTest :app:assembleDebug` 성공.
- BackNavigation 단위 시험 4건 모두 통과(기본 예제 포함 전체 5건).
- Pixel 8 Android API 37.2 베타 에뮬레이터에서 설치된 APK의 시스템 키 이벤트 4로
  SPA 상세 → 목록 → 근로자 첫 화면 이동 확인. 첫 화면에서 반복 Back 후 앱 foreground/PID 유지.
- 모든 역할 첫 화면에서 로그인 화면으로 역이동하지 않는 것 확인.
- 네트워크를 fixture로 대체한 시험에서 테스트 sessionStorage와 쿠키 유지 확인.
  운영 계정 로그인/서버 세션 시험 또는 실제 휴대폰 시험을 했다는 의미는 아니다.
- 이전 공개 APK와 새 APK의 패키지명 및 서명 인증서가 같음을 확인. 버전 코드 1 → 2.
- 기존 내부 배포와 동일한 debug 서명 APK이며 Play Store release 서명 전환은 이번 범위가 아니다.
- 의존성 재설치 중 기존 npm audit 9건(중간 1/높음 6/심각 2)이 보고됨. 의존성 업데이트는 하지 않았다.

## 설치와 운영 반영 경계

새 APK를 기존 앱 위에 업데이트 설치해야 적용된다. 웹 서버 배포만으로는 네이티브 코드가 바뀌지 않는다.
2026-10-23에는 로컬 APK 생성까지 진행했으며, 2026-10-28 사용자 승인으로 기존 공개 다운로드 파일 교체를 진행한다.
검증된 APK: `outputs/android-back-navigation/sq-link-1.0.1.apk` → `public/downloads/sq-link.apk`.
실제 현장 휴대폰에서 채팅/TBM 화면 이동과 키보드 닫기를 추가 확인한다.

## 2026-10-28 공개 링크 배포

- 기존 주소 `https://app.safe-link.co.kr/downloads/sq-link.apk`와 `/download` 페이지의 버튼을 유지한다.
- 패키지 `kr.co.safelink.mobile.dev`, 버전 `1.0.1` / versionCode `2`.
- 기존·신규 APK의 서명 인증서 SHA256 동일: `939a24ff1a47e14dc665a93cedb10578da364c2d890a100451787e88f2545a19`.
- 신규 파일 SHA256: `4a4eec75d0d4d9c24fe0beabac296e76616c3b4eedb1746d88e9b3880d742b34` (4,235,172 bytes).
- 이전 파일 SHA256: `b1fe20a401f81fd508dd54c132039cd4e7657e647b5dc553c3be8fbe1a662ac6`.
- 운영 이전 파일 백업: `/home/ubuntu/safelink-v3/backups/apk-before-1.0.1-20261028/sq-link.apk` (비공개). 기존 릴리스도 정상 배포 보존 정책에 따른다.
- 배포 전 `apksigner verify`, 앱 ID/버전/HTTPS 운영 주소 확인, Gradle `:app:testDebugUnitTest` 성공. 이전 에뮬레이터 검증과 동일한 바이너리다. 이번 배포에서 실물 휴대폰 시험은 하지 않았다.
- 일반 웹 배포 절차로 공개 파일을 포함하므로 이후 웹 배포 시 구버전 APK로 되돌아가지 않는다. 다운로드 파일을 다시 받아 SHA256·버전·서명을 대조한 뒤 완료 판단한다.
- 기존 앱을 삭제하지 않고 다운로드한 APK를 열어 **업데이트** 설치한다. 스토어 자동 업데이트는 아니다.

## 재검증

앱 실행 중인 폐기 가능한 에뮬레이터에서 `node tests/android-back-navigation.mjs` 실행.
기본 serial은 `emulator-5580`이며 물리 기기는 거절한다. 실제 계정이나 인증 API는 사용하지 않는다.
AndroidX 및 WebView 이력 방식을 유지하고 V2는 수정하지 않는다.
