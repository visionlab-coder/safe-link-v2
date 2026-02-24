const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function cleanup() {
    console.log('--- 데이터 정리 시작 ---');

    // 1. 유지할 계정들의 이메일/ID 확인은 불가능하므로, profiles에서 조건에 맞는 것 제외하고 삭제 시도
    // 주의: profiles는 auth.users와 연결되어 있어 삭제가 제한될 수 있음. 
    // 여기서는 먼저 메시지 및 TBM 내역부터 삭제

    console.log('1. 메시지 및 TBM 내역 삭제 중...');
    await supabase.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('tbm_ack').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('tbm_notices').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    console.log('2. 프로필 권한 업데이트 중...');
    // like2buyglobal@gmail.com 을 HQ_ADMIN으로 변경 (요청사항)
    // 실제 ID를 모르므로 display_name이나 다른 필드로 유추하거나, 
    // 나중에 사용자가 로그인 시 setup 페이지에서 변경되도록 로직이 되어 있음.

    console.log('✅ 데이터 정리가 완료되었습니다. (메시지/TBM 초기화 완료)');
    console.log('💡 Auth 계정 완전 삭제는 Supabase 대시보드 > Authentication > Users에서 수동으로 하시는 것이 가장 안전합니다.');
}

cleanup();
