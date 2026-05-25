-- ============================================================================
-- Red Team Fix C-5 + C-6: messages RLS 활성화 + live_translations SELECT 범위 제한
-- Date: 2026-05-23
--
-- C-5: messages 테이블 RLS 미적용 — 인증된 모든 사용자가 전체 대화 열람 가능
--      수정: RLS 활성화 + from_user/to_user 기반 행 단위 접근 제어
--
-- C-6: live_translations SELECT USING(true) — 전체 현장 방송 내용 무제한 열람 가능
--      수정: 동일 현장(site_id) 또는 관리자(is_safelink_admin)만 조회 허용
-- ============================================================================

-- ── C-5: messages 테이블 RLS 활성화 및 정책 수립 ────────────────────────────

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 대화 당사자(발신·수신) 또는 관리자만 읽기 허용
-- HQ Audit API는 service_role로 동작하므로 RLS 우회 (영향 없음)
DROP POLICY IF EXISTS "messages_select_participants" ON public.messages;
CREATE POLICY "messages_select_participants"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    from_user = auth.uid()
    OR to_user = auth.uid()
    OR public.is_safelink_admin()
  );

-- 발신자 본인만 INSERT 허용
DROP POLICY IF EXISTS "messages_insert_self" ON public.messages;
CREATE POLICY "messages_insert_self"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (from_user = auth.uid());

-- is_read·translated_text 업데이트: 대화 당사자만 허용
DROP POLICY IF EXISTS "messages_update_participants" ON public.messages;
CREATE POLICY "messages_update_participants"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    from_user = auth.uid()
    OR to_user = auth.uid()
  );

-- ── C-6: live_translations SELECT 정책 교체 ────────────────────────────────

-- 기존 전체 공개 SELECT 정책 제거
DROP POLICY IF EXISTS "live_translations_read_authenticated" ON live_translations;

-- 동일 현장 사용자 또는 관리자만 방송 내용 열람 허용
-- site_id가 NULL인 레코드(레거시 글로벌 채널)는 인증된 모든 사용자에게 허용 (하위 호환)
CREATE POLICY "live_translations_select_site_or_admin"
  ON live_translations
  FOR SELECT
  TO authenticated
  USING (
    public.is_safelink_admin()
    OR site_id IS NULL
    OR site_id = (
      SELECT profiles.site_id FROM profiles WHERE profiles.id = auth.uid()
    )
  );
