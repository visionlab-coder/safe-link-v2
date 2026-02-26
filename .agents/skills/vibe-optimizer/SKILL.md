---
name: vibe-optimizer
description: 바이브 코딩 환경을 위한 고성능 PC 최적화 스킬
---

## 스킬 개요
`vibe-optimizer`는 **바이브 코딩**(주로 웹 프론트엔드·Node.js 개발) 환경을 최적화하기 위해 설계된 스킬입니다. 불필요한 파일·캐시·쿠키 등을 정리하고, 시스템 리소스를 회복시켜 빠른 컴파일·빌드·디버깅을 가능하게 합니다.

## 주요 기능
1. **진단 (`diagnose`)** – 메모리·CPU·디스크 사용량, npm/yarn 캐시 용량, 브라우저(Edge) 캐시·쿠키 현황을 출력합니다.
2. **정리 (`cleanup`)** – 다음 항목을 선택적으로 삭제합니다.
   - Windows 임시 폴더(`%TEMP%`, `C:\Windows\Temp`)
   - Recycle Bin 비우기
   - npm, yarn, pnpm 캐시 (`npm cache clean --force`, `yarn cache clean`, `pnpm store prune`)
   - Node_modules 내부 캐시(`node_modules/.cache`, `node_modules/.pnpm`)
   - Edge 브라우저 캐시·쿠키 (`Clear-BrowserCache` PowerShell 함수 사용)
   - 시스템 로그 파일 및 임시 로그
   - 사용자 지정 폴더(`%APPDATA%\vscode\Cache` 등)
3. **안전 확인** – 실제 삭제 전 `-WhatIf` 옵션을 사용해 미리 확인하고, 사용자에게 최종 승인을 요청합니다.

## 사용 방법
```powershell
# 진단 실행
vibe-optimizer diagnose

# 정리 실행 (옵션 선택)
# 예: 임시 파일과 npm 캐시만 정리
vibe-optimizer cleanup -Temp -NpmCache
```

## 주의사항
- 시스템 필수 프로세스·파일은 절대 삭제하지 않으며, `-WhatIf` 옵션을 기본으로 적용합니다.
- 정리 작업은 **사용자 승인** 후에만 실행됩니다.
- 스크립트는 PowerShell 전용이며, 관리자 권한이 필요할 수 있습니다.

## 스크립트 위치
- `scripts/diagnose.ps1` – 시스템 진단 스크립트
- `scripts/cleanup.ps1` – 정리 스크립트

## 기여
필요에 따라 스크립트를 확장하거나 새로운 옵션을 추가할 수 있습니다. PR은 언제든 환영합니다.
