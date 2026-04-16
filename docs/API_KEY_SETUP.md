# SAFE-LINK V2 — Premium STT/번역 API 키 발급 가이드

현장 소음 환경에서도 완벽 작동하는 프리미엄 파이프라인:
- **STT**: OpenAI Whisper (소음 내성 최상, 99개 언어)
- **번역**: Naver Papago (한/영/중/일/베/인니/태/러/프/스 10개 언어 최고 품질)
- **TTS**: Google Cloud Neural2/WaveNet (기존 유지)
- **폴백**: Google Cloud STT + Translation (전체 언어 안전망)

---

## 1. OpenAI API Key 발급 (Whisper STT용)

### 비용 예상
- Whisper: **$0.006 / 분** (1시간 TBM = 약 $0.36 ≈ 500원)
- 30개 현장 × 하루 30분 × 25일 = **월 ~$135 (약 18만원)**

### 발급 절차
1. https://platform.openai.com/signup 접속 → 회사 이메일(visionlab@seowonenc.co.kr)로 가입
2. **좌측 메뉴 → Billing → Add payment method** (법인카드 등록)
3. **Usage limits → Monthly budget: $200** 설정 (폭주 방지)
4. **좌측 메뉴 → API keys → Create new secret key**
   - 이름: `safe-link-v2-prod`
   - Permissions: `Restricted` → Audio (Write) 만 허용
5. `sk-proj-...` 형태 키 복사 (이 창 닫으면 다시 못 봄!)

### 환경변수 등록
```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxx
```

---

## 2. Naver Papago API Key 발급 (번역용)

### 비용 예상
- 파파고: **월 1천만 글자 무료** → 이후 건당 과금
- 30개 현장 일평균 번역량 기준 **사실상 무료** (초과해도 1만원 이하)

### 발급 절차
1. https://www.ncloud.com 접속 → 회사 계정 로그인 (필요시 신규 가입)
2. **콘솔 → AI·Application Service → Papago Translation** 검색
3. **이용 신청 → 약관 동의 → 서비스 활성화**
4. **Application 등록**
   - 앱 이름: `safe-link-v2`
   - 서비스 환경: `WEB`
   - 서비스 URL: `https://safe-link-v2.vercel.app`
5. 등록 후 **Client ID**, **Client Secret** 확인 (앱 상세 페이지)

### 환경변수 등록
```
NAVER_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
NAVER_CLIENT_SECRET=xxxxxxxxxxxxxxxx
```

### 주의
- 네이버 클라우드(ncloud)에서 발급해야 함. 구 네이버 개발자센터(developers.naver.com)는 2024년 종료됨
- Papago 요청당 최대 5000자 제한 (번역 라우트에서 이미 검증 중)

---

## 3. Vercel Production 환경변수 등록

```bash
# Vercel CLI로 한번에 등록 (권장)
vercel env add OPENAI_API_KEY production
vercel env add NAVER_CLIENT_ID production
vercel env add NAVER_CLIENT_SECRET production

# 등록 후 재배포 필수 (env는 빌드 타임에 반영)
vercel --prod
```

또는 웹 UI:
1. https://vercel.com → safe-link-v2 프로젝트 → Settings → Environment Variables
2. 위 3개 Key/Value 입력, Environment: **Production** 체크
3. Deployments → 최신 배포 → **Redeploy** (env 반영을 위해 필수)

---

## 4. 로컬 테스트용 `.env.local`

```
GOOGLE_CLOUD_API_KEY=AIza...
OPENAI_API_KEY=sk-proj-...
NAVER_CLIENT_ID=...
NAVER_CLIENT_SECRET=...
```

`.env.local`은 `.gitignore`에 이미 포함되어 있어 커밋되지 않습니다.

---

## 5. 검증 체크리스트

키 등록 후 재배포하고 아래 확인:

- [ ] `/admin/tbm/create` 한국어 음성 녹음 → 응답 JSON에 `"engine":"whisper"` 포함
- [ ] 베트남어/중국어 등 비한국어 녹음 → `"engine":"whisper"` 포함
- [ ] TBM 브로드캐스트 → 번역 응답에 `"engine":"papago"` 포함 (지원 언어 기준)
- [ ] 우즈벡/네팔 등 비지원 언어 → `"engine":"google"` 자동 폴백
- [ ] Vercel Logs에 `[STT Whisper]` 또는 `[Translation API] Papago` 에러 없음

---

## 6. 롤백 (문제 발생 시)

키만 제거하면 자동으로 Google 경로로 폴백:
```bash
vercel env rm OPENAI_API_KEY production
vercel env rm NAVER_CLIENT_ID production
vercel env rm NAVER_CLIENT_SECRET production
vercel --prod
```

코드 변경 없이 즉시 기존 Google-only 동작으로 돌아감.
