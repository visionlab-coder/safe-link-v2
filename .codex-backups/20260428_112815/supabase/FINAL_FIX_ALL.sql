-- SAFE-LINK: Final Database Recovery Script
-- This script fixes Enum issues and ensures the 'messages' table structure is correct.

-- 1. Fix 'profiles' table role filtering issues
-- If 'app_role' enum is missing values, the easiest fix is to convert it to TEXT
-- This allows any role string defined in the code (HQ_ADMIN, SAFETY_OFFICER, etc.) to work.
ALTER TABLE public.profiles ALTER COLUMN role TYPE TEXT;

-- 2. Drop and Recreate 'messages' table to ensure columns match the code exactly
DROP TABLE IF EXISTS public.messages CASCADE;

CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID,
    from_user UUID NOT NULL REFERENCES auth.users(id),
    to_user UUID NOT NULL REFERENCES auth.users(id),
    source_lang TEXT,
    target_lang TEXT,
    source_text TEXT,
    translated_text TEXT, -- This will store the JSON string (text, pron, rev)
    audio_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Realtime
-- Check if publication exists, if not create, then add table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 4. Set RLS Policies
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see their own messages" ON public.messages;
CREATE POLICY "Users can see their own messages" ON public.messages
FOR SELECT TO authenticated USING (auth.uid() = from_user OR auth.uid() = to_user);

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages" ON public.messages
FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user);

-- 5. Force Schema Cache Refresh
NOTIFY pgrst, 'reload schema';
