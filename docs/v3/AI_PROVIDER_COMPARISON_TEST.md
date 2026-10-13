# STT·번역 공급자 비교 테스트 설정

2026-10-13 사용자 요청으로 Flitto 호출 코드를 제거하고 DeepL Voice/Text 연동을 구현했다. **운영 전환은 아직 하지 않았다.** 키는 백엔드 실행 환경에만 보관한다.

```env
# 신규 기본값. 기존 서버의 명시적 flitto 설정도 아래처럼 변경해야 한다.
SAFE_LINK_TRANSLATION_PROVIDER=deepl
SAFE_LINK_STT_PROVIDER=deepl

# 공급자별 인증 정보는 동시에 보관한다. 실제 값은 저장소에 커밋하지 않는다.
GOOGLE_CLOUD_API_KEY=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
OPENAI_API_KEY=
DEEPL_API_KEY=
DEEPL_API_BASE_URL=https://api.deepl.com
```

## 주간 전환 예시

| 기간 | `SAFE_LINK_STT_PROVIDER` | `SAFE_LINK_TRANSLATION_PROVIDER` | TTS |
| --- | --- | --- | --- |
| 기존 기준 주간 | `auto` | `auto` | 기존 Google/OpenAI TTS 유지 |
| DeepL 주간 | `deepl` | `deepl` | 기존 Google/OpenAI TTS 유지 |

환경변수 변경 뒤에는 백엔드를 재시작하거나 운영 배포를 다시 해야 한다. 프론트엔드 `.env.local` 또는 `NEXT_PUBLIC_*`에 키를 넣지 않는다.

## 적용 및 복귀 절차

1. 기존 운영 release와 환경변수를 보호된 위치에 백업한다. 운영 키는 출력하지 않는다.
2. 백엔드 환경의 `DEEPL_API_KEY`를 설정하고 Translate 및 Voice 권한을 확인한다. 새 키는 GitHub 저장소/프런트 빌드 환경에 넣지 않는다. 채팅에 공유된 키는 운영 적용 전 재발급 권장.
3. 프런트/백엔드 동시 배포 시 위 공급자 2개를 `deepl`로 변경한다. 코드 변경만으로 기존 환경의 `flitto` 값이 바뀌지 않는다. 기존 엔진을 중간에 끄지 말고 새 release 활성화와 함께 전환한다.
4. `/root`에서 과거 번역 엔진 강제 선택이 있다면 ‘서버 설정 사용’ 또는 ‘DeepL’로 변경한다. 기존 선택값이 남아 있으면 프런트 번역이 다른 공급자를 사용할 수 있다.
5. `/api/v1/ai/status`의 `translationProvider`, `sttProvider`, `deeplConfigured`와 실제 응답의 `engine/vendor`를 함께 확인한다. 상태 표시만으로 실제 API 성공을 단정하지 않는다.
6. TBM 한국어/영어, 1:1 한국어/중국어, 일반 라이브, 크메르 보조 경로 및 용어집을 실제 기기에서 확인한다. 이전 JS가 남아 있으면 새로고침한다.
7. 문제 발생 시 이전 release와 해당 환경 설정을 함께 복원한다. 새 코드에 `flitto`만 재입력해 복귀할 수는 없다. `auto`/`google`/`openai` 경로는 유지하되 비교 시험에서 어떤 공급자인지 기록한다.

## 지원 범위 및 예외

- 텍스트: 앱 20개 언어 중 크메르어를 제외한 19개 언어는 DeepL. 크메르어 입/출력은 Google.
- 음성: 크메르·우즈베크·몽골·미얀마·네팔·카자흐 6개 언어는 Google. 나머지 앱 언어는 DeepL Voice.
- 읽기(TTS), 요약, 발음 표기용 보조 모델은 기존 방식 유지. DeepL이 모든 AI 기능을 대체하는 것은 아니다.
- DeepL 오류 시 몰래 다른 공급자로 재시도하지 않는다. 미지원 언어의 Google 경로는 명시된 예외이며 응답도 `google`로 표시한다.
- 음성 입력은 16kHz PCM16 mono, 최대 30초/요청. 기존 청크 방식에서 서버가 DeepL로 200ms씩 최대 2배 속도로 전송한다. 프런트 요청 제한 45초. 언어는 선택값으로 고정, 확정(concluded) 원문만 사용한다. 잠정(tentative) 텍스트를 최종 기록으로 저장하지 않는다.
- 용어집 정규화는 인식 뒤 번역 전에 유지한다. DeepL Spoken Terms 컬렉션의 별도 등록/음성인식 힌트 연동은 이번 교체에 포함하지 않는다.

## 검증

- `node tests/deepl-routing.cjs`: 기본/명시적 DeepL, high quality 경로의 재번역 방지, 역번역, 용어집, 크메르 공급자 표시, 장애 시 폴백 금지, 인증 계약(공급자 모의 응답).
- `DeepLClientTest`, `DeepLTranslationCacheTest`: 공식 요청 형식, 언어 별칭, 선택 언어 고정, 확정 구간만 합산, 세션 종료/오류, URL·비밀값 보호, 용량 제한, Google PCM fallback, 공급자/현장별 캐시 격리.
- `DeepLLiveSmokeTest`: 명시적 `SAFE_LINK_DEEPL_LIVE_TEST=true` + 메모리 환경의 키/합성 WAV 경로가 있을 때만 외부 호출. 기본 CI에서는 실행하지 않는다. 개인정보가 든 실제 녹음은 사용하지 않는다.
- 실제 API 검증 결과: 19개 언어 텍스트 응답 성공. 합성 한국어 ‘작업 전에 안전모를 반드시 착용하세요.’, 영어 ‘Please wear a safety helmet before starting work.’, 중국어 ‘开始工作前请戴好安全帽’ 음성 인식 성공. 이는 현장 소음/사투리/전체 언어 정확도 보증이 아니다.
- 프런트 운영 빌드·TypeScript·ESLint 및 backend bootJar 성공. 전체 backend test는 Docker 미실행으로 `NationwideTbmDatabaseTest` 초기화 실패, DB 의존 테스트 일부 미실행. 운영 DB에는 접속/변경하지 않았다.
- AI 패키지 한정 회귀 테스트 36건 성공, 외부 호출 opt-in 2건은 일반 실행에서 건너뜀. TBM 언어·라이브 회귀 테스트 13건 성공. 외부 호출 2건은 위 별도 수동 실행으로 확인했다.

공식 근거: [Text API](https://developers.deepl.com/api-reference/translate/request-translation), [Voice session](https://developers.deepl.com/api-reference/voice/request-session), [Voice protocol](https://developers.deepl.com/api-reference/voice/websocket-streaming), [언어 목록 API](https://developers.deepl.com/docs/languages/using-the-languages-api).
