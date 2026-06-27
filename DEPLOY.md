# SAFE-LINK 배포 런북

> 소스 1곳(GitHub) + 배포 대상 2곳(Cloudflare·Vercel). `git push`는 **소스만** 갱신 — 프로덕션은 아래 절차로 별도 배포.

## 구조
```
GitHub (visionlab-coder/safe-link-v2)  ── 소스 1곳
  ├─→ Cloudflare Workers  safe-link-v2.visionlab.workers.dev   (주, 수동 CLI 배포)
  └─→ Vercel              safe-link-v2.vercel.app              (연동 시 자동/또는 수동)
```
- GitHub Actions 워크플로 **없음** → 푸시 자동 CI·자동 배포 없음.
- 두 대상 **둘 다 유지**(결정). 배포는 각각 실행해야 함.

## 배포 전 선결 (둘 다 동일하게 설정 — 안 하면 신규 기능 동작 안 함)
| env | 용도 | 주의 |
|---|---|---|
| `DEVELOPER_EMAILS` | `/root` 개발자 콘솔 게이트(쉼표 구분) | 미설정 시 `/root` 전원 잠김(fail-closed) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | 런타임 키/엔진 오버라이드 저장 | **Workers는 인메모리 휘발 → Redis 필수.** 없으면 키변경 미적용 |
| `SAFE_LINK_AES_KEY` | 저장 키 AES-256-GCM 암호화 | **두 대상에서 반드시 동일 값** (다르면 한쪽이 복호화 불가) |

> ⚠️ 두 대상이 같은 Upstash Redis를 공유하면 `SAFE_LINK_AES_KEY`가 일치해야 양쪽 모두 키를 읽음.

## 배포 절차

### 1) master 머지 (프로덕션은 master 기준)
```bash
git checkout master && git pull
git merge wip/ai-engine-upgrade-20260622   # 충돌 확인
# 로컬 검증: npx tsc --noEmit && npx eslint . && npm run build
```

### 2) Cloudflare (주)
```bash
# env(secret) 설정 — 최초 1회
npx wrangler secret put DEVELOPER_EMAILS
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
# (SAFE_LINK_AES_KEY 는 기존 설정 확인; 없으면 동일 값으로 put)
npm run deploy        # opennextjs-cloudflare build && wrangler deploy
```

### 3) Vercel
- **Git 연동돼 있으면**: master 푸시 시 자동 배포(프리뷰는 브랜치 푸시 시 자동). Vercel 대시보드에서 연동·env 확인.
- **수동이면**: `vercel --prod` (프리뷰는 `vercel`). env는 대시보드 또는 `vercel env add`.

## 배포 후 검증 (각 URL에서)
```bash
B=<배포URL>
curl -s $B/api/check                       # 401 (인증게이트)
curl -s $B/api/root/engine-config          # {"developer":false,...} (무쿠키 fail-closed)
curl -s -X OPTIONS $B/api/auth/admin-login -H "Origin: https://evil.x" -H "Access-Control-Request-Method: POST" -i | grep -i allow-origin   # 비어야 함(반영 안 함)
# 개발자 로그인 후 /root 접속 → 키 변경 → /api/translate 결과 엔진 반영 확인
```

## 주의
- 신규 RTT/온디바이스는 **플래그 게이트**(`NEXT_PUBLIC_REALTIME_STT_ENGINE`, 기본 Google) → 배포해도 기본 동작 불변.
- 현 배포본은 구버전(예: `/api/flitto/rtt-token` 404). 배포 시 빌드 전체 교체되므로 에러메시지·모바일 CORS 등 동작 변화 동반 → 현장 영향 점검 후 진행.
- 모바일 상용앱은 벤더(범데이터소프트) 이관 — 본 배포는 웹 PoC 대상.
