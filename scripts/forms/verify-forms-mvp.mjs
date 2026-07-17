import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260717212716_forms_100_mvp.sql');
const hardening = read('supabase/migrations/20260717213618_forms_100_contract_hardening.sql');
const runner = read('src/components/forms/FormRunnerSheet.tsx');
const renderer = read('src/components/forms/FormRenderer.tsx');
const ngoAdapter = read('src/components/ngo/FormSubmissionSheet.tsx');
const portal = read('src/pages/Portal.tsx');
const portalHook = read('src/hooks/useNgoPortalForms.ts');

const assertions = [
  ['server payload validation', migration.includes('validate_form_payload')],
  ['canonical work-item labels', hardening.includes('trg_normalize_work_item_labels')],
  ['canonical accepted status', hardening.includes("then 'Complete' else 'Waiting on NGO'")],
  ['form relationship indexes', hardening.includes('form_assignments_template_idx') && hardening.includes('form_submissions_work_item_idx')],
  ['validation trigger', migration.includes('trg_enforce_form_payload_before_submit')],
  ['governed form builder RPC', migration.includes('admin_upsert_form_template')],
  ['template version history', migration.includes('form_template_versions')],
  ['NGO form assignments', migration.includes('form_assignments')],
  ['assignment/submission linking', migration.includes('link_form_assignment_submission')],
  ['department review RPC', migration.includes('review_form_submission')],
  ['revision workflow', migration.includes('create_form_revision')],
  ['draft file evidence columns', migration.includes('form_submission_id uuid references public.form_submissions')],
  ['file evidence waits for submit', migration.includes('if new.form_submission_id is not null then return new')],
  ['canonical runner uses workflow hook', runner.includes('useSaveFormWorkflow')],
  ['runner uploads pending files before submit', runner.includes('useUploadFormSubmissionFile')],
  ['renderer supports file fields', renderer.includes('case "file"')],
  ['NGO adapter uses canonical runner', ngoAdapter.includes('<FormRunnerSheet')],
  ['portal uses canonical runner', portal.includes('<FormRunnerSheet')],
  ['portal has no direct submission writer', !portalHook.includes('.from("form_submissions")') && !portalHook.includes(".from('form_submissions')")],
];

const failed = assertions.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`FAIL: ${name}`);
  process.exit(1);
}

for (const [name] of assertions) console.log(`PASS: ${name}`);
console.log(`Forms 100 source contract: ${assertions.length}/${assertions.length} checks passed.`);
