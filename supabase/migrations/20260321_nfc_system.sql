-- ============================================
-- SAFE-LINK v2.5 NFC System Tables
-- ============================================

-- 1. NFC Tags Master
CREATE TABLE IF NOT EXISTS public.nfc_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_code TEXT UNIQUE NOT NULL,
  site_id TEXT,
  location TEXT,
  tag_type TEXT NOT NULL DEFAULT 'check_in',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. NFC Workers (no signup required)
CREATE TABLE IF NOT EXISTS public.nfc_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  preferred_lang TEXT NOT NULL DEFAULT 'en',
  display_name TEXT,
  site_id TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. NFC Attendance Records
CREATE TABLE IF NOT EXISTS public.nfc_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfc_worker_id UUID NOT NULL REFERENCES public.nfc_workers(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.nfc_tags(id),
  check_type TEXT NOT NULL DEFAULT 'check_in',
  checked_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT
);

-- 4. NFC TBM Acknowledgements
CREATE TABLE IF NOT EXISTS public.nfc_tbm_ack (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nfc_worker_id UUID NOT NULL REFERENCES public.nfc_workers(id) ON DELETE CASCADE,
  tbm_notice_id UUID NOT NULL,
  tag_id UUID REFERENCES public.nfc_tags(id),
  confirmed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nfc_worker_id, tbm_notice_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nfc_attendance_worker ON public.nfc_attendance(nfc_worker_id);
CREATE INDEX IF NOT EXISTS idx_nfc_attendance_date ON public.nfc_attendance(checked_at);
CREATE INDEX IF NOT EXISTS idx_nfc_tbm_ack_worker ON public.nfc_tbm_ack(nfc_worker_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tbm_ack_tbm ON public.nfc_tbm_ack(tbm_notice_id);
CREATE INDEX IF NOT EXISTS idx_nfc_workers_device ON public.nfc_workers(device_id);

-- RLS Policies
ALTER TABLE public.nfc_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfc_tbm_ack ENABLE ROW LEVEL SECURITY;

-- nfc_tags: public read for active tags, authenticated users manage
CREATE POLICY "Anyone can read active tags" ON public.nfc_tags
  FOR SELECT USING (is_active = true);
CREATE POLICY "Authenticated users manage tags" ON public.nfc_tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- nfc_workers: anon can register and read
CREATE POLICY "Anyone can register as nfc worker" ON public.nfc_workers
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read nfc workers" ON public.nfc_workers
  FOR SELECT USING (true);
CREATE POLICY "Anyone can update nfc workers" ON public.nfc_workers
  FOR UPDATE USING (true) WITH CHECK (true);

-- nfc_attendance: anon can insert and read
CREATE POLICY "Anyone can check in" ON public.nfc_attendance
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read attendance" ON public.nfc_attendance
  FOR SELECT USING (true);

-- nfc_tbm_ack: anon can insert and read
CREATE POLICY "Anyone can confirm tbm" ON public.nfc_tbm_ack
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read acks" ON public.nfc_tbm_ack
  FOR SELECT USING (true);
