# SAFE-LINK NFC 인증 API 스펙 — 하이정보 회신용

> **발신**: 서원토건 미래전략TF 김무빈 차장  
> **수신**: 하이정보 담당자  
> **작성일**: 2026-05-20  
> **버전**: v1.0 (확정)  
> **우선 적용 현장**: 과천G-TOWN(GC-GTOWN), 청주센텀푸르지오자이(CJ-CENTUM)

---

## 1. 배경 및 식별자 변경 사유

### 1.1 식별자 형식 변경

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| 식별 방식 | 이니셜 2자 + 휴대폰 뒷 4자리 | 생년월일 8자리(YYYYMMDD) + 휴대폰 뒷 4자리 |
| NFC 저장값 | 평문 | **HMAC-SHA256 해시 토큰 16자리** |

### 1.2 개인정보보호법 검토 결과

- 생년월일 + 휴대폰 뒷 4자리 결합 = **개인정보보호법 제2조 제1호상 개인정보**
- 관련 판례: 대전지법 논산지원 2013고단17
- 대응 방식: **평문 노출 금지** → HMAC-SHA256 해시 토큰 방식으로 전환
- DB 저장 시 원본 식별자 **AES-256 암호화** 필수

---

## 2. 핵심 결정사항 요약

| 항목 | 결정 |
|------|------|
| 식별자 원본 | YYYYMMDD(8자리) + 휴대폰 뒷 4자리 = 12자리 |
| NFC/URL 저장값 | **HMAC-SHA256 해시 앞 16자리 hex 토큰** (평문 금지) |
| 전송 프로토콜 | HTTPS 필수 |
| 인증 방식 | API Key 헤더 (`X-API-Key`) |
| 응답 형식 | JSON, 8개 필드 |
| DB 저장 | 원본 식별자 AES-256 암호화 |
| 응답 제외 필드 | 생년월일, 휴대폰번호 (개인정보 최소수집 원칙) |

---

## 3. API 스펙 — Request (서원토건 → 하이정보)

### 3.1 엔드포인트

```
GET https://api.hi-info.co.kr/safelink/v1/worker/{token}
```

### 3.2 Path Parameter

| 이름 | 형식 | 길이 | 설명 | 예시 |
|------|------|------|------|------|
| `token` | hex string | **16자** | HMAC-SHA256(원본 + Salt) 앞 16자리 | `e7a3f9c2b1d4e85f` |

### 3.3 Headers

```http
X-API-Key: {하이정보 발급 API Key}
Accept: application/json
```

### 3.4 Request 예시

```http
GET /safelink/v1/worker/e7a3f9c2b1d4e85f HTTP/1.1
Host: api.hi-info.co.kr
X-API-Key: sk_live_xxxxxxxxxxxxxxxxxxxx
Accept: application/json
```

---

## 4. API 스펙 — Response (하이정보 → 서원토건)

### 4.1 성공 응답 (HTTP 200)

```json
{
  "status": "success",
  "data": {
    "worker_id": "SW-CJ-000123",
    "name": "Nguyen Van A",
    "nationality": "VN",
    "language": "vi",
    "site_id": "CJ-CENTUM",
    "role": "worker",
    "trade": "형틀",
    "safety_cert_valid": true
  },
  "timestamp": "2026-05-20T09:00:00+09:00"
}
```

### 4.2 응답 필드 정의 (8개)

| 필드 | 타입 | 필수 | 설명 | 예시 |
|------|------|:----:|------|------|
| `status` | string | ✅ | `success` / `not_found` / `duplicate` / `error` | `"success"` |
| `data.worker_id` | string | ✅ | 내부 일련번호 (의미 없는 식별자) | `"SW-CJ-000123"` |
| `data.name` | string | ✅ | 표시명 (실명 또는 통명) | `"Nguyen Van A"` |
| `data.nationality` | string(2) | ✅ | ISO 3166-1 alpha-2 국가코드 | `"VN"`, `"KR"`, `"UZ"` |
| `data.language` | string(2) | ✅ | ISO 639-1 언어코드 | `"vi"`, `"ko"`, `"uz"` |
| `data.site_id` | string | ✅ | 현장코드 (§6 목록 참조) | `"CJ-CENTUM"` |
| `data.role` | string | ✅ | `worker` / `manager` | `"worker"` |
| `data.trade` | string | ❌ | 직종 (근로자만 해당) | `"형틀"`, `"철근"` |
| `data.safety_cert_valid` | boolean | ✅ | 안전교육 이수 여부 | `true` |
| `timestamp` | string | ✅ | ISO 8601 (KST) | `"2026-05-20T09:00:00+09:00"` |

### 4.3 실패 응답

#### 미일치 (HTTP 404)
```json
{
  "status": "not_found",
  "error_code": "E001",
  "message": "Worker token not found",
  "timestamp": "2026-05-20T09:00:00+09:00"
}
```

#### 중복 (HTTP 409)
```json
{
  "status": "duplicate",
  "error_code": "E002",
  "message": "Multiple workers match this token. Manual verification required.",
  "timestamp": "2026-05-20T09:00:00+09:00"
}
```

#### 인증 실패 (HTTP 401)
```json
{
  "status": "error",
  "error_code": "E401",
  "message": "Invalid or missing API key",
  "timestamp": "2026-05-20T09:00:00+09:00"
}
```

### 4.4 에러 코드표

