-- Phase 6: truthful operational dependency assessment.
-- A channel listing or publication draft is NEVER evidence of live OAuth access.
create or replace function public.get_academy_integration_readiness()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare owners integer;approved integer;published integer;
  research_count integer;directors integer;media_count integer;
begin
  if (select auth.uid()) is null or not (select public.is_admin_user()) then
    raise exception 'Internal Academy administrator required' using errcode='42501';
  end if;
  select count(*) into owners from public.marketing_channel_accounts
    where platform in('facebook','instagram','linkedin','x','youtube','tiktok')
      and ownership_status in('verified','approved');
  select count(*) into approved from public.marketing_social_posts
    where status in('approved','scheduled','published','measured');
  select count(*) into published from public.marketing_social_posts
    where status in('published','measured')
      and nullif(btrim(coalesce(platform_post_id,'')),'') is not null
      and publication_evidence_url ~* '^https://[^[:space:]]+$';
  select count(*) into research_count from public.workspace_research_sources
    where status='reviewed';
  select count(*) into directors from public.bod_memberships
    where is_active and (term_starts_on is null or term_starts_on<=current_date)
      and (term_ends_on is null or term_ends_on>=current_date);
  select count(*) into media_count from public.academy_lesson_resources
    where status='published' and resource_kind='recorded_demo';
  return jsonb_build_object(
    'checked_at',now(),
    'checks',jsonb_build_array(
      jsonb_build_object('key','social_channel_ownership','title','Organization-owned social channels',
        'count',owners,'state',case when owners>0 then 'recorded' else 'not_verified' end,
        'needed','Confirm ownership of each HPG social channel; this does NOT establish OAuth publishing consent.'),
      jsonb_build_object('key','social_oauth','title','External social publishing authorization',
        'count',0,'state','external_connection_required',
        'needed','Connect a supported provider through its official OAuth process and validate scopes, token refresh, account ownership and publishing permission. No provider connection is yet verified in HPG Workspace.'),
      jsonb_build_object('key','social_approved','title','Social items cleared through internal workflow',
        'count',approved,'state',case when approved>0 then 'recorded' else 'not_verified' end,
        'needed','Advance approved material through legal, communications, consent and marketing review before external release.'),
      jsonb_build_object('key','social_publication_evidence','title','Externally published posts with traceable evidence',
        'count',published,'state',case when published>0 then 'recorded' else 'not_verified' end,
        'needed','Record actual provider post IDs, verified public URL and independent publication evidence. Scheduled does not mean published.'),
      jsonb_build_object('key','research_review','title','Reviewed research source evidence',
        'count',research_count,'state',case when research_count>0 then 'recorded' else 'awaiting_content' end,
        'needed','Register genuine research sources and complete independent review.'),
      jsonb_build_object('key','board_roster','title','Active director membership registry',
        'count',directors,'state',case when directors>=2 then 'recorded' else 'governance_review' end,
        'needed','Confirm actual director appointments, bylaws, quorum and voting thresholds before meetings.'),
      jsonb_build_object('key','academy_recordings','title','Reviewed instructional screen recordings',
        'count',media_count,'state',case when media_count>0 then 'recorded' else 'final_phase' end,
        'needed','Record, caption and independently approve actual demonstrations in the final instructional-video phase.')
    )
  );
end;
$$;
revoke all on function public.get_academy_integration_readiness()
from public,anon,authenticated;
grant execute on function public.get_academy_integration_readiness() to authenticated;
comment on function public.get_academy_integration_readiness() is
'Read-only, role-restricted dependency evidence. Never infers social provider authorization from a registered account or scheduled content.';
