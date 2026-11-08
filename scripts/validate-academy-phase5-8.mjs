import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const file=p=>readFileSync(p,"utf8");
const app=file("src/App.tsx"),home=file("src/pages/LearningAcademy.tsx");
const guide=file("src/components/onboarding/AcademyScreenGuide.tsx");
const locale=file("src/lib/academyLocalization.ts");
const source=file("src/data/academyCoreTracks.ts");
const rights=file("supabase/migrations/20261107223000_academy_assigned_track_security.sql");
const integrations=file("supabase/migrations/20261107224500_academy_integrations_readiness.sql");
const translations=file("supabase/migrations/20261107230000_academy_multilingual_lessons.sql");
const validation=file(".github/workflows/supabase-migration-validation.yml");
const test=file("supabase/tests/academy_phase5_8_security_smoke.sql");
for(const route of ["/learning/integrations","/learning/translations"]){
  assert.ok(app.includes('path="'+route+'"'),"Missing Academy administration route "+route);
}
for(const lang of ["en","fr","es","pt"]){
  assert.ok(locale.includes('code:"'+lang+'"'),"Missing one of the Academy's four languages: "+lang);
}
assert.ok(locale.includes('research:{en:')&&locale.includes('board:{en:'),
  "Reviewable course navigation labels must include all important paths");
assert.ok(source.includes('...supplementalWorkspaceTracks'),
  "Multilingual instruction must reuse the current actual training catalog");
assert.ok(home.includes('status==="reviewed"'),
  "Do not show draft translated instruction to learners");
assert.ok(home.includes("englishFallback"),
  "Show honest original-language fallback if translation was not reviewed");
assert.ok(guide.includes("translated_steps")&&guide.includes('No approved'),
  "In-screen guide should retain independently reviewed translation rules");
assert.ok(rights.includes('can_record_assigned_academy_lesson'),
  "Practice completion must be authorized by the actual approved course");
assert.ok(rights.includes('with check ('),
  "New practice completion rules must be enforced at database insert");
assert.ok(integrations.includes("'external_connection_required'"),
  "Do not invent social OAuth integrations merely from registered channels");
assert.ok(integrations.includes("platform_post_id"),
  "Published provider evidence must be distinguished from scheduled content");
assert.ok(translations.includes("row_data.authored_by=(select auth.uid())"),
  "Translation authors must not independently publish their own drafts");
assert.ok(translations.includes("enable row level security"),
  "Unreviewed lesson translations must have RLS");
assert.ok(validation.includes("version: 2.122.1"),
  "Pin a supported v2 CLI version to avoid the historical parser defect");
assert.ok(test.includes("academy_phase5_8_security_passed"),
  "Newly built authorization gates require a regression smoke test");
console.log("Academy phases 5-8 curriculum, security, internationalization and release gates passed");
