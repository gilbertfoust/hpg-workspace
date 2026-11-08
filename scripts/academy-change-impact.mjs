// Detect HPG operational page changes that may invalidate existing Academy
// walkthroughs. Advisory review is explicit; never auto-approve a lesson.
import {readFileSync,writeFileSync,appendFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
const file=p=>readFileSync(p,"utf8");
const base=process.env.ACADEMY_BASE_SHA||"";
const head=process.env.ACADEMY_HEAD_SHA||"HEAD";
let changed=[];
if(base){
  try{changed=execFileSync("git",["diff","--name-only",base,head],{encoding:"utf8"})
    .trim().split("\n").filter(Boolean);}
  catch(e){console.error("Could not inspect route diff; Academy change impact review is required.",e);process.exit(1);}
}
const app=file("src/App.tsx");
const imports=new Map([...app.matchAll(/import\s+(\w+)\s+from\s+"\.\/pages\/([^"]+)";/g)]
  .map(m=>[m[1],"src/pages/"+m[2]+".tsx"]));
const routes=[...app.matchAll(/<Route path="([^"]+)" element={<P><(\w+)\s*\/><\/P>} \/>/g)]
  .map(m=>({path:m[1],file:imports.get(m[2])})).filter(x=>x.file);
const curriculum=file("src/data/academyCoreTracks.ts")+"\n"+file("src/data/academyWorkspaceTracks.ts");
const taughtPaths=new Set([...curriculum.matchAll(/\bpath:\s*"([^"]+)"/g)].map(m=>m[1]));
const affected=routes.filter(route=>taughtPaths.has(route.path)&&changed.includes(route.file));
const touchedCurriculum=changed.some(p=>/src\/data\/academy(Core|Workspace)Tracks\.ts/.test(p));
const report={
  base:base||"not supplied",head,changedFiles:changed.length,
  taughtRouteChanges:affected,
  curriculumEditedInSameChange:touchedCurriculum,
  humanCurriculumReviewRequired:affected.length>0&&!touchedCurriculum,
  explanation:"Automated detection only. A route or lesson change does not constitute an authenticated staff acceptance test."
};
writeFileSync("academy-impact-report.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));
if(process.env.GITHUB_STEP_SUMMARY){
  const lines=["## Academy operational change-impact review",""];
  if(affected.length){
    lines.push("These changed operational pages are referenced by current Workspace Training lessons:");
    for(const row of affected)lines.push("- \`"+row.path+"\` ("+row.file+")");
    lines.push("");
    lines.push(touchedCurriculum?
      "Academy curriculum was also modified. Review instructional accuracy before release.":
      "**Curriculum review required:** the referenced page changed, but no curriculum-source update accompanies this PR.");
  }else lines.push("No directly taught operational page changes were detected.");
  lines.push("This automated report does not replace final staff acceptance.");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join("\n")+"\n");
}
