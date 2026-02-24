---
name: s-deploy
description: SAFE-LINK v2 프로젝트를 Cloudflare Workers에 배포하는 워크플로우. Next.js + @opennextjs/cloudflare 기반.
---

# SAFE-LINK Cloudflare 배포 스킬

## 개요
SAFE-LINK v2 프로젝트를 Cloudflare Workers에 배포하는 전용 스킬입니다.
- **프레임워크**: Next.js 15 + @opennextjs/cloudflare
- **배포 대상**: Cloudflare Workers
- **배포 URL**: https://safe-link-v2.visionlab.workers.dev
- **계정**: visionlab@seowonenc.co.kr (Account ID: bd35deb2e86c40a0cad3643be29222a0)

## 사전 요구사항
- Node.js 20+
- `npm install` 완료 (node_modules 존재)
- Wrangler 인증 완료 (`npx wrangler login` 또는 `$env:CLOUDFLARE_API_KEY` 설정)

## 배포 절차

### 1단계: 빌드
// turbo
```powershell
npx opennextjs-cloudflare build
```
- `.open-next/` 디렉토리에 빌드 결과물 생성
- `open-next.config.ts`가 프로젝트 루트에 있어야 함
- Windows에서 정상 작동 확인됨

### 2단계: 배포
```powershell
npx wrangler deploy
```
- `wrangler.toml` 설정 기반으로 Cloudflare Workers에 배포
- 환경변수는 `wrangler.toml`의 `[vars]` 섹션에 정의됨
- 배포 완료 후 URL: https://safe-link-v2.visionlab.workers.dev

### 3단계: 배포 확인
// turbo
```powershell
Invoke-RestMethod -Uri "https://safe-link-v2.visionlab.workers.dev" -Method Head
```

## 원커맨드 배포 (빌드 + 배포)
```powershell
npx opennextjs-cloudflare build; npx wrangler deploy
```

## 환경변수 설정
`wrangler.toml`의 `[vars]` 섹션에서 관리:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase 프로젝트 URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase Anonymous Key
- `GOOGLE_CLOUD_API_KEY` - Google Cloud TTS/STT API Key (민감정보는 `wrangler secret put` 사용)

### 시크릿 추가 (민감 정보용)
```powershell
npx wrangler secret put GOOGLE_CLOUD_API_KEY
```

## 핵심 설정 파일

### open-next.config.ts
```typescript
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
export default defineCloudflareConfig({});
```

### wrangler.toml
```toml
name = "safe-link-v2"
main = ".open-next/worker.js"
compatibility_date = "2024-12-30"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = ".open-next/assets"
binding = "ASSETS"
```

## 트러블슈팅

### `npm ci` 동기화 에러
```powershell
Remove-Item -Recurse -Force node_modules, package-lock.json; npm install
git add package-lock.json; git commit -m "fix: lock file sync"; git push
```

### Cloudflare CI 빌드 실패 시 (GitHub 연동)
CI 빌드가 실패하면 로컬에서 직접 빌드 + 배포:
```powershell
npx opennextjs-cloudflare build; npx wrangler deploy
```

### `export const runtime = "edge"` 관련
- `@opennextjs/cloudflare`는 Node.js 런타임 사용
- 소스코드에서 `export const runtime = "edge"` 선언을 모두 **제거**해야 함

### Wrangler 인증
```powershell
npx wrangler login  # OAuth 브라우저 인증
npx wrangler whoami  # 인증 상태 확인
```

## 주의사항
- `@cloudflare/next-on-pages`는 **사용하지 않음** (구식, Windows 비호환)
- `@opennextjs/cloudflare`가 Cloudflare 공식 권장 방식
- `.open-next/` 폴더는 `.gitignore`에 포함되어 있음
- 배포 전 반드시 `npm install`로 의존성 설치 확인
