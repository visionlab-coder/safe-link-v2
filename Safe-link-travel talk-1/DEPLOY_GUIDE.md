# SAFE-LINK Travel Talk — 배포 가이드

## 전체 구조

```
safe-link-v2/
├── pages/
│   ├── travel.jsx          ← 메인 UI (신규)
│   └── api/
│       └── travel/
│           ├── translate.js  ← 번역 + Pusher 전송 (신규)
│           └── join.js       ← 입장 알림 (신규)
└── .env.local               ← 환경변수 추가
```

## Step 1: Pusher 무료 계정 생성 (5분)

1. https://pusher.com 접속 → Sign up (무료)
2. "Create app" 클릭
3. 설정:
   - App name: safe-link-travel
   - Cluster: **ap3** (Asia Pacific, 한국/일본 최적)
   - Front-end: React
   - Back-end: Node.js
4. "App Keys" 탭에서 키 4개 복사:
   - app_id
   - key
   - secret
   - cluster

## Step 2: 패키지 설치

```bash
cd 사무실PC ~/safe-link-v3

# Pusher 패키지 설치
npm install pusher pusher-js
```

## Step 3: 파일 복사

```bash
# 3개 파일을 safe-link-v3에 복사
cp travel.jsx        pages/travel.jsx
cp translate.js      pages/api/travel/translate.js
cp join.js           pages/api/travel/join.js
```

## Step 4: 환경변수 추가

### 로컬 (.env.local)
```
PUSHER_APP_ID=발급받은값
PUSHER_KEY=발급받은값
PUSHER_SECRET=발급받은값
PUSHER_CLUSTER=ap3

NEXT_PUBLIC_PUSHER_KEY=발급받은값
NEXT_PUBLIC_PUSHER_CLUSTER=ap3

GOOGLE_TRANSLATE_API_KEY=기존에쓰던키
```

### Vercel 환경변수 (대시보드에서)
Vercel → safe-link-v2 → Settings → Environment Variables
위 6개 변수 동일하게 입력

## Step 5: 배포

```bash
git add pages/travel.jsx pages/api/travel/
git commit -m "feat: Travel Talk 양방향 실시간 통역"
git push origin main
```

→ Vercel 자동 배포 완료!

## Step 6: 테스트

1. https://safe-link-v2.vercel.app/travel 접속
2. 언어 선택 → "새 대화 시작"
3. 4자리 코드 생성됨
4. 다른 폰(또는 브라우저 탭)에서 같은 URL 접속
5. 코드 입력 → 연결!
6. 각자 마이크 버튼 눌러서 말하기

## 완성 URL

```
https://safe-link-v2.vercel.app/travel
```

## 비용

| 항목 | 비용 |
|------|------|
| Pusher 무료 플랜 | $0 (200 동시접속, 20만 메시지/일) |
| Google Translate | 기존 키 재사용 |
| Vercel 배포 | 기존 플랜 포함 |
| **합계** | **$0** |

## Pusher 무료 플랜으로 충분?

- 동시 연결: 200개 → TBM 500명도 가능 (세션 단위)
- 일일 메시지: 200,000건 → 여행 개인 사용은 문제 없음
