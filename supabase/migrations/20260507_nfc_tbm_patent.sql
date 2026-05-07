-- ============================================================================
-- SAFE-LINK V2.0 — NFC TBM 참석 인증 시스템 (특허 Claim 1-5)
-- 2026-05-07 최초 작성. 멱등성 보장 (IF NOT EXISTS).
--
-- 개념: NFC 탭 1회 = TBM 참석 확인 (출퇴근 아님 — 홍채인식이 담당)
-- 설계 원칙:
--   1. 스티커 URL에 worker_id + HMAC 서명만 노출. PII는 DB에만.
--   2. 관리자만 세션 개설 + 근로자 정보 조회.
--   3. 탭 1회 = 참석. 중복 탭 = 멱등 (무시).
--   4. PIPA 제15조: 수집 최소화. consent 추적 의무.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. nfc_workers — 근로자 마스터 (PIPA 준수, 스티커 발급 대상)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nfc_workers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_code       TEXT UNIQUE,                      -- WRK-YYMMDD-XXXX (트리거 자동 부여)
  full_name         TEXT NOT NULL,
  nationality       TEXT NOT NULL,                    -- ISO 3166-1 alpha-2: KR, VN, TH, UZ ...
  phone             TEXT,                             -- E.164 (+821012345678) — 관리자만 조회
  assigned_site_id  TEXT,
  trade             TEXT,                             -- 공종: rebar, formwork, concrete ...
  preferred_lang    TEXT NOT NULL DEFAULT 'en',
  is_active         BOOLEAN DEFAULT true,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consent_signed_at TIMESTAMPTZ,                      -- PIPA § 15(4) 수집 동의 서명 시각
  consent_doc_url   TEXT,                             -- 동의서 스캔 PDF (Supabase Storage)
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfc_workers_code   ON public.nfc_workers(worker_code);
CREATE INDEX IF NOT EXISTS idx_nfc_workers_site   ON public.nfc_workers(assigned_site_id);
CREATE INDEX IF NOT EXISTS idx_nfc_workers_active ON public.nfc_workers(is_active) WHERE is_active = true;

-- ----------------------------------------------------------------------------
-- B. nfc_worker_stickers — 스티커 발급 이력 (HMAC 서명 버전 관리)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nfc_worker_stickers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id        UUID NOT NULL REFERENCES public.nfc_workers(id) ON DELETE CASCADE,
  sig_version      INT  NOT NULL DEFAULT 1,
  issued_epoch     BIGINT NOT NULL,                   -- HMAC 서명에 바인딩된 UNIX 초
  issued_at        TIMESTAMPTZ DEFAULT NOW(),
  issued_by        UUID REFERENCES auth.users(id),
  is_active        BOOLEAN DEFAULT true,              -- false = 폐기된 스티커
  revoked_at       TIMESTAMPTZ,
  revoked_by       UUID REFERENCES auth.users(id),
  revoke_reason    TEXT,
  written_to_tag_uid TEXT,                            -- NFC 태그 UID (감사용)
  UNIQUE (worker_id, sig_version)
);

CREATE INDEX IF NOT EXISTS idx_nfc_stickers_worker ON public.nfc_worker_stickers(worker_id);
CREATE INDEX IF NOT EXISTS idx_nfc_stickers_active ON public.nfc_worker_stickers(is_active) WHERE is_active = true;

