import { useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen,ClipboardList,RefreshCcw,Users,ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { useUserRole,isAdminRole } from "@/hooks/useUserRole";
import { useAcademyTeamProgress } from "@/hooks/useAcademyProgress";
import { useMyAcademyPlan,useAcademyCourseSyllabi,useAcademyTeamCourseAssignments,useAcademyPathwayAdministration } from "@/hooks/useAcademyLearningPlans";

const fmt=(d:string|null)=>d?new Date(d).toLocaleDateString():"Not specified";
const why=(e:unknown)=>e instanceof Error?e.message:"Could not update the learning plan.";
export default function AcademyLearningPlan(){
  const {data:role}=useUserRole();
  const admin=isAdminRole(role?.role);
  const internal=!!role?.role&&!["external_ngo","external_portal","ngo_user","board"].includes(role.role);
  const {plan,refresh}=useMyAcademyPlan();
  const courses=useAcademyCourseSyllabi();
  const team=useAcademyTeamCourseAssignments(internal);
  const people=useAcademyTeamProgress(internal);
  const controls=useAcademyPathwayAdministration();
  const [selectedUser,setSelectedUser]=useState("");
  const [track,setTrack]=useState("start");
  const [state,setState]=useState<"assigned"|"paused"|"removed">("assigned");
  const [required,setRequired]=useState(true);
  const [dueDate,setDueDate]=useState("");
  const plans=useMemo(()=>plan.data||[],[plan.data]);
  const activePlans=plans.filter(p=>p.status==="assigned");
  const selectedCourse=courses.data?.find(c=>c.track_id===track);
  const targetAssignments=(team.data||[]).filter(row=>row.user_id===selectedUser);
  const peopleOptions=(people.data||[]).filter(p=>p.role!=="external_ngo");
  const assign=async()=>{
    if(!selectedUser)return;
    try{
      await controls.assign.mutateAsync({userId:selectedUser,trackId:track,state,required,
        dueAt:dueDate?new Date(dueDate+"T17:00:00").toISOString():null});
      toast.success("Audited Academy assignment saved. No underlying module permissions were changed.");
    }catch(e){toast.error(why(e));}
  };
  const refreshSelf=async()=>{
    try{await refresh.mutateAsync();toast.success("Learning paths synchronized from your approved profile.");}
    catch(e){toast.error(why(e));}
  };
  return <MainLayout title="My HPG Academy Learning Path"
    subtitle="Role-based Workspace Training assigned from your actual HPG profile, not from self-selected privileges.">
    <div className="mx-auto max-w-6xl space-y-5">
      <Card><CardContent className="flex flex-wrap items-center gap-3 p-5">
        <ClipboardList className="h-8 w-8 text-primary"/>
        <div className="min-w-60 flex-1">
          <h2 className="font-semibold">Your assigned internal learning pathway</h2>
          <p className="text-sm text-muted-foreground">Training tracks are assigned from your approved position, department and authorized administrator changes. An assignment does not provide access to a restricted module and is not a professional credential.</p>
        </div>
        <Button variant="outline" size="sm" disabled={refresh.isPending} onClick={refreshSelf}>
          <RefreshCcw className="mr-2 h-4 w-4"/>Refresh from staff profile</Button>
        <Button variant="outline" size="sm" asChild><Link to="/learning"><BookOpen className="mr-2 h-4 w-4"/>Academy lessons</Link></Button>
      </CardContent></Card>
      {plan.isLoading&&<p className="text-sm text-muted-foreground">Loading your learning plan…</p>}
      {plan.error&&<Card><CardContent className="p-4 text-sm text-destructive" role="alert">Your internal learning plan is unavailable. Only active, approved HPG staff and Board learners may view this path.</CardContent></Card>}
      {!plan.error&&activePlans.length===0&&!plan.isLoading&&<Card><CardContent className="p-4 text-sm text-muted-foreground">
        No current internal Workspace Training assignments are recorded for this account.
      </CardContent></Card>}
      <div className="grid gap-3 md:grid-cols-2">
        {activePlans.map((p,i)=>{
          const fraction=p.lesson_count?Math.round(100*p.completed_count/p.lesson_count):0;
          const syllabus=courses.data?.find(c=>c.track_id===p.track_id);
          const prerequisites=(syllabus?.prerequisite_tracks||[]).filter(id=>
            !plans.find(row=>row.track_id===id&&row.passed_exam));
          return <Card key={p.track_id} className="h-full"><CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={p.required?"default":"outline"}>{p.required?"Required internal learning":"Optional learning"}</Badge>
              <Badge variant="secondary">{p.source==="automatic"?"Assigned by role":"Admin assignment"}</Badge>
            </div><CardTitle className="text-lg">{i+1}. {p.title}</CardTitle>
            <CardDescription>{syllabus?.overview||"An HPG internal learning pathway."}</CardDescription>
          </CardHeader><CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs"><span>Self-reported lessons</span>
              <span>{p.completed_count}/{p.lesson_count}</span></div><Progress value={fraction}/>
            <div className="flex flex-wrap gap-2">
              <Badge variant={p.passed_exam?"secondary":"outline"}>
                {p.passed_exam?"Assessment passed":"Assessment not passed"}</Badge>
              <Badge variant={p.supervisor_endorsed?"secondary":"outline"}>
                {p.supervisor_endorsed?"Supervisor endorsed":"Sign-off pending"}</Badge>
            </div>
            {syllabus&&<p className="text-xs text-muted-foreground">
              Provisional reading and practice: {syllabus.provisional_minutes} min · Course document: {syllabus.status}.
            </p>}
            <p className="text-xs text-muted-foreground">Due date: {fmt(p.due_at)}</p>
            {!!prerequisites.length&&<p className="text-xs text-amber-700 dark:text-amber-300">
              Recommended prerequisite assessments: {prerequisites.join(", ")}. Other module permissions still apply.
            </p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild><Link to={"/learning?track="+encodeURIComponent(p.track_id)}>
                Open this course</Link></Button>
              <Button size="sm" variant="outline" asChild><Link to={"/learning/assessments?assessment="+encodeURIComponent(p.track_id)}>
                Knowledge check</Link></Button>
            </div>
          </CardContent></Card>;
        })}
      </div>
      {internal&&<Card><CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>Authorized team learning assignments</CardTitle>
        <CardDescription>{admin?"All active internal cohorts are visible to administrators.":"Only colleagues who directly report to you are included."}</CardDescription>
      </CardHeader><CardContent className="space-y-3">
        {team.error&&<p role="alert" className="text-sm text-destructive">Your current role does not authorize access to the team assignment roster.</p>}
        {(team.data||[]).length===0?<p className="text-sm text-muted-foreground">No directly supervised assignments are available.</p>:
        <div className="max-h-96 space-y-2 overflow-auto">
          {(team.data||[]).map(row=><div key={row.user_id+":"+row.track_id} className="rounded-md border p-3 text-sm">
            <span className="font-semibold">{row.full_name}</span> · {row.track_title}
            <span className="ml-2 text-xs text-muted-foreground">({row.source} · {row.required?"required":"optional"} · due {fmt(row.due_at)})</span>
          </div>)}
        </div>}
      </CardContent></Card>}
      {admin&&<Card><CardHeader>
        <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>Administrator course assignment</CardTitle>
        <CardDescription>Explicitly add, pause, or withdraw one internal learning assignment. The event is audited and no HPG account permissions, assessment score, or staff promotion changes.</CardDescription>
      </CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Approved internal colleague</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}><SelectTrigger><SelectValue placeholder="Select colleague"/></SelectTrigger>
              <SelectContent>{peopleOptions.map(p=><SelectItem key={p.user_id} value={p.user_id}>{p.full_name} · {p.role}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Workspace Training course</Label>
            <Select value={track} onValueChange={setTrack}><SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{(courses.data||[]).map(c=><SelectItem key={c.track_id} value={c.track_id}>
                {c.track_id.toUpperCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Assignment state</Label>
            <Select value={state} onValueChange={v=>setState(v as typeof state)}>
              <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                <SelectItem value="assigned">Assign / reactivate</SelectItem>
                <SelectItem value="paused">Pause</SelectItem>
                <SelectItem value="removed">Withdraw</SelectItem>
              </SelectContent></Select>
          </div>
          <div className="space-y-1"><Label>Optional due date</Label>
            <Input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)}/>
          This is required internal training (not formal certification).
        </label>
        {selectedCourse&&<p className="text-xs text-muted-foreground">
          {selectedCourse.overview} · The administrator's assignment cannot grant module access.
        </p>}
        {!!targetAssignments.length&&<p className="text-xs text-muted-foreground">
          Current assigned tracks for this colleague: {targetAssignments.map(x=>x.track_id).join(", ")}.
        </p>}
        <Button disabled={!selectedUser||controls.assign.isPending} onClick={assign}>
          {controls.assign.isPending?"Saving…":"Save audited assignment"}
        </Button>
        <div><Button variant="link" className="px-0" asChild>
          <Link to="/learning/curriculum">Edit course objectives and lesson standards</Link>
        </Button></div>
      </CardContent></Card>}
    </div>
  </MainLayout>;
}
