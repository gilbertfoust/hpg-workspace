import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
const file=(p)=>readFileSync(p,"utf8");
const routes=file("src/App.tsx");
const pathway=file("supabase/migrations/20261107193000_academy_pathway_curriculum.sql");
const assessment=file("supabase/migrations/20261107210000_academy_assessment_reminders.sql");
const home=file("src/pages/LearningAcademy.tsx");
const roster=file("src/pages/AcademyLearningPlan.tsx");
const tests=file("supabase/tests/academy_pathways_curriculum_reminders_smoke.sql");
for(const route of ["/learning/plan","/learning/curriculum"]){
  assert.ok(routes.includes('path="'+route+'"'),"Missing Academy route "+route);
}
for(const [name,content] of [
  ["profile-based auto sync",pathway],
  ["assessment remediation",assessment]
]){
  assert.ok(!content.includes("service_role"),name+" may not expose service credentials");
}
assert.ok(pathway.includes("academy_sync_profile_assignments"),
  "New staff changes must trigger automatic assignment refresh");
assert.ok(pathway.includes("person.role in("),
  "Staff automatic course assignment must exclude NGO accounts");
assert.ok(pathway.includes("academy_assignment_events"),
  "Assignments must retain change history");
assert.ok(pathway.includes("get_my_academy_learning_plan"),
  "Course scope should be enforced by server-side authorization");
assert.ok(pathway.includes("Academy curriculum administrator required"),
  "Curriculum edit must require the admin permission");
assert.ok(assessment.includes("private.academy_assessment_eligible"),
  "Knowledge checks must verify assigned pathway");
assert.ok(assessment.includes("private.queue_academy_course_notifications"),
  "Reminder queue must run server-side rather than from browser state");
assert.ok(assessment.includes("assessment_id text primary key"),
  "Assessment retry policies must reference specific examinations");
assert.ok(assessment.includes("revoke all on public.academy_course_notifications"),
  "Staff must not be allowed to create notices");
assert.ok(home.includes('to="/learning/plan"'),
  "Learners should see assigned courses on the Academy home page");
assert.ok(roster.includes("setAcademy")===false,
  "Assignment authorization must use verified server RPC");
assert.ok(tests.includes("academy_phases_1_4_security_passed"),
  "Phases 1-4 database authorization tests missing");
console.log("Academy phases 1-4 static checks passed");
