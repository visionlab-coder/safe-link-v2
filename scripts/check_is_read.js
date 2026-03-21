
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkIsRead() {
    const { data, error } = await supabase.from('messages').select('is_read').limit(1);
    if (error) {
        if (error.code === 'PGRST204' || error.message.includes('column "is_read" does not exist')) {
            console.log('is_read column DOES NOT exist');
        } else {
            console.error('Error checking is_read:', error);
        }
    } else {
        console.log('is_read column EXISTS');
    }
}

checkIsRead();
