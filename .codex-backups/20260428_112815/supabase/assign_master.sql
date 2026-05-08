-- like2buyglobal@gmail.com 계정을 마스터 계정(ROOT)으로 승격시키는 스크립트
-- 이메일로 User ID를 찾아서 profiles 테이블의 역할을 업데이트합니다.

DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- 1. auth.users 테이블에서 이메일에 해당하는 ID를 찾습니다.
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = 'like2buyglobal@gmail.com';

    -- 2. 해당 사용자가 존재하면 profiles 테이블을 업데이트합니다.
    IF target_user_id IS NOT NULL THEN
        -- profiles 테이블에 데이터가 없는 경우를 대비해 upsert 스타일로 처리하거나 update 수행
        -- 여기서는 이미 가입되어 있다고 가정하고 update를 수행합니다.
        UPDATE public.profiles 
        SET 
            role = 'ROOT',
            system_role = 'ROOT',
            display_name = 'Master Admin'
        WHERE id = target_user_id;
        
        RAISE NOTICE 'User like2buyglobal@gmail.com has been promoted to ROOT (Master).';
    ELSE
        RAISE NOTICE 'User like2buyglobal@gmail.com not found. Please sign up first.';
    END IF;
END $$;
