-- site_id 없이 생성된 테스트용 TBM 데이터 정리
-- 관련 서명(tbm_ack)을 먼저 삭제 후 TBM 본체 삭제

DELETE FROM tbm_ack WHERE tbm_id IN (
  SELECT id FROM tbm_notices WHERE site_id IS NULL
);

DELETE FROM tbm_notices WHERE site_id IS NULL;
