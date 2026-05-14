-- NFC 자동 등록 시 role: "worker"(소문자)로 저장되던 버그 수정
-- profiles.role은 항상 대문자여야 함 (hasAllowedRole 비교 기준: "WORKER")
UPDATE public.profiles
SET role = 'WORKER'
WHERE role = 'worker';

-- 결과 확인
SELECT count(*) AS fixed_count FROM public.profiles WHERE role = 'WORKER';
