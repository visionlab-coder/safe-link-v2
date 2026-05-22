-- tbm_quiz_sessions에 source 컬럼 추가
-- "tbm" = TBM 발화 내용 기반 생성, "fallback" = 예시 안전 문제 풀 사용

ALTER TABLE public.tbm_quiz_sessions
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'tbm' CHECK (source IN ('tbm', 'fallback'));
