-- Run this in the Supabase SQL Editor to fix 1:1 Real-time Chat and Profile access!

-- 1. Enable Realtime for the 'messages' table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 2. Ensure REPLICA IDENTITY is set to FULL for guaranteed delivery of all changes
ALTER TABLE messages REPLICA IDENTITY FULL;

-- 3. Fix Profile access (needed for workers to find admins)
-- If this policy already exists, skip or replace it.
DROP POLICY IF EXISTS "Allow authenticated users to view profiles" ON public.profiles;
CREATE POLICY "Allow authenticated users to view profiles" ON public.profiles
FOR SELECT TO authenticated USING (true);

-- 4. Ensure Messages are accessible by participants
DROP POLICY IF EXISTS "Users can see their own messages" ON public.messages;
CREATE POLICY "Users can see their own messages" ON public.messages
FOR SELECT TO authenticated USING (auth.uid() = from_user OR auth.uid() = to_user);

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages" ON public.messages
FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user);
