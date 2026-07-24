# SQ Link V3 모바일 앱 출시 준비 문서

작성일: 2026-07-21

이 문서는 앱 개발자 계정이 아직 없어도 미리 준비할 수 있는 항목과, 계정이 생긴 뒤 해야 할 항목을 분리한다.

## 지금 확정된 값

```text
서비스 도메인: safe-link.co.kr
스테이징 웹앱 후보: https://app-test.safe-link.co.kr
스테이징 API 후보: https://api-test.safe-link.co.kr
현재 개인 AWS 테스트 IP: 43.200.49.69
```

## 앱이 도메인을 필요로 하는 이유

앱 자체는 App Store와 Google Play에 올라가지만, 이 프로젝트의 앱은 내부 화면을 Spring Boot API와 Next.js 웹앱에 연결해야 한다. 그래서 앱 출시 전에는 아래 두 주소가 HTTPS로 정상 동작해야 한다.

```text
앱이 여는 웹 주소: https://app.safe-link.co.kr 또는 https://app-test.safe-link.co.kr
앱이 호출하는 API 주소: https://api.safe-link.co.kr 또는 https://api-test.safe-link.co.kr
```

도메인/HTTPS가 없으면 모바일에서 Secure cookie, CORS, 카메라/마이크 권한, 스토어 심사 테스트가 제대로 검증되지 않는다.

## 계정 없이 지금 할 수 있는 준비

1. 테스트 도메인 DNS 연결
   - Cloudflare에서 `app-test.safe-link.co.kr` A 레코드를 EC2 IP `43.200.49.69`로 연결한다.
   - Cloudflare에서 `api-test.safe-link.co.kr` A 레코드를 EC2 IP `43.200.49.69`로 연결한다.
   - 처음에는 Proxy status를 `DNS only`로 둔다.

2. HTTPS 적용
   - EC2에 Nginx 또는 Caddy를 두고 Let’s Encrypt 인증서를 발급한다.
   - 프론트는 `https://app-test.safe-link.co.kr`로 열리게 한다.
   - API는 `https://api-test.safe-link.co.kr`로 열리게 한다.
   - 적용 후 `SAFE_LINK_COOKIE_SECURE=true`로 바꿔 세션 보안을 검증한다.

3. 모바일 런타임 설정
   - `apps/mobile/capacitor.config.ts`의 기본 웹앱 주소를 V3 테스트 도메인으로 맞춘다.
   - `apps/mobile/.env.example` 기준으로 `VITE_SAFE_LINK_API_BASE_URL=https://api-test.safe-link.co.kr`를 사용한다.
   - V2 Vercel 주소와 Supabase 필수 설정을 모바일 준비 기준에서 제거한다.

4. 앱 표시 자료 준비
   - 앱 이름 후보
   - 앱 아이콘 1024x1024 원본
   - 스플래시 이미지
   - iPhone/Android 스크린샷
   - 앱 설명 문구
   - 지원 이메일
   - 개인정보처리방침 URL
   - 계정 삭제 요청 URL

5. QA 계정 준비
   - 스토어 심사용 ROOT/HQ_ADMIN이 아닌 제한된 테스트 관리자 계정
   - 테스트 현장
   - 테스트 근로자
   - 테스트 QR/NFC/TBM 데이터
   - 심사자가 로그인해야 한다면 심사용 안내 계정과 절차

## 개발자 계정이 생긴 뒤 해야 할 일

1. Apple Developer Program 등록 확인
   - 회사/조직 계정으로 등록한다.
   - 법인명, D-U-N-S 번호, 회사 도메인 이메일, 회사 웹사이트가 필요하다.

2. Google Play Console 조직 계정 등록 확인
   - 회사/조직 계정으로 등록한다.
   - D-U-N-S 번호, 조직명/주소, 전화번호, 웹사이트, 연락처 이메일이 필요하다.

3. 앱 ID 확정
   - iOS Bundle ID와 Android Application ID를 최종 확정한다.
   - 예시 후보: `kr.co.safelink.mobile`
   - 최종 업로드 후에는 바꾸기 어렵기 때문에 회사명/브랜드명 기준으로 확정한다.

