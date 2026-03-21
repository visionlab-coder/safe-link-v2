
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkMessagesSchema() {
    const { data, error } = await supabase.from('messages').select('*').limit(1);
    if (error) {
        console.error('Error fetching messages:', error);
        return;
    }
    if (data && data.length > 0) {
        console.log('Columns in messages table:', Object.keys(data[0]));
    } else {
        console.log('No data in messages table.');
        // Try to get headers from a select query even if empty
        const { data: cols, error: colErr } = await supabase.from('messages').select('*').limit(0);
        console.log('Empty query headers:', cols);
    }
}

checkMessagesSchema();
