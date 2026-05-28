# SAFE-LINK × 하이정보 연동 API 스펙 v1.2

> **발신**: 서원토건 미래전략TF 김무빈 차장 | visionlab@seowonenc.co.kr  
> **수신**: 하이정보 담당자  
> **작성일**: 2026-05-20 | **버전**: v1.2 (연동 흐름·등록 API·무효화·SLA 추가)  
> **우선 적용 현장**: 과천G-TOWN(GC-GTOWN), 청주센텀푸르지오자이(CJ-CENTUM)

---

## 변경 이력

| 버전 | 주요 변경 |
|------|-----------|
| v1.0 | 초안 (토큰 16자, HMAC 표기 오류) |
| v1.1 | 토큰 24자 수정, HMAC 표기 교정, `/w/{token}` 구현 완료 표기 |
| **v1.2** | **전체 연동 흐름도 추가, 근로자 사전등록 API 스펙 추가, 토큰 무효화 API 추가, 샌드박스 URL·SLA 추가, 협의 필요 항목 명시** |

---

## 1. 시스템 개요

### 1.1 역할 분담

| 주체 | 역할 |
|------|------|
| **서원토건 SAFE-LINK** | NFC 카드 발급·관리, 근로자 현장 등록, API 호출자 |
| **하이정보** | 근로자 DB 보관, 토큰 기반 조회 API 제공 |

### 1.2 식별 체계

| 항목 | 내용 |
|------|------|
| 원본 식별자 | 생년월일(YYYYMMDD) + 휴대폰 뒷 4자리 = 12자리 |
| NFC/URL 저장값 | **HMAC-SHA256 해시 앞 24자리 hex 토큰** (평문 절대 금지) |
| DB 저장 | 원본 식별자 AES-256-GCM 암호화 |

---

## 2. 전체 연동 흐름

```
[서원토건 관리자]
    │ ① 근로자 등록 입력
    │    (이름·국적·현장·공종·생년월일·전화뒷4자리·안전교육여부)
    ▼
[SAFE-LINK 서버]
    │ ② 토큰 생성: HMAC-SHA256(key=SALT, birthday+phone_last4)[:24]
    │ ③ 하이정보 등록 API 호출 → 근로자 정보 + 토큰 전송
    │ ④ NFC 카드에 URL 기록: https://safe-link.co.kr/w/{token}
    ▼
[하이정보 DB]
    │  token ↔ 근로자 정보 저장
    ▼
[현장 — 근로자 NFC 카드 태그]
    │ ⑤ 스마트폰 브라우저 → https://safe-link.co.kr/w/{token}
    ▼
[SAFE-LINK /w/{token} 페이지]
    │ ⑥ 서버사이드 프록시 호출
    │    GET https://api.hi-info.co.kr/safelink/v1/worker/{token}
    │    X-API-Key: {발급된 키}
    ▼
[하이정보 API]
    │ ⑦ 토큰 조회 → 근로자 정보 반환 (이름·국적·현장·공종·안전교육)
    ▼
[SAFE-LINK 화면에 근로자 정보 표시]
```

---

## 3. API 스펙 — 하이정보 제공 API (서원토건 → 하이정보 호출)

### 3.1 근로자 조회 API

```
GET https://api.hi-info.co.kr/safelink/v1/worker/{token}
X-API-Key: {발급된 키}
Accept: application/json
```

**Path Parameter**

| 이름 | 형식 | 길이 | 예시 |
|------|------|------|------|
| `token` | hex string | 24자 | `e7a3f9c2b1d4e85f12345678` |

**성공 응답 (HTTP 200)**

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

**응답 필드 정의**

| 필드 | 타입 | 필수 | 설명 |
|------|------|:----:|------|
| `status` | string | ✅ | `success` / `not_found` / `duplicate` / `error` |
| `data.worker_id` | string | ✅ | 내부 일련번호 |
| `data.name` | string | ✅ | 표시명 (실명 또는 통명) |
| `data.nationality` | string(2) | ✅ | ISO 3166-1 alpha-2 |
| `data.language` | string(2) | ✅ | ISO 639-1 |
| `data.site_id` | string | ✅ | 현장코드 (§7 목록 참조) |
| `data.role` | string | ✅ | `worker` / `manager` |
| `data.trade` | string | ❌ | 직종 (근로자만 해당) |
| `data.safety_cert_valid` | boolean | ✅ | 안전교육 이수 여부 |
| `timestamp` | string | ✅ | ISO 8601 (KST) |

