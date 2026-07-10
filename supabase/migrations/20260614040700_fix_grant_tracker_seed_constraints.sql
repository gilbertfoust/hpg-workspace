-- Ensure starter grant data can use ON CONFLICT during a clean replay.
-- PostgreSQL cannot infer a partial unique index for an unqualified
-- ON CONFLICT (source_id, external_id) target.

drop index if exists public.grant_opportunities_source_external_unique;
create unique index if not exists grant_opportunities_source_external_unique
  on public.grant_opportunities(source_id, external_id);

create unique index if not exists grant_sources_name_unique
  on public.grant_sources(name);
