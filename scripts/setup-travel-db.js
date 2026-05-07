import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Client } = pg;

const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
const client = new Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

async function setup() {
  await client.connect();
  console.log('Connected to Supabase Postgres');

  await client.query(`
    CREATE TABLE IF NOT EXISTS public.travel_messages (
      id          bigserial PRIMARY KEY,
      room_code   text NOT NULL,
      sender_role text NOT NULL,
      original    text NOT NULL,
      translated  text NOT NULL,
      lang        text NOT NULL,
      created_at  timestamptz DEFAULT now()
    );

    ALTER TABLE public.travel_messages ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "travel_messages_all" ON public.travel_messages;
    CREATE POLICY "travel_messages_all"
      ON public.travel_messages
      FOR ALL
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);

    ALTER PUBLICATION supabase_realtime ADD TABLE public.travel_messages;
  `);

  console.log('✓ travel_messages table ready');
  await client.end();
}

setup().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
