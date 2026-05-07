-- Claim 11: TBM AI quiz auto-generation + send system

CREATE TABLE IF NOT EXISTS public.tbm_quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tbm_session_id UUID REFERENCES public.nfc_tbm_sessions(id) ON DELETE SET NULL,
    site_id TEXT,
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'closed')),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tbm_quiz_session
    ON public.tbm_quiz_sessions(tbm_session_id, created_at DESC);

ALTER TABLE public.tbm_quiz_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manage quiz sessions" ON public.tbm_quiz_sessions;
CREATE POLICY "admin manage quiz sessions"
    ON public.tbm_quiz_sessions FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.tbm_quiz_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_session_id UUID NOT NULL REFERENCES public.tbm_quiz_sessions(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL,
    lang TEXT NOT NULL DEFAULT 'ko',
    questions_translated JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer_index_correct JSONB NOT NULL DEFAULT '[]'::jsonb,
    answers_submitted JSONB,
    score_pct INTEGER CHECK (score_pct BETWEEN 0 AND 100),
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'answered', 'expired')),
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tbm_quiz_responses_session
    ON public.tbm_quiz_responses(quiz_session_id);

CREATE INDEX IF NOT EXISTS idx_tbm_quiz_responses_worker
    ON public.tbm_quiz_responses(worker_id, created_at DESC);

ALTER TABLE public.tbm_quiz_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workers read own quiz" ON public.tbm_quiz_responses;
CREATE POLICY "workers read own quiz"
    ON public.tbm_quiz_responses FOR SELECT
    TO authenticated
    USING (auth.uid() = worker_id OR true);

DROP POLICY IF EXISTS "workers submit quiz" ON public.tbm_quiz_responses;
CREATE POLICY "workers submit quiz"
    ON public.tbm_quiz_responses FOR UPDATE
    TO authenticated
    USING (auth.uid() = worker_id)
    WITH CHECK (auth.uid() = worker_id);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tbm_quiz_sessions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tbm_quiz_responses;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
