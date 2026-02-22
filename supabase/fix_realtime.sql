-- Run this in the Supabase SQL Editor if real-time chat is still not working!

-- 1. Enable Realtime for the 'messages' table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- 2. Ensure REPLICA IDENTITY is set to FULL for guaranteed delivery of all changes
ALTER TABLE messages REPLICA IDENTITY FULL;

-- 3. (Optional) Check RLS policies for messages
-- If you want anyone to see messages they are part of:
-- CREATE POLICY "Users can see their own messages" ON public.messages
-- FOR SELECT USING (auth.uid() = from_user OR auth.uid() = to_user);
