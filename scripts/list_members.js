const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listUsers() {
    console.log('--- SAFE-LINK V2 전체 회원 상세 리스트 ---');

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('role', { ascending: true });

    if (error) {
        console.error('오류:', error.message);
        return;
    }

    // 역할을 기준으로 분류
    const roles = {
        'ROOT': [],
        'HQ_ADMIN': [],
        'SITE_MANAGER': [],
        'SAFETY_OFFICER': [],
        'WORKER': [],
        '기타': []
    };

    data.forEach(u => {
        const r = u.role || u.system_role || '기타';
        if (roles[r]) roles[r].push(u);
        else roles['기타'].push(u);
    });

    Object.keys(roles).forEach(roleName => {
        if (roles[roleName].length > 0) {
            console.log(`\n[${roleName}] - ${roles[roleName].length}명`);
            roles[roleName].forEach((u, i) => {
                const info = [
                    `ID: ${u.id.substring(0, 8)}...`,
                    `이름: ${u.full_name || '(미설정)'}`,
                    `현장: ${u.site_id || '(미할당)'}`,
                    `언어: ${u.language || 'KO'}`,
                    `가입일: ${new Date(u.created_at).toLocaleDateString()}`
                ].join(' | ');
                console.log(`${i + 1}. ${info}`);
            });
        }
    });

    console.log('\n------------------------------------------');
}

listUsers();
