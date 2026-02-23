
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const list = ['profiles', 'sites', 'tbm_notices', 'tbm_ack', 'messages', 'construction_glossary'];
    for (const t of list) {
        const { data, error } = await supabase.from(t).select('*').limit(1);
        if (error) {
            console.log(`[${t}] ERROR: ${error.message}`);
        } else {
            console.log(`[${t}] OK. Columns: ${data.length > 0 ? Object.keys(data[0]).join(', ') : '(empty)'}`);
        }
    }
}
check();
