-- ============================================================
-- 보안 패치: RLS 취약점 7종 수정 2026-05-14
-- C-7, C-8, C-9, C-10, C-5(DB), H-13, MEDIUM(stop_work_routing)
-- ============================================================
-- 참고: is_safelink_admin() 은 profiles.role 기반 (nfc_tbm_patent.sql)
--       is_system_operator() 는 profiles.system_role 기반 (이 파일에서 정의)
--       두 함수는 의도적으로 서로 다른 컬럼을 사용함.
-- ============================================================


-- ============================================================
-- C-7: is_system_operator() 함수 정의
-- redteam_fixes.sql에서 호출하지만 정의가 없어 런타임 오류 발생
-- profiles.system_role 컬럼 기반 (role 컬럼 기반인 is_safelink_admin과 구분)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_system_operator()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND system_role IN ('ROOT', 'SUPER_ADMIN')
  );
$$;


-- ============================================================
-- C-8: stop_work_alerts UPDATE 정책 강화
-- 기존: USING(true) WITH CHECK(true) → 인증된 모든 사용자 수정 가능
-- 변경: 관리자(is_safelink_admin)만 resolve/update 가능
-- ============================================================
DROP POLICY IF EXISTS "authenticated users can update stop work alerts" ON public.stop_work_alerts;
CREATE POLICY "only admins resolve stop work alerts"
  ON public.stop_work_alerts FOR UPDATE
  TO authenticated
  USING (public.is_safelink_admin())
  WITH CHECK (public.is_safelink_admin());

-- claim17_stop_work_interventions 동일하게 적용
DROP POLICY IF EXISTS "authenticated users can update claim17 stop work" ON public.claim17_stop_work_interventions;
CREATE POLICY "only admins update claim17 stop work"
  ON public.claim17_stop_work_interventions FOR UPDATE
  TO authenticated
  USING (public.is_safelink_admin())
  WITH CHECK (public.is_safelink_admin());


-- ============================================================
-- C-9: safety_equipment_grants 정책 강화
-- 기존: FOR ALL USING(true) WITH CHECK(true) → 모든 인증 사용자 가능
-- 변경: 관리자만 허용
-- ============================================================
DROP POLICY IF EXISTS "admin can manage safety grants" ON public.safety_equipment_grants;
CREATE POLICY "only admins manage safety grants"
  ON public.safety_equipment_grants FOR ALL
  TO authenticated
  USING (public.is_safelink_admin())
  WITH CHECK (public.is_safelink_admin());


-- ============================================================
-- C-10: claim13_pledges UPDATE 정책 강화
-- 기존: USING(true) WITH CHECK(true) → 누구나 임의 pledge 수정 가능
-- 변경: 본인(worker_id) + 아직 서명 전(approved_at IS NULL)인 경우만 가능
-- ============================================================
DROP POLICY IF EXISTS "update own pledge" ON public.claim13_pledges;
CREATE POLICY "workers sign own unsigned pledge"
  ON public.claim13_pledges FOR UPDATE
  TO authenticated
  USING (auth.uid() = worker_id AND approved_at IS NULL)
  WITH CHECK (auth.uid() = worker_id);


-- ============================================================
-- H-13: tbm_notification_log 정책 강화
-- 기존: FOR ALL USING(true) WITH CHECK(true) → 모든 인증 사용자 읽기/쓰기 가능
-- 변경: 관리자만 INSERT/SELECT, UPDATE/DELETE 정책 없음 (알림 레코드 불변)
-- ============================================================
DROP POLICY IF EXISTS "admin notif rw" ON public.tbm_notification_log;

CREATE POLICY "admins insert notifications"
  ON public.tbm_notification_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_safelink_admin());

CREATE POLICY "admins read notifications"
  ON public.tbm_notification_log FOR SELECT
  TO authenticated
  USING (public.is_safelink_admin());

-- UPDATE, DELETE 정책 없음: 알림 로그는 불변 레코드


-- ============================================================
-- C-5 (DB 레벨): tbm_quiz_responses SELECT 정책 강화
-- 기존: USING(auth.uid() = worker_id OR true) → 사실상 전체 공개 (OR true)
-- redteam_fixes.sql에서도 같은 이름으로 USING(true) 로 재정의됨
-- 변경: 본인(worker_id) 또는 관리자만 읽기 가능
-- 주의: answer_index_correct 컬럼 레벨 제어는 API 레이어에서 별도 처리 필요
-- ============================================================
-- 기존 두 정책 모두 삭제 (claim11에서 생성된 이름 + redteam_fixes에서 재정의된 이름)
DROP POLICY IF EXISTS "workers read own quiz" ON public.tbm_quiz_responses;
DROP POLICY IF EXISTS "workers read own quiz response" ON public.tbm_quiz_responses;

CREATE POLICY "workers read own quiz response"
  ON public.tbm_quiz_responses FOR SELECT
  TO authenticated
  USING (
    auth.uid() = worker_id
    OR public.is_safelink_admin()
  );


-- ============================================================
-- MEDIUM: stop_work_alert_routing INSERT 정책 강화
-- 기존: WITH CHECK(false) → 클라이언트 INSERT 완전 차단이었으나 정책 이름이 혼선 유발
-- 변경: 관리자(is_safelink_admin) 또는 service_role만 INSERT 가능
-- service_role은 RLS를 우회하므로 기존 서버사이드 삽입 로직은 영향 없음
-- ============================================================
DROP POLICY IF EXISTS "routing service insert" ON public.stop_work_alert_routing;
CREATE POLICY "routing admin or service insert"
  ON public.stop_work_alert_routing FOR INSERT
  TO authenticated
  WITH CHECK (public.is_safelink_admin());