-- ----------------------------------------------------------------------------
-- C. nfc_tbm_sessions — TBM 라이브 세션
--    status: open → running → closed
--    (V2.5의 check_in/check_out phase 제거 — 탭 1회만으로 참석 인증)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nfc_tbm_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id        TEXT NOT NULL,
  tbm_notice_id  UUID REFERENCES public.tbm_notices(id) ON DELETE SET NULL,
  title          TEXT,
  status         TEXT NOT NULL DEFAULT 'open',        -- open | running | closed
  started_at     TIMESTAMPTZ DEFAULT NOW(),
  ended_at       TIMESTAMPTZ,
  started_by     UUID REFERENCES auth.users(id),
  ended_by       UUID REFERENCES auth.users(id),
  metadata       JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT chk_nfc_session_status CHECK (status IN ('open', 'running', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_nfc_tbm_sessions_site   ON public.nfc_tbm_sessions(site_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tbm_sessions_status ON public.nfc_tbm_sessions(status);
CREATE INDEX IF NOT EXISTS idx_nfc_tbm_sessions_date   ON public.nfc_tbm_sessions(started_at DESC);

-- ----------------------------------------------------------------------------
-- D. nfc_tbm_attendance — TBM 참석 기록 (탭 1회 = 참석 확인)
--    UNIQUE(session_id, worker_id) → 중복 탭은 멱등 처리
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nfc_tbm_attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.nfc_tbm_sessions(id) ON DELETE CASCADE,
  worker_id   UUID NOT NULL REFERENCES public.nfc_workers(id) ON DELETE CASCADE,
  sticker_id  UUID REFERENCES public.nfc_worker_stickers(id),
  tapped_at   TIMESTAMPTZ DEFAULT NOW(),              -- 참석 확인 시각 (단일 탭)
  tapped_by   UUID REFERENCES auth.users(id),         -- 스캔한 관리자
  lang_used   TEXT,
  notes       TEXT,
  UNIQUE (session_id, worker_id)                      -- 세션당 1인 1회만
);

CREATE INDEX IF NOT EXISTS idx_nfc_att_session ON public.nfc_tbm_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_nfc_att_worker  ON public.nfc_tbm_attendance(worker_id);

-- ----------------------------------------------------------------------------
-- E. RLS — 모든 NFC 테이블: 관리자 전용
-- ----------------------------------------------------------------------------
ALTER TABLE public.nfc_workers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_worker_stickers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_tbm_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_tbm_attendance   ENABLE ROW LEVEL SECURITY;

-- 관리자 판정 함수 (profiles.role 기반)
CREATE OR REPLACE FUNCTION public.is_safelink_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('ROOT', 'SUPER_ADMIN', 'HQ_ADMIN', 'HQ_OFFICER', 'SAFETY_OFFICER')
  );
$$;

-- nfc_workers
CREATE POLICY "Admins read nfc_workers"   ON public.nfc_workers
  FOR SELECT USING (public.is_safelink_admin());
CREATE POLICY "Admins insert nfc_workers" ON public.nfc_workers
  FOR INSERT WITH CHECK (public.is_safelink_admin());
CREATE POLICY "Admins update nfc_workers" ON public.nfc_workers
  FOR UPDATE USING (public.is_safelink_admin()) WITH CHECK (public.is_safelink_admin());

-- nfc_worker_stickers
CREATE POLICY "Admins manage stickers" ON public.nfc_worker_stickers
  FOR ALL USING (public.is_safelink_admin()) WITH CHECK (public.is_safelink_admin());

-- nfc_tbm_sessions
CREATE POLICY "Admins manage tbm sessions" ON public.nfc_tbm_sessions
  FOR ALL USING (public.is_safelink_admin()) WITH CHECK (public.is_safelink_admin());

-- nfc_tbm_attendance
CREATE POLICY "Admins manage attendance" ON public.nfc_tbm_attendance
  FOR ALL USING (public.is_safelink_admin()) WITH CHECK (public.is_safelink_admin());

-- ----------------------------------------------------------------------------
-- F. worker_code 자동 발급 트리거 (WRK-YYMMDD-XXXX)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_generate_worker_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  prefix    TEXT := 'WRK-' || to_char(NOW() AT TIME ZONE 'Asia/Seoul', 'YYMMDD') || '-';
  new_code  TEXT;
  attempt   INT := 0;
BEGIN
  LOOP
    new_code := prefix || lpad((floor(random() * 9999))::INT::TEXT, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.nfc_workers WHERE worker_code = new_code);
    attempt := attempt + 1;
    IF attempt > 20 THEN
      new_code := prefix || substr(gen_random_uuid()::TEXT, 1, 6);
      EXIT;
    END IF;
  END LOOP;
  RETURN new_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_set_worker_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.worker_code IS NULL OR NEW.worker_code = '' THEN
    NEW.worker_code := public.fn_generate_worker_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nfc_workers_worker_code ON public.nfc_workers;
CREATE TRIGGER trg_nfc_workers_worker_code
  BEFORE INSERT ON public.nfc_workers
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_worker_code();

-- ----------------------------------------------------------------------------
-- 완료
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.nfc_workers IS
  'SAFE-LINK NFC 특허: 근로자 마스터. PIPA 동의 추적, 스티커 발급 대상.';
COMMENT ON TABLE public.nfc_worker_stickers IS
  'SAFE-LINK NFC 특허: 스티커 발급 이력. sig_version 재발급으로 구버전 자동 폐기.';
COMMENT ON TABLE public.nfc_tbm_sessions IS
  'SAFE-LINK NFC 특허: TBM 라이브 세션. 탭 수집 컨텍스트.';
COMMENT ON TABLE public.nfc_tbm_attendance IS
  'SAFE-LINK NFC 특허: TBM 참석 기록. 탭 1회 = 참석 인증. 출퇴근 아님.';