| 코드 | HTTP | 의미 |
|------|------|------|
| E001 | 404 | 토큰 미일치 (미등록) |
| E002 | 409 | 토큰 중복 |
| E003 | 422 | 토큰 형식 오류 (16자 hex 아님) |
| E401 | 401 | API Key 무효 |
| E429 | 429 | Rate Limit 초과 |
| E500 | 500 | 서버 내부 오류 |

### 4.5 응답에서 절대 제외 요청 필드

개인정보보호법 제29조 안전조치 의무 및 최소수집 원칙:

- ❌ 생년월일 (birthday)
- ❌ 휴대폰번호 전체 (phone)
- ❌ 휴대폰번호 뒷 4자리 (phone_last4)
- ❌ 주소, 외국인등록번호, 여권번호

---

## 5. 해시 토큰 생성 로직

### 5.1 알고리즘

```
원본:   YYYYMMDD + phone_last4  (12자리)
        예: "198703151234"
                ↓
        HMAC-SHA256(SALT, 원본)
                ↓
해시:   64자리 hex string
                ↓
토큰:   앞 16자리 추출 → NFC/URL에 사용
        예: "e7a3f9c2b1d4e85f"
```

### 5.2 구현 예시 (Python)

```python
import hmac, hashlib, os

def generate_worker_token(birthday: str, phone_last4: str) -> str:
    # birthday: 'YYYYMMDD', phone_last4: '1234'
    salt = os.environ["SAFE_LINK_HASH_SALT"]
    raw = f"{birthday}{phone_last4}".encode("utf-8")
    digest = hmac.new(salt.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    return digest[:16]  # 앞 16자리
```

### 5.3 NFC 카드 기록 형식

```
NFC 칩 규격:  NTAG213 (총 메모리 180바이트)
NDEF 사용:    약 137바이트 (실사용 가능)
저장 URL:     https://safe-link.co.kr/w/{token}
저장 예시:    https://safe-link.co.kr/w/e7a3f9c2b1d4e85f
URL 용량:     약 42바이트 → 여유 95바이트
```

---

## 6. 현장코드 목록 (30개소)

> `site_id` 응답 필드에 사용되는 코드 기준

| 번호 | 현장명 | 현장코드(site_id) |
|------|--------|-------------------|
| 01 | 과천G-TOWN | GC-GTOWN |
| 02 | 고양삼송 | GY-SAMSONG |
| 03 | 과천자이 | GC-XI |
| 04 | 남양주왕숙(대우) | NYJ-WANGSUK-DAEWOO |
| 05 | 남양주진접(디엘) | NYJ-JINJEOP-DL |
| 06 | 동탄대우 | DT-DAEWOO |
| 07 | 부산범일대우 | BS-BEOMIL-DAEWOO |
| 08 | 부산에코2차(13BL) | BS-ECO2-13BL |
| 09 | 부산에코3차(31BL) | BS-ECO3-31BL |
| 10 | 성남산성대우 | SN-SANSEONG-DAEWOO |
| 11 | 성수동 업무시설 | SS-OFFICE |
| 12 | 식사동현장 | SIKSA |
| 13 | 신광교 지산센터 | SGG-JISAN |
| 14 | 안성현대차 | AS-HYUNDAI |
| 15 | 양산사송 | YS-SASONG |
| 16 | 여수글렌츠현장1공구 | YS-GLENZ-1 |
| 17 | 울산문수로 | US-MUNSURO |
| 18 | 울산야음동 | US-YAEUM |
| 19 | 원주무실 | WJ-MUSIL |
| 20 | 유원제일1차 | YW-JEIL1 |
| 21 | 의정부푸르지오 | UJB-PRUGIO |
| 22 | 이천 자이더레브 | IC-XITHEREVE |
| 23 | 장성파인대우 | JS-PINE-DAEWOO |
| 24 | 철산역자이 | CS-XI |
| 25 | 청담서원빌딩 | CD-SEOWON-BLDG |
| 26 | 청주센텀푸르지오자이 | CJ-CENTUM |
| 27 | 탕정대우 | TJ-DAEWOO |
| 28 | 탕정디엘 | TJ-DL |
| 29 | 평택대우A공구 | PT-DAEWOO-A |
| 30 | 미정 | SITE-030 |

---

## 7. 보안 요구사항

- [x] HTTPS 강제 (HTTP 차단)
- [x] API Key 헤더 인증 (`X-API-Key`)
- [x] Rate Limiting (분당 60req/site 권장)
- [x] Salt는 환경변수 관리, 코드 하드코딩 금지
- [x] DB 원본 식별자 AES-256 암호화 저장
- [x] 응답에 생년월일·휴대폰번호 포함 금지
- [x] 접근 로그 90일 이상 보관
- [x] NFC 카드 분실 시 토큰 무효화 API 별도 구현
- [x] 응답 시간 200ms 이내

---

## 8. 리스크 및 대응

| 리스크 | 대응 |
|--------|------|
| Salt 유출 | 환경변수 관리, 키 로테이션 정책 수립 |
| 동일 토큰 충돌 | DB UNIQUE 제약 + 등록 시점 중복 검증 |
| NFC 카드 분실 | 토큰 무효화 API + 재발급 시 새 토큰 적용 |
| 외국인 근로자 동의 미수령 | SAFE-LINK 다국어 번역엔진으로 동의서 자동 생성 |

---

## 9. 문의

**서원토건 미래전략TF**  
담당: 김무빈 차장  
이메일: visionlab@seowonenc.co.kr

---

> **핵심 요약**: 평문 노출 0건 | 응답 필드 8개 | NFC 토큰 16자리 | DB AES-256
