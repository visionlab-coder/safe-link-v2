-- ADV-010: QR 게스트 근로자 동시 생성 충돌 방지
-- 동일 현장에서 같은 이름+전화번호 뒤4자리 근로자가 두 번 생성되는 race condition을 막기 위해
-- partial unique index 추가. NULL assigned_site_id는 제외.
CREATE UNIQUE INDEX IF NOT EXISTS uq_nfc_workers_site_initials_phone
  ON nfc_workers (assigned_site_id, name_initials, phone_last4)
  WHERE is_active = true AND assigned_site_id IS NOT NULL;