> **응답에서 절대 제외**: 생년월일, 휴대폰번호, 주소, 외국인등록번호 (개인정보보호법 최소수집 원칙)

**실패 응답**

| 상황 | HTTP | `status` | `error_code` |
|------|------|----------|--------------|
| 미등록 토큰 | 404 | `not_found` | E001 |
| 토큰 중복 | 409 | `duplicate` | E002 |
| 토큰 형식 오류 (24자 hex 아님) | 422 | `error` | E003 |
| API Key 무효 | 401 | `error` | E401 |
| Rate Limit 초과 | 429 | `error` | E429 |
| 서버 내부 오류 | 500 | `error` | E500 |

```json
// 404 예시
{
  "status": "not_found",
  "error_code": "E001",
  "message": "Worker token not found",
  "timestamp": "2026-05-20T09:00:00+09:00"
}
```

---

### 3.2 근로자 사전등록 API ← **[협의 요청]**

NFC 카드 발급 전, SAFE-LINK가 하이정보에 근로자 정보와 토큰을 등록합니다.

> **협의 필요**: 하이정보 측에서 아래 스펙 수용 가능 여부 및 엔드포인트 경로 확인 요청드립니다.

**서원토건 제안 스펙**

```
POST https://api.hi-info.co.kr/safelink/v1/worker
X-API-Key: {발급된 키}
Content-Type: application/json
```

```json
{
  "token": "e7a3f9c2b1d4e85f12345678",
  "name": "Nguyen Van A",
  "nationality": "VN",
  "language": "vi",
  "site_id": "CJ-CENTUM",
  "role": "worker",
  "trade": "형틀",
  "safety_cert_valid": true
}
```

> **중요**: 생년월일·휴대폰번호는 전송하지 않습니다. 토큰만 전달합니다.

**기대 응답 (HTTP 201)**

```json
{
  "status": "created",
  "worker_id": "SW-CJ-000123",
  "token": "e7a3f9c2b1d4e85f12345678",
  "timestamp": "2026-05-20T09:00:00+09:00"
}
```

---

### 3.3 근로자 정보 수정 API ← **[협의 요청]**

현장 이동, 안전교육 갱신, 공종 변경 등을 반영합니다.

```
PATCH https://api.hi-info.co.kr/safelink/v1/worker/{token}
X-API-Key: {발급된 키}
Content-Type: application/json
```

```json
{
  "site_id": "GC-GTOWN",
  "safety_cert_valid": true,
  "trade": "철근"
}
```

---

### 3.4 토큰 무효화 API ← **[협의 요청]**

NFC 카드 분실 시 즉시 무효화하여 부정 사용 차단.

```
DELETE https://api.hi-info.co.kr/safelink/v1/worker/{token}
X-API-Key: {발급된 키}
```

**기대 응답 (HTTP 200)**

```json
{
  "status": "invalidated",
  "token": "e7a3f9c2b1d4e85f12345678",
  "timestamp": "2026-05-20T09:00:00+09:00"
}
```

무효화 이후 해당 토큰 조회 시 → HTTP 404 (E001) 반환.

---

## 4. 해시 토큰 생성 알고리즘

```
원본: YYYYMMDD + phone_last4  (12자리)
      예: "198703151234"
              ↓
      HMAC-SHA256(key=SALT, message=원본)
              ↓
해시: 64자리 hex string
              ↓
토큰: 앞 24자리 추출 (96-bit 보안)
      예: "e7a3f9c2b1d4e85f12345678"
```

> SALT는 서원토건이 보관하는 환경변수입니다. 토큰 검증이 필요한 경우 사전 협의 후 별도 채널로 공유합니다.

**Python 구현 예시**

```python
import hmac, hashlib, os

def generate_worker_token(birthday: str, phone_last4: str) -> str:
    salt = os.environ["SAFE_LINK_HASH_SALT"]
    raw = f"{birthday}{phone_last4}".encode("utf-8")
    digest = hmac.new(salt.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    return digest[:24]
```

