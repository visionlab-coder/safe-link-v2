-- SAFE-LINK V2 PoC precheck
-- Run before rehearsal to confirm that the minimum schema expected by the app exists.

select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'sites',
    'tbm_notices',
    'tbm_ack',
    'messages',
    'construction_glossary'
  )
order by table_name;

select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'profiles' and column_name in (
      'id', 'role', 'system_role', 'site_id', 'site_code',
      'display_name', 'preferred_lang', 'phone_number', 'trade', 'title'
    ))
    or (table_name = 'tbm_notices' and column_name in (
      'id', 'site_id', 'site_code', 'title', 'content_ko', 'risk_level', 'created_at'
    ))
    or (table_name = 'tbm_ack' and column_name in (
      'id', 'tbm_id', 'worker_id', 'worker_name', 'signature_data', 'signed_at'
    ))
    or (table_name = 'messages' and column_name in (
      'id', 'site_id', 'from_user', 'to_user', 'source_lang',
      'target_lang', 'source_text', 'translated_text', 'created_at'
    ))
    or (table_name = 'construction_glossary' and column_name in (
      'id', 'slang', 'standard', 'is_active'
    ))
  )
order by table_name, column_name;

select distinct role
from public.profiles
where role is not null
order by role;
