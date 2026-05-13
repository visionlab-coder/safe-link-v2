-- construction_glossary SELECT RLS 추가
-- 용어집 데이터는 비민감 정보(건설 은어/표준어)이므로 anon/authenticated 모두 읽기 허용
-- 번역 API(서버사이드)와 클라이언트 모두 DB glossary를 실제 사용할 수 있도록 함

create policy "anyone_can_read_active_glossary"
on public.construction_glossary
for select
to anon, authenticated
using (is_active = true);

notify pgrst, 'reload schema';
