
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const tables = ['profiles', 'sites', 'tbm_notices', 'tbm_ack', 'messages', 'construction_glossary'];

    for (const table of tables) {
        console.log(`\n--- Checking table: ${table} ---`);
        try {
            const { data, error } = await supabase.from(table).select('*').limit(1);

            if (error) {
                console.error(`Error fetching ${table}:`, error.message);
            } else if (data && data.length > 0) {
                console.log(`Columns in ${table}:`, Object.keys(data[0]));
                if (table === 'profiles') console.log('Sample profile:', data[0]);
            } else {
                console.log(`Table ${table} exists but is empty.`);
            }
        } catch (e) {
            console.error(`Unexpected error checking ${table}:`, e.message);
        }
    }
}

checkSchema();
