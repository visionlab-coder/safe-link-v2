# SQ Link V3 Mobile App

이 폴더는 iOS/Android 스토어 배포 전에 준비하는 Capacitor 모바일 앱 셸이다.

## 현재 기준

```text
웹앱 테스트 도메인: https://app-test.safe-link.co.kr
API 테스트 도메인: https://api-test.safe-link.co.kr
임시 앱 ID: kr.co.safelink.mobile.dev
임시 앱 이름: SQ Link Dev
```

스토어 업로드 전에는 회사가 최종 앱 이름과 bundle/package id를 확정해야 한다. 한번 스토어에 올라간 앱 ID는 쉽게 바꾸지 않는다.

현재 Android 폴더는 Capacitor Gradle 프로젝트로 생성되어 있다. iOS 폴더는 Capacitor Xcode 프로젝트로 생성되어 있다.

## 로컬 설정

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
npm --prefix apps/mobile run typecheck
npm --prefix apps/mobile run build
```

## 아직 남은 것

- `app-test.safe-link.co.kr`, `api-test.safe-link.co.kr` DNS/HTTPS 연결
- iOS 네이티브 프로젝트 생성
- Android 네이티브 프로젝트 재생성 또는 보강
- 앱 아이콘, 스플래시, 스토어 스크린샷 제작
- 개인정보처리방침 URL, 계정 삭제 URL 준비
- 모바일 토큰 저장소를 암호화 저장소로 교체
- TestFlight / Google Play internal testing QA

## Android 개발자 계정 연결 준비

Google Play 개발자 계정이 생기면 아래 값만 확정하면 된다.

```text
SAFE_LINK_ANDROID_APP_ID=kr.co.safelink.mobile
SAFE_LINK_ANDROID_APP_NAME=SQ Link
SAFE_LINK_ANDROID_APP_LINK_HOST=app.safe-link.co.kr
SAFE_LINK_ANDROID_VERSION_CODE=1
SAFE_LINK_ANDROID_VERSION_NAME=1.0.0
SAFE_LINK_ANDROID_KEYSTORE_PATH=<업로드 키 .jks 경로>
SAFE_LINK_ANDROID_KEYSTORE_PASSWORD=<로컬에서만 보관>
SAFE_LINK_ANDROID_KEY_ALIAS=safelink-upload
SAFE_LINK_ANDROID_KEY_PASSWORD=<로컬에서만 보관>
```

설정 파일 준비:

```bash
cp apps/mobile/android/release.local.properties.example apps/mobile/android/release.local.properties
```

`release.local.properties`와 `.jks` 파일은 git에 커밋하지 않는다.

업로드 키 생성:

```bash
apps/mobile/scripts/create-android-upload-keystore.sh /absolute/path/to/safelink-upload.jks safelink-upload
```

Release 설정 확인:

```bash
npm --prefix apps/mobile run android:check:release
```

Google Play 업로드용 AAB 생성:

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools \
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
PATH=/opt/homebrew/bin:/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin:$PATH \
npm --prefix apps/mobile run android:bundle:release
```

생성 예상 위치:

```text
apps/mobile/android/app/build/outputs/bundle/release/app-release.aab
```

## 검증

```bash
npm --prefix apps/mobile run typecheck
npm --prefix apps/mobile run build
npm --prefix apps/mobile audit --audit-level=high
```

Android 네이티브 프로젝트 동기화:

```bash
npm --prefix apps/mobile run cap:sync:android
```

iOS 네이티브 프로젝트 동기화:

```bash
npm --prefix apps/mobile run cap:sync:ios
```

## iOS 개발자 계정 연결 준비

Apple Developer 계정이 생기면 아래 값만 확정하면 된다.

```text
SAFE_LINK_IOS_BUNDLE_ID=kr.co.safelink.mobile
SAFE_LINK_IOS_APP_NAME=SQ Link
SAFE_LINK_IOS_APP_LINK_HOST=app.safe-link.co.kr
SAFE_LINK_IOS_VERSION=1.0.0
SAFE_LINK_IOS_BUILD=1
SAFE_LINK_IOS_TEAM_ID=<Apple Team ID>
```

설정 파일 준비:

```bash
cp apps/mobile/ios/release.local.xcconfig.example apps/mobile/ios/release.local.xcconfig
```

`release.local.xcconfig`는 git에 커밋하지 않는다.

운영 앱 값으로 Capacitor iOS 프로젝트 동기화:

```bash
MOBILE_APP_ID=kr.co.safelink.mobile \
MOBILE_APP_NAME="SQ Link" \
MOBILE_WEBAPP_URL=https://app.safe-link.co.kr \
npm --prefix apps/mobile run cap:sync:ios
```

Release 설정 확인:

```bash
npm --prefix apps/mobile run ios:check:release
```

Xcode 열기:

```bash
npm --prefix apps/mobile run cap:open:ios
```

App Store Connect 업로드용 `.ipa`는 Apple Developer 계정, Xcode signing team, provisioning profile이 연결된 뒤 Xcode Archive에서 만든다.

## 스토어 제출 자료 준비

App Store Connect와 Google Play Console에 입력할 자료는 `apps/mobile/store` 아래에 모아둔다.

```text
apps/mobile/store/ios/app-store-connect.template.md
apps/mobile/store/ios/review-notes.template.md
apps/mobile/store/ios/testflight-notes.template.md
apps/mobile/store/privacy/app-privacy-draft.md
apps/mobile/store/privacy/account-deletion-requirements.md
apps/mobile/store/shared/store-asset-inventory.md
```

출시 전 점검용 로컬 파일:

```bash
cp apps/mobile/store/store-readiness.local.json.example apps/mobile/store/store-readiness.local.json
npm --prefix apps/mobile run store:check
```

`store-readiness.local.json`에는 심사용 계정 상태, 개인정보처리방침 URL, 계정 삭제 URL, 스크린샷 준비 상태를 적는다. 실제 심사용 비밀번호는 git에 커밋하지 않는다.

Android debug 빌드:

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools \
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
PATH=/opt/homebrew/bin:/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin:$PATH \
npm --prefix apps/mobile run android:assemble:debug
```

현재 로컬은 Android command line tools 설치까지 완료되어 있다. debug APK 빌드에는 Android SDK license 수락과 `platforms;android-36`, `build-tools;35.0.0`, `platform-tools` 설치가 추가로 필요하다.