4. 네이티브 프로젝트 생성
   - iOS: Xcode 프로젝트 생성, signing team 연결, TestFlight 빌드 생성
   - Android: release signing key 생성, AAB 빌드 생성

5. 내부 테스트 배포
   - iOS: TestFlight 내부 테스트
   - Android: Google Play Internal testing
   - 실제 현장폰 기준으로 로그인, QR, 카메라, 마이크, 알림, 서명, 번역을 확인한다.

6. 스토어 심사 제출
   - 개인정보처리방침, 앱 개인정보 항목, Google Play Data safety를 정확히 작성한다.
   - 계정 생성 기능이 있으면 계정 삭제 요청 경로도 준비한다.
   - 심사용 로그인 계정과 설명을 제공한다.

## 앱 보안 체크리스트

- 앱은 `http://` 주소를 운영에서 사용하지 않는다.
- API는 `https://api.safe-link.co.kr` 같은 전용 도메인으로 호출한다.
- 운영 모바일 세션 토큰은 평문 Preferences/UserDefaults 저장을 피하고 암호화 저장소로 교체한다.
- 관리자 권한 셀프 승격은 앱에서도 허용하지 않는다.
- QR/NFC/TBM/서명 API는 서버에서 `site_id`와 role을 다시 검증한다.
- 카메라, 마이크, 알림 권한은 실제 기능 직전에 요청한다.
- 개인정보처리방침에는 계정, 현장, 근로자, 서명, 음성/번역 데이터 처리 방식을 명시한다.

## 현재 코드 반영 상태

```text
apps/mobile/capacitor.config.ts
- 기본 웹앱 URL을 https://app-test.safe-link.co.kr로 변경
- 앱 ID/앱 이름을 환경변수로 바꿀 수 있게 변경

apps/mobile/src/config/runtime.ts
- V3 기준 Spring Boot API URL만 필수 설정으로 유지
- Supabase URL/publishable key 필수 조건 제거

apps/mobile/android/app/src/main/AndroidManifest.xml
- Android App Links host를 app-test.safe-link.co.kr로 변경

apps/mobile/public/error.html
- 오프라인 재연결 URL을 app-test.safe-link.co.kr로 변경

apps/mobile/.env.example
- 모바일 스테이징 환경변수 예시 추가

apps/mobile/index.html
- Vite/React 모바일 앱 번들 진입 파일 추가

apps/mobile/android/app/build.gradle
- Android Application ID, 앱 이름, App Links host, 버전, release signing 정보를 환경변수 또는 `release.local.properties`로 주입 가능하게 변경
- `safeLinkReleaseReadiness` Gradle task 추가
- Google Play 업로드용 `bundleRelease` 전에 release 설정 검증

apps/mobile/android/release.local.properties.example
- Google Play 개발자 계정 수령 후 채워 넣을 로컬 release 설정 예시 추가

apps/mobile/scripts/create-android-upload-keystore.sh
- Google Play upload key 생성용 로컬 스크립트 추가

docs/v3/SAFE_LINK_ANDROID_ASSETLINKS_TEMPLATE.json
- Play App Signing SHA-256 fingerprint를 받은 뒤 `/.well-known/assetlinks.json`에 넣을 템플릿 추가

apps/mobile/ios
- Capacitor iOS Xcode 프로젝트 생성
- 카메라/마이크 권한 문구 추가
- Universal Links용 Associated Domains entitlement 추가

apps/mobile/ios/release.local.xcconfig.example
- Apple Developer 계정 수령 후 채워 넣을 로컬 iOS release 설정 예시 추가

apps/mobile/scripts/check-ios-release.mjs
- iOS Bundle ID, 앱 이름, App Links host, version/build, Apple Team ID 누락 여부 점검

docs/v3/SAFE_LINK_IOS_APP_SITE_ASSOCIATION_TEMPLATE.json
- Apple Team ID를 받은 뒤 `/.well-known/apple-app-site-association`에 넣을 템플릿 추가

apps/mobile/store/ios/app-store-connect.template.md
- App Store Connect 입력값 초안 추가

apps/mobile/store/ios/review-notes.template.md
- Apple 심사용 로그인/테스트 절차 템플릿 추가

apps/mobile/store/ios/testflight-notes.template.md
- TestFlight 베타 테스트 안내 템플릿 추가

apps/mobile/store/privacy/app-privacy-draft.md
- App Privacy 설문 답변 초안 추가

apps/mobile/store/privacy/account-deletion-requirements.md
- 계정 삭제 심사 요건과 구현 결정 필요사항 추가

apps/mobile/store/shared/store-asset-inventory.md
- 아이콘, 스크린샷, 지원 URL, 개인정보 URL 등 스토어 자산 목록 추가

apps/mobile/scripts/check-store-readiness.mjs
- 스토어 제출 전 로컬 준비값 누락 점검 명령 추가
```

