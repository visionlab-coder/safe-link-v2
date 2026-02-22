import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function clearHistory() {
    console.log('Clearing messages...')
    const { error: msgErr } = await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000') // delete all hacks
    if (msgErr) console.error('Error deleting messages:', msgErr.message)
    else console.log('Messages cleared.')

    console.log('Clearing TBM...)')
    const { error: tbmErr } = await supabase.from('tbm_notices').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (tbmErr) console.error('Error deleting TBM:', tbmErr.message)
    else console.log('TBM cleared.')
}

clearHistory()
