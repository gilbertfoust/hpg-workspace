-- Expanded internal Workspace Training curriculum only; other Academy divisions remain peers.
-- Source of truth: src/data/academyWorkspaceTracks.ts
insert into public.academy_lessons(lesson_id,track_id,title,curriculum_version)
values
  ('hr-directory','hr','Navigate the staff and volunteer directory',1),
  ('hr-recruiting','hr','Review a volunteer application',1),
  ('hr-onboarding','hr','Understand onboarding and account authorization',1),
  ('hr-reviews','hr','Locate the performance review process',1),
  ('program-overview','program','Navigate Program Operations',1),
  ('program-ngo','program','Check an NGO profile and named projects',1),
  ('program-onboard','program','Understand NGO onboarding milestones',1),
  ('program-reports','program','Locate evidence for program reports',1),
  ('ops-queue','operations','Review department assignments',1),
  ('ops-hub','operations','Navigate Operations Hub',1),
  ('ops-calendar','operations','Check the operating calendar',1),
  ('ops-evidence','operations','Document a handoff without bypassing approvals',1),
  ('it-console','technology','Navigate the IT support area',1),
  ('it-operations','technology','Review technology department work',1),
  ('it-audit','technology','Read the security audit trail',1),
  ('it-permissions','technology','Review access permissions safely',1),
  ('admin-department','administration','Navigate the Administration module',1),
  ('admin-meetings','administration','Coordinate organizational appointments',1),
  ('admin-records','administration','Find an approved operational record',1),
  ('admin-reports','administration','Prepare departmental reporting inputs',1),
  ('compliance-hub','compliance','Locate internal compliance controls',1),
  ('compliance-policy','compliance','Understand the policy register',1),
  ('compliance-case','compliance','Review a compliance case without changing it',1),
  ('compliance-audit','compliance','Follow an audit or exception trail',1),
  ('improvement-intake','improvement','Capture a process improvement opportunity',1),
  ('improvement-metrics','improvement','Define evidence for an efficiency measure',1),
  ('improvement-trial','improvement','Plan a controlled improvement trial',1),
  ('improvement-handoff','improvement','Hand off an approved improvement',1)
on conflict (lesson_id) do update set
  track_id=excluded.track_id, title=excluded.title,
  updated_at=now();

comment on table public.academy_lessons is
  'HPG Executive Professional Academy — Workspace Training division lessons; self-reported orientation only, not NGO compliance or credential certificates.';
