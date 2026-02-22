const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://wzmzpuxpcpuvuacwmslj.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6bXpwdXhwY3B1dnVhY3dtc2xqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODk3MTEsImV4cCI6MjA4NjI2NTcxMX0.hkql2QVn_IIRIrb3pbialLHpDiNDzAE2NQNjgxUTUv0'

const supabase = createClient(supabaseUrl, supabaseKey)

async function clearHistory() {
    console.log('Clearing messages...')
    const { error: msgErr } = await supabase.from('messages').delete().neq('source_lang', 'INVALID_LANG')
    if (msgErr) console.error('Error deleting messages:', msgErr.message)
    else console.log('Messages cleared.')

    console.log('Clearing TBM notices...')
    const { error: tbmErr } = await supabase.from('tbm_notices').delete().neq('content_ko', 'INVALID_TEXT')
    if (tbmErr) console.error('Error deleting TBM:', tbmErr.message)
    else console.log('TBM cleared.')

    process.exit(0)
}

clearHistory()