---

## 5. NFC 카드 기록 형식

```
NFC 칩 규격:  NTAG213 (총 180바이트 / NDEF 가용 137바이트)
저장 URL:     https://safe-link.co.kr/w/{token}
저장 예시:    https://safe-link.co.kr/w/e7a3f9c2b1d4e85f12345678
URL 용량:     약 54바이트 (NDEF 여유: 83바이트)
라우트 상태:  SAFE-LINK v2.0 /w/[token] 구현 완료 (2026-05-20)
```

---

## 6. 환경 및 SLA

### 6.1 환경 구성 ← **[협의 요청]**

| 구분 | URL | 용도 |
|------|-----|------|
| **Sandbox** | `https://api-sandbox.hi-info.co.kr/safelink/v1/` | 개발·테스트 |
| **Production** | `https://api.hi-info.co.kr/safelink/v1/` | 실 현장 |

> 샌드박스 환경 제공 가능 여부 및 URL 확인 요청드립니다.

### 6.2 SLA 요구사항

| 항목 | 기준 |
|------|------|
| 응답 시간 | **200ms 이내** (P95) |
| 가용성 | **99.5% 이상** (월간) |
| Rate Limit | 분당 60 req/현장 권장 |
| 장애 시 | 서원토건에 즉시 알림 + 복구 예상 시간 통보 |

---

## 7. 보안 요구사항

- [x] HTTPS 강제 (HTTP 차단)
- [x] API Key 헤더 인증 (`X-API-Key`) — 서원토건→하이정보 단방향
- [x] Rate Limiting (분당 60req/현장)
- [x] Salt·API Key 환경변수 관리, 코드 하드코딩 금지
- [x] 응답에 생년월일·휴대폰번호 포함 금지
- [x] DB 원본 식별자 AES-256-GCM 암호화 (서원토건 측)
- [x] 접근 로그 90일 이상 보관 (양측)
- [x] NFC 카드 분실 시 토큰 즉시 무효화 API 필수

---

## 8. 현장코드 목록 (30개소)

| 번호 | 현장명 | site_id |
|------|--------|---------|
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

## 9. 리스크 및 대응

| 리스크 | 대응 |
|--------|------|
| Salt 유출 | 환경변수 관리, 키 로테이션 정책 수립 |
| 동일 토큰 충돌 | DB UNIQUE 제약 + 등록 시 중복 검증. 24자(96-bit)로 충돌 확률 ≈ 0 |
| NFC 카드 분실 | 토큰 무효화 API 즉시 호출 + 새 카드 재발급 |
| 하이정보 API 장애 | SAFE-LINK 자체 캐시(TTL 5분) + 장애 시 수동 확인 절차 |
| 외국인 근로자 동의 미수령 | SAFE-LINK 다국어 번역엔진으로 동의서 자동 생성 |

---

## 10. 하이정보 측 확인 요청 사항

아래 항목에 대한 회신 부탁드립니다.

| 번호 | 항목 | 내용 |
|------|------|------|
| Q1 | **API Key 발급** | 발급 일정 및 전달 방법 |
| Q2 | **Sandbox 환경** | 제공 가능 여부 및 URL |
| Q3 | **근로자 등록 API** | §3.2 스펙 수용 가능 여부, 또는 대안 방식 |
| Q4 | **수정 API** | §3.3 스펙 수용 가능 여부 |
| Q5 | **무효화 API** | §3.4 스펙 수용 가능 여부 |
| Q6 | **SLA** | 응답시간 200ms·가용성 99.5% 보장 가능 여부 |
| Q7 | **기존 데이터** | 현재 하이정보 DB의 근로자 정보 현황 및 이관 방법 |
| Q8 | **배치 등록** | 다수 근로자 일괄 등록 API 지원 여부 |

---

## 11. 문의

**서원토건 미래전략TF**  
담당: 김무빈 차장  
이메일: visionlab@seowonenc.co.kr

---

> **핵심 요약**: 평문 노출 0건 | 응답 필드 8개 | NFC 토큰 24자리 hex | DB AES-256-GCM | `/w/{token}` 라우트 구현 완료
