-- SAFE-LINK: Final Schema Alignment for 'messages' table
-- This script ensures the database table matches the application code.

-- 1. Create or Update 'messages' table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID,
    from_user UUID NOT NULL REFERENCES auth.users(id),
    to_user UUID NOT NULL REFERENCES auth.users(id),
    source_lang TEXT,
    target_lang TEXT,
    source_text TEXT,
    translated_text TEXT,
    audio_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure columns exist if the table was created differently before
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='from_user') THEN
        ALTER TABLE public.messages ADD COLUMN from_user UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='to_user') THEN
        ALTER TABLE public.messages ADD COLUMN to_user UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='source_lang') THEN
        ALTER TABLE public.messages ADD COLUMN source_lang TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='translated_text') THEN
        ALTER TABLE public.messages ADD COLUMN translated_text TEXT;
    END IF;
END $$;

-- 3. Enable RLS and Realtime
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Users can see their own messages" ON public.messages;
CREATE POLICY "Users can see their own messages" ON public.messages
FOR SELECT TO authenticated USING (auth.uid() = from_user OR auth.uid() = to_user);

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages" ON public.messages
FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user);

-- 5. MANDATORY: Refresh PostgREST schema cache
-- Note: This command might require specific permissions, but it's the standard way.
NOTIFY pgrst, 'reload schema';
