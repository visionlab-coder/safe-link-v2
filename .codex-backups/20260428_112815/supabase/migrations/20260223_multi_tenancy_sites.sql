-- Create table for Construction Sites
CREATE TABLE IF NOT EXISTS public.sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Alter profiles table to handle multiple sites properly, if not already handled
-- And adding system root role if needed
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS system_role TEXT;
-- Add site_id array if we want users to be in multiple sites? No, MVP for now.
-- We already have site_id UUID on profiles usually, let's verify.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='site_id') THEN
        ALTER TABLE public.profiles ADD COLUMN site_id UUID REFERENCES public.sites(id);
    END IF;
END $$;

-- Add AI Insight column to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS ai_analysis JSONB;

-- Policies for sites
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view sites" ON public.sites
FOR SELECT TO authenticated USING (true);

-- Only System Admin can insert/update/delete sites
-- We will assume system_role = 'ROOT' bypasses all.
CREATE POLICY "System roots can manage sites" ON public.sites
FOR ALL TO authenticated USING (
    (SELECT system_role FROM public.profiles WHERE id = auth.uid()) = 'ROOT'
);

-- Seed data for initial sites
INSERT INTO public.sites (name, address, metadata) 
VALUES 
('서울 강남 테헤란로 오피스 신축', '서울시 강남구 테헤란로', '{"worker_limit": 500}'),
('부산 해운대 엘시티 보수 공사', '부산시 해운대구 중동', '{"worker_limit": 200}'),
('인천 송도 물류 센터 현장', '인천시 연수구 송도동', '{"worker_limit": 300}'),
('대구 신천 개발 정비 사업', '대구시 북구 신천동', '{"worker_limit": 150}'),
('광주 첨단 연구단지 조성 현장', '광주시 북구 오룡동', '{"worker_limit": 250}')
ON CONFLICT DO NOTHING;
