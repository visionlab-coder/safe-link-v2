-- `전 → 센티미터`는 단독 현장 용어가 아니며, `안전` 같은 정상 단어를 훼손한다.
-- 잘못 등록된 운영 용어집 항목과 연결된 다국어 용어를 함께 제거한다.
DELETE FROM construction_glossary
WHERE lower(btrim(slang)) = '전'
  AND lower(btrim(standard)) = '센티미터';
