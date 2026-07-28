ALTER TABLE chat_messages
ADD COLUMN client_message_id TEXT;

CREATE UNIQUE INDEX uq_chat_messages_client_message
ON chat_messages (thread_id, sender_user_id, client_message_id)
WHERE client_message_id IS NOT NULL;
