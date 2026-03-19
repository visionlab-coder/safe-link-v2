-- SAFE-LINK: Fix missing 'address' column in 'sites' table
-- Run this in Supabase SQL Editor to resolve "could not find the address column" error.

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sites' AND column_name='address') THEN
        ALTER TABLE public.sites ADD COLUMN address TEXT;
    END IF;
END $$;

-- 2. Force Schema Cache Refresh for PostgREST
NOTIFY pgrst, 'reload schema';
