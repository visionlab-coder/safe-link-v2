-- ============================================================================
-- Red Team Fix: tbm_quiz_responses 동시 발송 중복행 방지
-- Date: 2026-05-22
-- Issue: POST /api/quiz/send 동시 호출 시 (quiz_session_id, worker_id) 중복 INSERT 가능
-- Fix: UNIQUE 제약 추가 — DB 레벨에서 마지막 방어선 확보
-- ============================================================================

-- 기존 중복 행 제거 (가장 오래된 행만 남김)
DELETE FROM public.tbm_quiz_responses
WHERE id NOT IN (
  SELECT MIN(id)
  FROM public.tbm_quiz_responses
  GROUP BY quiz_session_id, worker_id
);

-- UNIQUE 제약 추가 (이미 존재하면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tbm_quiz_responses_session_worker_unique'
      AND conrelid = 'public.tbm_quiz_responses'::regclass
  ) THEN
    ALTER TABLE public.tbm_quiz_responses
      ADD CONSTRAINT tbm_quiz_responses_session_worker_unique
      UNIQUE (quiz_session_id, worker_id);
  END IF;
END$$;
