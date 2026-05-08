-- SAFE-LINK-V2: Add Read Receipt Column
-- Execute this in your Supabase SQL Editor to enable the "1" indicator in chat.

-- 1. Add is_read column if it doesn't exist
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;

-- 2. Update existing messages to be 'read' so they don't all show '1'
UPDATE public.messages SET is_read = true WHERE is_read IS NULL;

-- 3. Ensure Realtime is enabled for this table to see the '1' disappear instantly
-- (Run this if you haven't already enabled Realtime for the 'messages' table)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- If previously added, it might error, so we use a safe approach
BEGIN;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
  WHEN OTHERS THEN NULL;
COMMIT;

ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- 4. Notify to reload schema cache
NOTIFY pgrst, 'reload schema';
