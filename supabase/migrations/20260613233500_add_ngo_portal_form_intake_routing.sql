-- Separate internal staff forms from NGO portal request forms.
-- NGO portal forms are submitted by NGO users and land first with NGO Coordination.
-- NGO Coordination can then triage/reroute requests to the correct department.

alter table public.form_templates
add column if not exists form_audience text not null default 'staff' check (form_audience in ('staff', 'ngo_portal')),
add column if not exists intake_module module_type not null default 'ngo_coordination';

alter table public.form_submissions
add column if not exists intake_status text not null default 'new' check (intake_status in ('new', 'triaged', 'routed', 'closed')),
add column if not exists routed_to_module module_type,
add column if not exists routed_at timestamptz,
add column if not exists routed_by_user_id uuid,
add column if not exists routing_notes text;

create index if not exists idx_form_templates_form_audience on public.form_templates(form_audience);
create index if not exists idx_form_submissions_intake_status on public.form_submissions(intake_status);
create index if not exists idx_form_submissions_routed_to_module on public.form_submissions(routed_to_module);
