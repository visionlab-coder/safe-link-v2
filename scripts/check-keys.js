require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyConnection() {
    console.log(`Connecting to Supabase at ${supabaseUrl}...`);
    
    // Try to query the sites table
    const { data, error } = await supabase
        .from('sites')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Supabase connection or query error:', error.message);
        process.exit(1);
    } else {
        console.log('Successfully connected to Supabase!');
        console.log('Sample data from "sites" table:', data);
        
        // Check for specific columns if needed
        if (data.length > 0) {
            const columns = Object.keys(data[0]);
            console.log('Available columns in "sites":', columns.join(', '));
            if (columns.includes('address')) {
                console.log('SUCCESS: "address" column is present.');
            } else {
                console.warn('WARNING: "address" column is missing!');
            }
        }
    }
}

verifyConnection();
