/**
 * ⚠️ 통역/번역/STT 품질 임계값 — 현장 검증 기반, 임의 변경 금지
 *
 * 이 파일의 모든 값은 실제 건설현장(다국어 환경, 소음 80dB+) 테스트를 통해
 * 결정된 최적값입니다. 코드 최적화 목적으로 임의 변경하면 품질이 급격히 저하됩니다.
 *
 * ── 변경하고 싶다면 ──────────────────────────────────────────────────
 * 1. 변경 사유를 아래 CHANGE LOG에 반드시 기록
 * 2. 실제 현장 테스트 후 수치 검증
 * 3. 원복 가능하도록 이전 값을 주석으로 보존
 * ────────────────────────────────────────────────────────────────────
 *
 * ── 품질 저하 사례 (교훈) ────────────────────────────────────────────
 * [2026-04-17] WHISPER_TIMEOUT_MS: 15000 → 3000 변경
 *   - 변경 사유: OpenAI 429 에러 시 빠른 Google 폴백
 *   - 문제: Whisper 실제 응답시간 4~6초인데 3초로 abort → Whisper 항상 실패
 *   - 결과: 모든 STT가 Google로 폴백, 현장 인식률 급락, 품질 불만 폭주
 *   - 복원: 8000ms (2026-05-13)
 *   - 교훈: 429 에러는 이미 res.ok 체크에서 즉시 null 반환됨.
 *           timeout은 네트워크 hang용이므로 응답시간보다 충분히 길어야 함.
 * ────────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════
// STT (음성인식)
// ═══════════════════════════════════════════════════════════════

/**
 * Whisper API 타임아웃 (ms)
 * Whisper 평균 응답시간: 4~6초 (음성 길이·서버 부하에 따라 변동)
 * ⚠️ 6초 미만으로 설정하면 정상 요청도 abort됨 → Google 폴백으로 품질 저하
 * ⚠️ 429 에러는 타임아웃과 무관하게 res.ok 체크에서 즉시 처리됨 (타임아웃 단축 불필요)
 */
export const WHISPER_TIMEOUT_MS = 8_000;

/**
 * Google STT 타임아웃 (ms)
 * default 모델: 200~800ms, latest_long 모델: 1~3s
 * ⚠️ latest_long enhanced 모델을 항상 사용하므로 5초로 확보
 */
export const GOOGLE_STT_TIMEOUT_MS = 5_000;

/**
 * Gemini STT 교정 타임아웃 (ms) — 한국어 건설현장 용어 보정
 * live/non-live 모두 적용. gemini-2.5-flash 기준 실제 응답 500ms~1.5s.
 */
export const GEMINI_STT_CORRECTION_TIMEOUT_MS = 3_000;

/**
 * 일반 STT 신뢰도 하한 (non-live 모드)
 * 이 값 이하의 결과는 소음/불명확 발화로 폐기.
 * ⚠️ 0.5 미만: 소음 오인식 과다 수락 / 0.75 초과: 유효 발화 과다 폐기
 */
export const STT_MIN_CONFIDENCE = 0.6;

/**
 * 라이브(TBM방송·Travel Talk) STT 신뢰도 하한
 * 다국어 혼재 환경에서 0.75는 너무 엄격해 유효 발화 폐기됨 → 0.65로 완화.
 * ⚠️ 0.6 미만: 다른 국적 발화 오수락 위험 / 0.75 초과: 유효 발화 절반 이상 폐기
 */
export const STT_MIN_CONFIDENCE_LIVE = 0.65;

/**
 * Gemini STT 교정 생략 신뢰도 — Google STT 평균 신뢰도가 이 이상이면 Gemini 교정 건너뜀
 * 명확한 발화(≥0.92)는 오인식 가능성이 낮아 Gemini 교정 불필요 → 1~3s 절약
 * ⚠️ 0.95 초과: 소음 환경에서 교정 너무 자주 생략 / 0.90 미만: 교정 효과 감소 미미
 */
export const STT_HIGH_CONFIDENCE_SKIP_GEMINI = 0.92;


// ═══════════════════════════════════════════════════════════════
// 번역 (Translation)
// ═══════════════════════════════════════════════════════════════

/**
 * Papago(네이버) 번역 타임아웃 (ms)
 * ⚠️ 타임아웃 없으면 네트워크 오류 시 무한 hang → 전체 통역 파이프라인 멈춤
 */
export const PAPAGO_TIMEOUT_MS = 5_000;

/**
 * Google Cloud Translation 타임아웃 (ms)
 */
export const GOOGLE_TRANSLATE_TIMEOUT_MS = 5_000;

/**
 * Gemini 건설현장 번역 타임아웃 (ms) — 비Papago 언어(uz/km/my/ne/bn/kk/ar/hi/mn/tl) 전용
 * Gemini는 Papago보다 느리므로 여유 있게 설정.
 */
export const GEMINI_TRANSLATE_TIMEOUT_MS = 8_000;

/**
 * Gemini 발음 생성 타임아웃 (ms) — 중국어·일본어·태국어·비라틴 언어
 */
export const GEMINI_PRONUNCIATION_TIMEOUT_MS = 7_000;


// ═══════════════════════════════════════════════════════════════
// CHANGE LOG — 이 아래에 변경 사유를 기록하세요
// ═══════════════════════════════════════════════════════════════
// 2026-05-13  WHISPER_TIMEOUT_MS 복원: 3000 → 8000 (Whisper 항상 실패 버그 수정)
// 2026-05-13  PAPAGO_TIMEOUT_MS 신설: 5000 (무한 hang 방지)
// 2026-05-13  GOOGLE_TRANSLATE_TIMEOUT_MS 신설: 5000 (일관된 타임아웃 정책)
// 2026-05-13  STT_MIN_CONFIDENCE_LIVE 완화: 0.75 → 0.65 (유효 발화 폐기 과다 문제)
// 2026-05-16  GOOGLE_STT_TIMEOUT_MS: 3000 → 5000 (latest_long 모델 응답시간 1~3s 대응)
// 2026-05-16  live 모드 STT: default→latest_long enhanced (건설현장 발화 인식률 개선)
// 2026-05-16  live 모드 STT: Gemini 교정 활성화 (non-live와 동일 품질 보정 적용)
// 2026-05-16  STT_HIGH_CONFIDENCE_SKIP_GEMINI 신설: 0.92 (명확 발화 Gemini 생략 → 1~3s 절약)
// 2026-05-16  TTS playProxyAudio: 순차 다운로드 → 전체 동시 prefetch (다음 청크 버퍼링 선행)
