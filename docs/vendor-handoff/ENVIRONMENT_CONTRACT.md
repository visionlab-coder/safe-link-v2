# SAFE-LINK V2 환경변수 전달 계약

## 원칙

- 전체 변수 목록의 기준은 `config/env-contract.json`이다.
- 저장소와 이메일 ZIP에는 변수명과 용도만 포함하고 실제 값은 포함하지 않는다.
- `NEXT_PUBLIC_*`와 Supabase anon key만 브라우저 공개가 허용된다.
- service-role, AI 키, 서명키, AES 키, Redis token은 서버 비밀 저장소에만 둔다.
- Vercel과 Cloudflare가 같은 Redis를 공유하면 `SAFE_LINK_AES_KEY`도 같아야 한다.

## 필수 인수 그룹

| 그룹 | 핵심 변수 | 전달 주체 | 전달 방법 |
|---|---|---|---|
| Supabase 공개 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 서원토건 | 환경 설정 |
| Supabase 서버 | `SUPABASE_SERVICE_ROLE_KEY` | 서원토건 | 별도 보안 채널 |
| 관리자 권한 | `MASTER_EMAILS`, `HQ_OFFICER_EMAILS`, `DEVELOPER_EMAILS` | 서원토건 | 별도 보안 채널 |
| 암호화·무결성 | `SAFE_LINK_AES_KEY`, `SAFE_LINK_HASH_SALT` | 서원토건 | 별도 보안 채널 |
| 캐시 | Upstash URL·token | 계정 소유자 | 별도 보안 채널 |
| 모바일 | 허용 origin·공개 URL | 범소프트웨어 합의 | 환경별 설정 |
| AI·번역 | Google, OpenAI, Naver, Flitto | 계정 소유자 | 별도 보안 채널 |
| NFC | HMAC·sticker secret | 서원토건 | 별도 보안 채널 |

## 환경 분리

- development: 개발자 개인 키와 로컬 URL. 운영 데이터 사용 금지.
- staging: 범소프트웨어 통합시험 전용 계정·DB·도메인 권장.
- production: 승인된 운영 계정과 회전된 키만 사용.
- Preview: 공개 PoC 설정으로 빌드 가능하지만 쓰기 시험은 staging에서 수행한다.

## 수령 검증

1. 범소프트웨어가 변수명 48개를 수령했는지 확인한다.
2. 값은 이메일 회신이나 소스 저장소에 다시 올리지 않는다.
3. Vercel·Cloudflare·네이티브 백엔드별 적용표를 작성한다.
4. `/api/version`, 로그인, TBM, 통역, 채팅 smoke 후 누락을 판정한다.
5. 인수 완료 후 공유 키는 합의된 일정에 맞춰 회전한다.
