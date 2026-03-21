
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function listTables() {
    const { data, error } = await supabase.rpc('get_table_names'); // If this RPC exists
    if (error) {
        console.error('Error listing tables via RPC:', error);
        // Alternative: query public.tables if allowed
        const { data: tables, error: tableErr } = await supabase.from('pg_catalog.pg_tables').select('tablename').eq('schemaname', 'public');
        if (tableErr) console.error('Error fetching tables from pg_tables:', tableErr);
        else console.log('Tables:', tables);
    } else {
        console.log('Tables:', data);
    }
}

listTables();