## 현재 검증 결과

```text
npm --prefix apps/mobile run typecheck: PASS
npm --prefix apps/mobile run build: PASS
npm --prefix apps/mobile audit --audit-level=high: PASS, 0 vulnerabilities
npm --prefix apps/mobile run cap:sync:android: PASS
npm --prefix apps/mobile run cap:add:ios: PASS
npm --prefix apps/mobile run cap:sync:ios: READY, Apple signing is not connected yet
npm --prefix apps/mobile run android:assemble:debug: BLOCKED, Android SDK license/package install required
npm --prefix apps/mobile run android:check:release: READY CHECK TASK ADDED, final account/signing values required
npm --prefix apps/mobile run ios:check:release: READY CHECK TASK ADDED, final Apple account values required
npm --prefix apps/mobile run store:check: READY CHECK TASK ADDED, local store readiness values required
```

## 아직 네이티브 앱으로 부족한 점

```text
Android: Capacitor Gradle 프로젝트를 생성했다.
Android SDK: command line tools는 설치했으나 SDK license 수락과 Android SDK package 설치가 남아 있다.
iOS: Capacitor Xcode 프로젝트를 생성했다.
iOS signing: Apple Developer 계정, Team ID, Bundle ID, provisioning profile 연결이 남아 있다.
```

따라서 현재 상태는 `모바일 웹/Capacitor 셸 빌드 가능 + Android/iOS 네이티브 프로젝트 생성` 단계다. 실제 스토어 제출 파일을 만들려면 앱 ID 확정 후 signing 설정을 연결해야 한다.

## iOS 개발자 계정 수령 직후 연결 절차

Apple Developer 계정이 생기면 아래 순서로 진행한다.

1. Apple Developer에서 App ID / Identifier를 만든다.
   - Bundle ID 후보: `kr.co.safelink.mobile`
   - Associated Domains capability를 켠다.
   - Push Notification은 실제 알림 구현 방식 확정 후 켠다.

2. App Store Connect에서 새 앱을 만든다.
   - 플랫폼: iOS
   - 앱 이름: `SQ Link` 또는 회사가 확정한 이름
   - 기본 언어: 한국어
   - Bundle ID: Apple Developer에서 만든 Bundle ID
   - SKU: 내부 관리용 문자열, 예: `sq-link-ios`

3. 로컬 release 설정 파일을 만든다.

```bash
cp apps/mobile/ios/release.local.xcconfig.example apps/mobile/ios/release.local.xcconfig
```

4. `apps/mobile/ios/release.local.xcconfig`를 채운다.

```text
SAFE_LINK_IOS_BUNDLE_ID=kr.co.safelink.mobile
SAFE_LINK_IOS_APP_NAME=SQ Link
SAFE_LINK_IOS_APP_LINK_HOST=app.safe-link.co.kr
SAFE_LINK_IOS_VERSION=1.0.0
SAFE_LINK_IOS_BUILD=1
SAFE_LINK_IOS_TEAM_ID=<Apple Team ID>
```

5. 운영 앱 값으로 Capacitor iOS 프로젝트를 동기화한다.

```bash
MOBILE_APP_ID=kr.co.safelink.mobile \
MOBILE_APP_NAME="SQ Link" \
MOBILE_WEBAPP_URL=https://app.safe-link.co.kr \
npm --prefix apps/mobile run cap:sync:ios
```

