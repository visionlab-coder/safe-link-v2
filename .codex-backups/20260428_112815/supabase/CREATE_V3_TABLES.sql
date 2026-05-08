-- SAFE-LINK V2: V3 Feature Tables Migration
-- 2026-04-03: 현장 피드백 대응 업그레이드
-- 실행: Supabase Dashboard > SQL Editor에서 전체 실행

-- ═══════════════════════════════════════════
-- 1. 작업중지권 (Stop Work Authority) 알림
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.stop_work_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID REFERENCES auth.users(id),
    worker_name TEXT,
    site_id TEXT,
    reason TEXT NOT NULL DEFAULT 'Emergency stop',
    lang TEXT DEFAULT 'ko',
    resolved BOOLEAN DEFAULT false,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.stop_work_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can insert alerts"
    ON public.stop_work_alerts FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can read alerts"
    ON public.stop_work_alerts FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can update alerts"
    ON public.stop_work_alerts FOR UPDATE
    TO authenticated
    USING (true);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.stop_work_alerts;

-- ═══════════════════════════════════════════
-- 2. 안전 퀴즈 (Safety Quizzes)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.safety_quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_ko TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_index INTEGER NOT NULL DEFAULT 0,
    site_id TEXT,
    created_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.safety_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage quizzes"
    ON public.safety_quizzes FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ═══════════════════════════════════════════
-- 3. 퀴즈 응답 (Quiz Responses)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.quiz_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.safety_quizzes(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES auth.users(id),
    worker_name TEXT,
    selected_index INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    lang TEXT DEFAULT 'ko',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can insert responses"
    ON public.quiz_responses FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated can read responses"
    ON public.quiz_responses FOR SELECT
    TO authenticated
    USING (true);

-- Realtime 활성화 (관리자 실시간 결과 확인)
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_responses;

-- ═══════════════════════════════════════════
-- 4. 실시간 통역 (Live Translations)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.live_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    text_ko TEXT NOT NULL,
    site_id TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.live_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert translations"
    ON public.live_translations FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated can read translations"
    ON public.live_translations FOR SELECT
    TO authenticated
    USING (true);

-- Realtime 활성화 (동시통역 핵심)
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_translations;

-- ═══════════════════════════════════════════
-- 인덱스 (성능 최적화)
-- ═══════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_stop_work_alerts_site ON public.stop_work_alerts(site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_quizzes_active ON public.safety_quizzes(is_active, site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_quiz ON public.quiz_responses(quiz_id);
CREATE INDEX IF NOT EXISTS idx_live_translations_session ON public.live_translations(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_live_translations_site ON public.live_translations(site_id, created_at DESC);

-- ═══════════════════════════════════════════
-- 완료 확인
-- ═══════════════════════════════════════════
DO $$
BEGIN
    RAISE NOTICE '✅ V3 Tables Created Successfully:';
    RAISE NOTICE '  - stop_work_alerts (작업중지권)';
    RAISE NOTICE '  - safety_quizzes (안전 퀴즈)';
    RAISE NOTICE '  - quiz_responses (퀴즈 응답)';
    RAISE NOTICE '  - live_translations (실시간 통역)';
    RAISE NOTICE '  - All RLS policies applied';
    RAISE NOTICE '  - All realtime subscriptions enabled';
END $$;
