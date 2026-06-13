-- Link uploaded documents directly to departmental form templates and departments.

alter table public.documents
add column if not exists form_template_id uuid references public.form_templates(id) on delete set null,
add column if not exists module module_type,
add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists idx_documents_form_template_id on public.documents(form_template_id);
create index if not exists idx_documents_module on public.documents(module);
create index if not exists idx_documents_department_id on public.documents(department_id);