6. Release 설정을 검증한다.

```bash
npm --prefix apps/mobile run ios:check:release
```

7. Xcode를 열어 Signing & Capabilities를 확인한다.

```bash
npm --prefix apps/mobile run cap:open:ios
```

확인할 것:

```text
Team: 서원건설 Apple Developer Team
Bundle Identifier: kr.co.safelink.mobile
Associated Domains: applinks:app.safe-link.co.kr
Camera/Microphone permission description: SET
Version/Build: App Store Connect 업로드마다 증가
```

8. Universal Links 파일을 운영 웹 도메인에 배포한다.
   - Apple Team ID를 확인한다.
   - `docs/v3/SAFE_LINK_IOS_APP_SITE_ASSOCIATION_TEMPLATE.json`의 placeholder를 교체한다.
   - 실제 운영 웹 도메인의 `/.well-known/apple-app-site-association`에 확장자 없이 배포한다.
   - `https://app.safe-link.co.kr/.well-known/apple-app-site-association`가 HTTPS, no redirect로 열려야 한다.

9. Xcode에서 Archive를 만들고 App Store Connect에 업로드한다.
   - Product > Archive
   - Distribute App
   - App Store Connect
   - TestFlight 내부 테스트부터 진행

## 계정 수령 전에 더 준비할 수 있는 항목

아래 항목은 개발자 계정 없이도 미리 작성/준비할 수 있다.

```bash
cp apps/mobile/store/store-readiness.local.json.example apps/mobile/store/store-readiness.local.json
npm --prefix apps/mobile run store:check
```

`store-readiness.local.json`은 git에 커밋하지 않는다. 실제 심사용 비밀번호나 담당자 연락처가 들어갈 수 있기 때문이다.

계정 없이 준비 가능한 산출물:

```text
App Store Connect 입력 문구 초안
TestFlight 테스트 안내문
Apple 심사 메모 초안
App Privacy 설문 답변 초안
스토어 스크린샷/아이콘 준비 목록
계정 삭제 정책/구현 요구사항
심사용 테스트 계정/테스트 현장/테스트 QR 준비 체크
```

계정 없이 끝까지 준비할 수 없는 항목:

```text
Apple Team ID 확인
Apple Developer App ID 생성
Xcode Signing 연결
App Store Connect 앱 record 생성
TestFlight 업로드
App Review 제출
```

## 출시 전 실제 차단 항목

계정이 생겨도 아래가 없으면 바로 심사 제출까지 가지 못한다.

```text
1. 운영 HTTPS 도메인
   - https://app.safe-link.co.kr
   - https://api.safe-link.co.kr

2. 개인정보처리방침 URL
   - App Store Connect metadata와 앱 내부에서 접근 가능해야 한다.

3. 계정 삭제 시작 경로
   - 계정 생성이 있는 앱은 앱 안에서 계정 삭제를 시작할 수 있어야 한다.
   - 단순 이메일 안내만으로는 심사 거절 위험이 있다.

4. 심사용 제한 계정
   - ROOT/HQ_ADMIN 전체 권한 계정이 아니라 제한된 테스트 관리자 계정이 필요하다.

5. 실제 기기 QA
   - iPhone에서 로그인, QR, 카메라, 마이크, 서명, 채팅, 번역, 알림을 확인해야 한다.

6. 스토어 자산
   - 1024 x 1024 앱 아이콘
   - iPhone 스크린샷
   - 앱 설명/부제목/키워드
```

## Android 개발자 계정 수령 직후 연결 절차

Google Play 개발자 계정이 생기면 아래 순서로 진행한다.

1. Play Console에서 새 앱을 만든다.
   - 앱 이름: `SQ Link` 또는 회사가 확정한 이름
   - 기본 언어: 한국어
   - 앱/게임: 앱
   - 무료/유료: 회사 정책에 맞게 선택

2. 최종 Android Application ID를 확정한다.
   - 권장 후보: `kr.co.safelink.mobile`
   - 이미 Play Console에 업로드한 뒤에는 바꾸기 어렵다.

3. 로컬 release 설정 파일을 만든다.

