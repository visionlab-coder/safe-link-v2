# STT·번역 공급자 비교 테스트 설정

플리토·DeepL·기존 엔진을 비교할 때 키를 교체하거나 프론트엔드에 노출하지 않는다. 모든 키는 백엔드 실행 환경에만 보관하고, 아래 선택값만 변경한다.

```env
# 기존 기준값. auto는 번역 Papago→Google, STT는 기존 Google/OpenAI 규칙을 사용한다.
SAFE_LINK_TRANSLATION_PROVIDER=auto
SAFE_LINK_STT_PROVIDER=auto

# 공급자별 인증 정보는 동시에 보관한다. 실제 값은 저장소에 커밋하지 않는다.
GOOGLE_CLOUD_API_KEY=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
OPENAI_API_KEY=
FLITTO_API_KEY=
FLITTO_API_BASE_URL=
DEEPL_API_KEY=
DEEPL_API_BASE_URL=https://api.deepl.com
```

## 주간 전환 예시

| 기간 | `SAFE_LINK_STT_PROVIDER` | `SAFE_LINK_TRANSLATION_PROVIDER` | TTS |
| --- | --- | --- | --- |
| 기존 기준 주간 | `auto` | `auto` | 기존 Google/OpenAI TTS 유지 |
| 플리토 주간 | `flitto` | `flitto` | 기존 Google/OpenAI TTS 유지 |
| DeepL 주간 | `deepl` | `deepl` | 기존 Google/OpenAI TTS 유지 |

환경변수 변경 뒤에는 백엔드를 재시작하거나 운영 배포를 다시 해야 한다. 프론트엔드 `.env.local` 또는 `NEXT_PUBLIC_*`에 키를 넣지 않는다.

## 도입 전 확인 사항

- 플리토: 번역 및 STT API의 인증 방식, base URL, 지원 언어, 호출·용량 한도
- DeepL: Translate API뿐 아니라 Voice API(STT) 사용 권한, WebSocket/REST 규격, 지원 언어, 동시 세션 한도
- 두 공급자 모두: 테스트 키, 운영 키 분리 여부, 개인정보·음성 데이터 처리 조건

현재 선택기는 기존 `auto`·`papago`·`google`·`openai`를 실제 전환한다. `flitto`·`deepl`은 API 규격과 사용 권한이 확정되기 전까지 명시적 오류로 멈춘다. 다른 엔진으로 조용히 폴백하지 않으므로 테스트 결과가 섞이지 않는다.
