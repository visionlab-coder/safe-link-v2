DELETE FROM messages;
-- Also clear TBM history if needed to start fresh
DELETE FROM tbm_notices;
DELETE FROM tbm_ack;
-- DELETE FROM tbm_sessions; -- (Assuming this is the same as notices or related)
