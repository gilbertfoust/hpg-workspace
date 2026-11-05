// Static curriculum consistency gate. Does not require user sessions or alter data.
// Safe to run in CI while historical Supabase replay is investigated separately.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const file = path => readFileSync(path,"utf8");

const core=file("src/data/academyCoreTracks.ts");
const learningPage=file("src/pages/LearningAcademy.tsx");
const liveOverlay=file("src/components/onboarding/AcademyScreenGuide.tsx");
const layout=file("src/components/layout/MainLayout.tsx");
const supplemental=file("src/data/academyWorkspaceTracks.ts");
const routes=file("src/App.tsx");
const practice=file("src/pages/AcademyPracticeLab.tsx");
const seed=file("supabase/migrations/20261105182000_academy_workspace_training_expansion.sql");
const bank=file("supabase/migrations/20261105182500_academy_department_knowledge_check_expansion.sql");
const media=file("supabase/migrations/20261105183000_academy_approved_instructional_media.sql");

const coreLessons=[...core.matchAll(/\{\s*id:\s*"([a-z0-9-]+)",\s*name:\s*"([^"]+)"/g)]
  .map(m=>({id:m[1],name:m[2]}));
const addedLessons=[...supplemental.matchAll(/\{\s*id:"([a-z0-9-]+)",name:"([^"]+)"/g)]
  .map(m=>({id:m[1],name:m[2]}));
assert.equal(coreLessons.length,32,"Expected existing 32 taught lessons");
assert.equal(addedLessons.length,28,"Expected 28 new department lessons");
const ids=[...coreLessons,...addedLessons].map(x=>x.id);
assert.equal(new Set(ids).size,60,"Lesson IDs must be unique across both catalogs");

const routeNames=new Set([...routes.matchAll(/<Route path="([^"]+)"/g)].map(m=>m[1]));
const paths=[...core.matchAll(/\bpath:\s*"([^"]+)"/g),...supplemental.matchAll(/\bpath:"([^"]+)"/g)].map(m=>m[1]);
const missing=paths.filter(x=>!routeNames.has(x));
assert.deepEqual(missing,[],"Each Academy navigation lesson needs a real application route");
for(const lesson of addedLessons)assert.ok(
  seed.includes("('"+lesson.id+"',"),
  "Missing database seed for "+lesson.id
);

assert.ok(core.includes("supplementalWorkspaceTracks"),"Expanded catalog must be imported");
assert.ok(learningPage.includes("AcademyNarratedSteps"),"Every viewed lesson needs accessible narration");
assert.ok(learningPage.includes("AcademyLessonResources"),"Approved instructional resources must appear in lessons");
assert.ok(learningPage.includes('to="/learning/practice"'),"Learner should reach safe simulated practice");
assert.ok(routes.includes('path="/learning/practice"'),"Safe practice route missing");
assert.ok(learningPage.includes("?academyLesson="),"Open screen should pass current tutorial context");
assert.ok(layout.includes("<AcademyScreenGuide />"),"Application layout should show the in-screen guide");
assert.ok(liveOverlay.includes("academy.mark.mutateAsync"),"A learner should explicitly save progress");
assert.ok(!/\.from\(|\.rpc\(|ensureSupabase|fetch\(/.test(liveOverlay),"Live guide must not mutate operational records");
assert.ok(!/ensureSupabase|\.rpc\(|\.from\(|fetch\(|localStorage/.test(practice),
  "Practice lab must not contact production systems or save simulation data");

const newTrackIds=["hr","program","operations","technology","administration","compliance","improvement"];
for(const id of newTrackIds)assert.ok(
  bank.includes("('"+id+"','"+id+"',"),"Missing departmental assessment "+id
);
const addedQuestions=[...bank.matchAll(/^\s*\('([a-z0-9-]+)',\s*'([a-z0-9-]+)',\s*(\d+),/gm)];
assert.equal(addedQuestions.length,75,"Expected 75 authored additional scenario questions");
assert.equal(new Set(addedQuestions.map(x=>x[1])).size,75,"Assessment question IDs must be unique");
assert.ok(media.includes("enable row level security"),"Instructional resource registry must have RLS");
assert.ok(media.includes("item.created_by=(select auth.uid())"),"Media publication must reject author self-approval");
assert.ok(media.includes("revoke all on public.academy_lesson_resources"),"No direct client media modification grants");

console.log(JSON.stringify({
  workspace_lessons:ids.length,
  original_lessons:coreLessons.length,
  new_department_lessons:addedLessons.length,
  linked_navigation_routes:paths.length,
  added_knowledge_check_questions:addedQuestions.length,
  simulation_is_client_only:true,
  instructional_media_has_independent_review:true
},null,2));
