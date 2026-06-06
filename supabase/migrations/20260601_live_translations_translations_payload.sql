-- Store pre-translated live speech payloads by worker language.
-- Existing code already writes text_ko; worker/live reads translations[lang].
alter table public.live_translations
  add column if not exists translations jsonb not null default '{}'::jsonb;

create index if not exists idx_live_translations_translations_gin
  on public.live_translations using gin (translations);

comment on column public.live_translations.translations is
  'Pre-translated live speech text map by target language code, e.g. {"vi":"..."}';