```bash
cp apps/mobile/android/release.local.properties.example apps/mobile/android/release.local.properties
```

4. `apps/mobile/android/release.local.properties`를 채운다.

```text
SAFE_LINK_ANDROID_APP_ID=kr.co.safelink.mobile
SAFE_LINK_ANDROID_APP_NAME=SQ Link
SAFE_LINK_ANDROID_APP_LINK_HOST=app.safe-link.co.kr
SAFE_LINK_ANDROID_VERSION_CODE=1
SAFE_LINK_ANDROID_VERSION_NAME=1.0.0
SAFE_LINK_ANDROID_KEYSTORE_PATH=/absolute/path/to/safelink-upload.jks
SAFE_LINK_ANDROID_KEYSTORE_PASSWORD=<로컬에서만 보관>
SAFE_LINK_ANDROID_KEY_ALIAS=safelink-upload
SAFE_LINK_ANDROID_KEY_PASSWORD=<로컬에서만 보관>
```

5. Google Play upload key를 만든다.

```bash
apps/mobile/scripts/create-android-upload-keystore.sh /absolute/path/to/safelink-upload.jks safelink-upload
```

6. Release 설정을 검증한다.

```bash
npm --prefix apps/mobile run android:check:release
```

7. Google Play 업로드용 AAB를 만든다.

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools \
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
PATH=/opt/homebrew/bin:/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin:$PATH \
npm --prefix apps/mobile run android:bundle:release
```

8. Play Console에서 Play App Signing을 사용해 AAB를 업로드한다.
   - Google Play는 App Signing key와 Upload key를 구분한다.
   - 로컬에서는 Upload key로 AAB를 서명해 올린다.
   - Play App Signing을 사용하면 Google이 최종 배포 APK 서명키를 관리한다.

9. App Links 검증을 연결한다.
   - Play Console의 App signing certificate SHA-256 fingerprint를 복사한다.
   - `docs/v3/SAFE_LINK_ANDROID_ASSETLINKS_TEMPLATE.json`의 fingerprint placeholder를 교체한다.
   - 실제 운영 웹 도메인의 `/.well-known/assetlinks.json`에 배포한다.
   - 앱의 `SAFE_LINK_ANDROID_APP_LINK_HOST`와 assetlinks 도메인이 같아야 한다.

Android debug APK 빌드까지 완료하려면 사용자 명시 승인 후 아래 순서를 진행한다.

```bash
yes | ANDROID_HOME=/opt/homebrew/share/android-commandlinetools \
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
PATH=/opt/homebrew/bin:/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin:$PATH \
sdkmanager --sdk_root=/opt/homebrew/share/android-commandlinetools --licenses

ANDROID_HOME=/opt/homebrew/share/android-commandlinetools \
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
PATH=/opt/homebrew/bin:/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin:$PATH \
sdkmanager --sdk_root=/opt/homebrew/share/android-commandlinetools \
  --install "platform-tools" "platforms;android-36" "build-tools;35.0.0"

ANDROID_HOME=/opt/homebrew/share/android-commandlinetools \
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
PATH=/opt/homebrew/bin:/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin:$PATH \
npm --prefix apps/mobile run android:assemble:debug
```

## 참고 공식 문서

- Google Play: Play App Signing은 app signing key와 upload key를 구분한다.
  - https://support.google.com/googleplay/android-developer/answer/9842756
- Google Play: 앱 업로드에는 versionCode 증가와 target API 요구사항이 있다.
  - https://support.google.com/googleplay/android-developer/answer/9859152
- Apple: App Privacy 정보와 Privacy Policy URL 필요
  - https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Apple: 조직 등록에는 법인 상태와 D-U-N-S 번호 필요
  - https://developer.apple.com/help/account/membership/program-enrollment/
- Google Play: 조직 개발자 계정에는 D-U-N-S, 조직 정보, 연락처가 필요
  - https://support.google.com/googleplay/android-developer/answer/13628312
- Google Play: Data safety와 privacy policy 작성 필요
  - https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play: Internal testing은 최대 100명까지 빠르게 테스트 가능
  - https://support.google.com/googleplay/android-developer/answer/9845334
