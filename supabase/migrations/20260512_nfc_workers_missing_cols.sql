-- nfc_workers 테이블이 이미 존재할 경우 CREATE TABLE IF NOT EXISTS가 스킵되어
-- created_at, updated_at 등이 누락될 수 있음. 이 마이그레이션으로 보완.
ALTER TABLE public.nfc_workers
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS notes      TEXT,
  ADD COLUMN IF NOT EXISTS consent_doc_url TEXT;
