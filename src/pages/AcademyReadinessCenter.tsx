import { useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { Award, CheckCircle2, CircleAlert, ClipboardCheck, Film, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { useUserRole,isAdminRole } from "@/hooks/useUserRole";
import { useAcademyTeamProgress } from "@/hooks/useAcademyProgress";
import { useAcademyReadiness,useRecordAcademyAcceptance } from "@/hooks/useAcademyReadiness";

const nice=(s:string)=>s.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
const format=(s:string|null)=>s?new Date(s).toLocaleString():"Not performed";
export default function AcademyReadinessCenter(){
  const {data:role,isLoading:roleLoading}=useUserRole();
  const authorized=isAdminRole(role?.role);
  const report=useAcademyReadiness(authorized);
  const roster=useAcademyTeamProgress(authorized);
  const record=useRecordAcademyAcceptance();
  const [filter,setFilter]=useState("");
  const [chosen,setChosen]=useState<string>("");
  const [testedUser,setTestedUser]=useState("");
  const [outcome,setOutcome]=useState<"passed"|"failed"|"blocked">("passed");
  const [evidence,setEvidence]=useState("");
  const rows=useMemo(()=>report.data||[],[report.data]);
  const matches=rows.filter(row=>
    (row.lesson_title+" "+row.track_id).toLowerCase().includes(filter.toLowerCase()));
  const current=rows.find(row=>row.lesson_id===chosen);
  const total=rows.length;
  const prepared=rows.filter(row=>row.question_count>=5).length;
  const media=rows.filter(row=>row.reviewed_demo_count>=1).length;
  const accepted=rows.filter(row=>row.passed_role_count>=1&&row.blocked_or_failed_count===0).length;
  const evidences=total?Math.round(100*(total+prepared+media+accepted)/(4*total)):0;
  const submit=async()=>{
    if(!current||!testedUser||evidence.trim().length<20)return;
    try{
      await record.mutateAsync({
        lessonId:current.lesson_id,testedUserId:testedUser,outcome,evidenceNote:evidence.trim()
      });
      setEvidence("");setTestedUser("");
      toast.success("Genuine workflow acceptance result recorded and retained for audit.");
    }catch(e){toast.error(e instanceof Error?e.message:"Cannot record this evidence.");}
  };
  return <MainLayout title="Academy — Workspace Training Readiness"
    subtitle="Administrator view of authored content, live instructional media, assessments, and independently verified staff workflows.">
    <div className="mx-auto max-w-6xl space-y-5">
      <Card><CardContent className="flex flex-wrap gap-3 items-center p-5">
        <ShieldCheck className="h-7 w-7 text-primary"/>
        <div className="min-w-64 flex-1">
          <h2 className="font-semibold">Evidence-based implementation control</h2>
          <p className="text-sm text-muted-foreground">A deployment or an authored lesson is not proof that staff can use it. This report keeps missing recordings and final staff acceptance visible. An independent administrator may later record a real tested colleague's workflow result, but no tests are created by deployment.</p>
        </div>
        <Button asChild size="sm" variant="outline"><Link to="/learning">Return to Academy</Link></Button>
      </CardContent></Card>
      {!roleLoading&&!authorized&&<Card><CardContent className="p-6 text-sm text-destructive">
        Academy implementation metrics and staff acceptance evidence require an authorized HPG administrator.
      </CardContent></Card>}
      {authorized&&<>
        {(report.isLoading||roster.isLoading)&&<p className="text-sm text-muted-foreground">Loading verified readiness evidence…</p>}
        {(report.error||roster.error)&&<p className="text-sm text-destructive" role="alert">
          Readiness reports are not available. Check the Academy database migration and your administrator permissions.
        </p>}
        {report.data&&<div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Authored lessons",total,"Database curriculum"],
              ["Assessment coverage",prepared,"Five or more knowledge questions"],
              ["Reviewed screen recordings",media,"At least one approved demonstration per lesson"],
              ["Lessons with staff-role acceptance",accepted,"At least one independently reviewed role test"]
            ].map(([label,count,sub])=><Card key={String(label)}><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-3xl font-semibold">{count}</p>
              <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
            </CardContent></Card>)}
          </div>
          <Card><CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Content and evidence gates</p>
              <Badge variant="outline">{evidences}% documented</Badge>
            </div>
            <Progress value={evidences}/>
            <p className="text-xs text-muted-foreground">
              This percentage measures four evidence categories per lesson, not operational certification. Final acceptance also requires each relevant role, supported recording, real screen functionality and department-specific authorization to be checked. Never interpret partial coverage as readiness to launch all training.
            </p>
            {accepted<total&&<p className="text-sm text-amber-700 dark:text-amber-300">
              <CircleAlert className="mr-1 inline h-4 w-4"/>Final signed staff acceptance is still incomplete. Personal role verification remains deferred until the last phase.
            </p>}
          </CardContent></Card>
          <div className="grid gap-4 lg:grid-cols-[minmax(340px,1.15fr)_minmax(280px,1fr)]">
            <Card><CardHeader><CardTitle className="text-lg">Lesson evidence register</CardTitle>
              <CardDescription>Choose a lesson to inspect its actual assessment, media and role-test coverage.</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/>
                  <Input aria-label="Find authored lesson" className="pl-9" value={filter}
                    onChange={e=>setFilter(e.target.value)} placeholder="Filter by lesson or department"/>
                </div>
                <div className="max-h-[640px] space-y-2 overflow-y-auto">
                  {matches.map(row=><button type="button" key={row.lesson_id}
                    onClick={()=>{setChosen(row.lesson_id);setTestedUser("");setEvidence("");}}
                    className={"w-full rounded-lg border p-3 text-left hover:bg-muted/30 "+
                      (chosen===row.lesson_id?"border-primary bg-primary/5":"")}>
                    <p className="font-medium text-sm">{row.lesson_title}</p>
                    <p className="text-xs text-muted-foreground">{nice(row.track_id)}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">{row.question_count} questions</Badge>
                      <Badge variant={row.reviewed_demo_count?"secondary":"outline"}>{row.reviewed_demo_count} recordings</Badge>
                      <Badge variant={row.passed_role_count?"secondary":"outline"}>{row.passed_role_count} roles passed</Badge>
                      {row.blocked_or_failed_count>0&&<Badge variant="destructive">{row.blocked_or_failed_count} unresolved role results</Badge>}
                    </div>
                  </button>)}
                  {matches.length===0&&<p className="text-sm text-muted-foreground">No authored lessons match.</p>}
                </div>
              </CardContent></Card>
            <div className="space-y-4">
              <Card><CardHeader><CardTitle className="text-lg">{current?.lesson_title||"Select a lesson"}</CardTitle>
                <CardDescription>{current?"Verified evidence and remaining conditions":"Select a lesson from the register to see its readiness."}</CardDescription></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {current&&<>
                    <p><CheckCircle2 className="mr-2 inline h-4 w-4 text-primary"/>Authored in the central Academy curriculum</p>
                    <p><Award className="mr-2 inline h-4 w-4"/>Track questions: {current.question_count} — {current.question_count>=5?"formative assessment available":"additional question bank required"}</p>
                    <p><Film className="mr-2 inline h-4 w-4"/>Approved demonstrations: {current.reviewed_demo_count}</p>
                    <p><ClipboardCheck className="mr-2 inline h-4 w-4"/>Independently accepted role tests: {current.passed_role_count} of {current.tested_role_count} recorded roles</p>
                    <p className="text-xs text-muted-foreground">Most recent verification: {format(current.last_role_review_at)}</p>
                    <p className="text-xs text-muted-foreground">Every relevant staff-role workflow must ultimately be tested. A single result cannot establish unrestricted coverage.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild><Link to={"/learning?track="+current.track_id+"&lesson="+current.lesson_id}>Open lesson</Link></Button>
                      <Button size="sm" variant="outline" asChild><Link to="/learning/studio">Produce reviewed demonstration</Link></Button>
                    </div>
                  </>}
                </CardContent></Card>
              {current&&<Card><CardHeader><CardTitle className="text-base">Final-phase staff acceptance</CardTitle>
                <CardDescription>Use only after a real approved colleague has performed the assigned workflow. Recorded results are immutable audit entries; correcting a result requires a later entry.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1"><Label>Colleague who actually tested the workflow</Label>
                    <Select value={testedUser} onValueChange={setTestedUser}>
                      <SelectTrigger><SelectValue placeholder="Select an approved colleague"/></SelectTrigger>
                      <SelectContent>{(roster.data||[]).map(person=><SelectItem value={person.user_id} key={person.user_id}>
                        {person.full_name} · {nice(person.role)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Test outcome</Label>
                    <Select value={outcome} onValueChange={v=>setOutcome(v as typeof outcome)}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="passed">Passed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="blocked">Blocked</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Observed evidence (20+ characters)</Label>
                    <Textarea rows={4} value={evidence} onChange={e=>setEvidence(e.target.value)}
                      placeholder="Describe the actual task, role, authorized test environment, outcome, and supporting evidence."/>
                  </div>
                  <Button disabled={record.isPending||!testedUser||evidence.trim().length<20} onClick={submit}>
                    {record.isPending?"Recording…":"Record a genuine role-test result"}
                  </Button>
                </CardContent></Card>}
            </div>
          </div>
        </div>}
      </>}
    </div>
  </MainLayout>;
}
