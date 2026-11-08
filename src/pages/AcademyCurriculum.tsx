import { useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen,CheckCircle2,FileText,ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { useUserRole,isAdminRole } from "@/hooks/useUserRole";
import { useAcademyCourseSyllabi,useAcademyLessonStandards,useAcademyPathwayAdministration } from "@/hooks/useAcademyLearningPlans";
import { tracks } from "@/data/academyCoreTracks";
const getLessonList=()=>tracks.flatMap(track=>track.lessons.map(lesson=>({...lesson,track:track.title,track_id:track.id})));
const splitList=(raw:string)=>raw.split(/\n|,/).map(x=>x.trim()).filter(Boolean);
export default function AcademyCurriculum(){
  const {data:role,isLoading:roleLoading}=useUserRole();
  const admin=isAdminRole(role?.role);
  const syllabi=useAcademyCourseSyllabi();
  const standards=useAcademyLessonStandards();
  const controls=useAcademyPathwayAdministration();
  const all=useMemo(getLessonList,[]);
  const [track,setTrack]=useState("start");
  const [lessonId,setLessonId]=useState("welcome");
  const [goal,setGoal]=useState("");
  const [evidence,setEvidence]=useState("");
  const [minutes,setMinutes]=useState(20);
  const [prerequisites,setPrerequisites]=useState("");
  const [references,setReferences]=useState("");
  const [edited,setEdited]=useState(false);
  const lesson=all.find(x=>x.id===lessonId);
  const standard=standards.data?.find(x=>x.lesson_id===lessonId);
  const syllabus=syllabi.data?.find(x=>x.track_id===track);
  const lessons=all.filter(x=>x.track_id===track);
  const pending=(standards.data||[]).filter(x=>x.editorial_state!=="reviewed").length;
  const open=(id:string)=>{
    setLessonId(id);setEdited(false);
    const existing=standards.data?.find(x=>x.lesson_id===id);
    const source=all.find(x=>x.id===id);
    setGoal(existing?.objective||source?.goal||"");
    setEvidence(existing?.practice_evidence||source?.practice||"");
    setMinutes(existing?.planned_minutes||20);
    setPrerequisites((existing?.prerequisite_lessons||[]).join("\n"));
    setReferences((existing?.required_references||[]).join("\n"));
  };
  const useAuthored=()=>{
    if(!lesson)return;setGoal(lesson.goal);setEvidence(lesson.practice);setEdited(true);
  };
  const save=async(reviewed:boolean)=>{
    try{
      await controls.editLesson.mutateAsync({
        lessonId,objective:goal,practiceEvidence:evidence,
        minutes,prerequisiteLessons:splitList(prerequisites),
        references:splitList(references),reviewed
      });
      setEdited(false);toast.success(reviewed?"Lesson standard explicitly reviewed.":"Draft lesson standard saved without approval.");
    }catch(e){toast.error(e instanceof Error?e.message:"Could not save curriculum standard.");}
  };
  return <MainLayout title="Academy — Curriculum Architecture"
    subtitle="Standardized internal Workspace Training syllabi, learning outcomes and version-controlled lesson expectations.">
    <div className="mx-auto max-w-6xl space-y-5">
      <Card><CardContent className="flex flex-wrap gap-3 items-center p-5">
        <BookOpen className="h-8 w-8 text-primary"/>
        <div className="min-w-64 flex-1">
          <h2 className="font-semibold">Fifteen course syllabi, sixty authored lessons</h2>
          <p className="text-sm text-muted-foreground">Each syllabus states its outcomes, prerequisites, a provisional workload and a formative knowledge check. Lesson standards retain version and approval state; authored instruction is not automatically approved curriculum.</p>
        </div>
        <Button variant="outline" size="sm" asChild><Link to="/learning/plan">My learning plan</Link></Button>
      </CardContent></Card>
      {standards.data&&<p className="text-sm text-muted-foreground">
        <FileText className="mr-2 inline h-4 w-4"/>{standards.data.length} lesson standards recorded;
        {" "}{pending} still need content-editor review.
      </p>}
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit"><CardHeader><CardTitle className="text-lg">Courses</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(syllabi.data||[]).map(item=><button type="button" key={item.track_id}
              onClick={()=>{setTrack(item.track_id);const first=all.find(x=>x.track_id===item.track_id);if(first)open(first.id);}}
              className={"w-full rounded-lg border p-3 text-left text-sm hover:bg-muted/30 "+
                (track===item.track_id?"border-primary bg-primary/5":"")}>
              <span className="font-semibold">{item.track_id.toUpperCase()}</span>
              <span className="ml-2 text-xs text-muted-foreground">{item.provisional_minutes} min · {item.status}</span>
            </button>)}
          </CardContent></Card>
        <div className="space-y-4">
          {syllabus&&<Card><CardHeader><CardTitle className="text-lg">{syllabus.track_id.toUpperCase()} · Course overview</CardTitle>
            <CardDescription>{syllabus.overview}</CardDescription></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-semibold">Learning outcomes</p>
              <ul className="list-disc pl-5">{syllabus.learning_outcomes.map((outcome,i)=><li key={i}>{outcome}</li>)}</ul>
              <p className="text-xs text-muted-foreground">
                Prerequisite tracks: {syllabus.prerequisite_tracks.join(", ")||"None"} ·
                Assessment: {syllabus.assessment_id||"Not specified"} ·
                Course status: {syllabus.status} (not an externally recognized certificate).
              </p>
            </CardContent></Card>}
          <Card><CardHeader><CardTitle className="text-lg">Individual lesson standards</CardTitle>
            <CardDescription>Select a lesson to review the source-authored instructions and controlled curriculum record.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1"><Label>Lesson</Label><Select value={lessonId} onValueChange={open}>
                <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{lessons.map(item=>
                  <SelectItem value={item.id} key={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select></div>
              {lesson&&<div className="rounded-md bg-muted/35 p-3 text-sm">
                <p className="font-semibold">Original authored lesson — {lesson.name}</p>
                <p className="mt-2"><strong>Objective:</strong> {lesson.goal}</p>
                <p className="mt-1"><strong>Practice:</strong> {lesson.practice}</p>
                <ol className="mt-2 list-decimal pl-5">{lesson.steps.map((item,i)=><li key={i}>{item}</li>)}</ol>
              </div>}
              {standard&&<div className="flex flex-wrap items-center gap-2">
                <Badge variant={standard.editorial_state==="reviewed"?"secondary":"outline"}>
                  {standard.editorial_state==="reviewed"?"Editorially reviewed":"Editorial review pending"}
                </Badge><Badge variant="outline">Version {standard.version}</Badge>
                <p className="text-xs text-muted-foreground">{standard.planned_minutes} planned minutes</p>
              </div>}
              {!roleLoading&&!admin&&<div className="space-y-2 text-sm">
                <p><strong>Recorded objective:</strong> {standard?.objective||"Not yet recorded"}</p>
                <p><strong>Expected practice evidence:</strong> {standard?.practice_evidence||"Not yet recorded"}</p>
                <p className="text-muted-foreground">Only approved Academy curriculum administrators can modify standards.</p>
              </div>}
              {admin&&<div className="space-y-3 border-t pt-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Controlled lesson standard editor</h3>
                  <Button size="sm" variant="outline" onClick={useAuthored}>Use authored goal and practice as draft</Button>
                </div>
                <div className="space-y-1"><Label>Learning objective</Label>
                  <Textarea rows={3} value={goal||standard?.objective||""}
                    onChange={e=>{setGoal(e.target.value);setEdited(true);}}/></div>
                <div className="space-y-1"><Label>Required practice and expected evidence</Label>
                  <Textarea rows={3} value={evidence||standard?.practice_evidence||""}
                    onChange={e=>{setEvidence(e.target.value);setEdited(true);}}/></div>
                <div className="space-y-1"><Label>Estimated lesson duration (minutes)</Label>
                  <Input type="number" min={5} max={480} value={minutes}
                    onChange={e=>{setMinutes(Number(e.target.value));setEdited(true);}}/></div>
                <div className="space-y-1"><Label>Prerequisite lesson IDs (one per line)</Label>
                  <Textarea rows={2} value={prerequisites} onChange={e=>{setPrerequisites(e.target.value);setEdited(true);}}/></div>
                <div className="space-y-1"><Label>Required reference documents or links (one per line)</Label>
                  <Textarea rows={2} value={references} onChange={e=>{setReferences(e.target.value);setEdited(true);}}/></div>
                <p className="text-xs text-muted-foreground">Changes create a new audit version; reviewing a lesson here does not attest to staff competency or grant access.</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={controls.editLesson.isPending} onClick={()=>save(false)}>
                    Save as pending review</Button>
                  <Button size="sm" disabled={controls.editLesson.isPending||!edited} onClick={()=>save(true)}>
                    <CheckCircle2 className="mr-2 h-4 w-4"/>Approve lesson standard</Button>
                </div>
              </div>}
            </CardContent></Card>
        </div>
      </div>
    </div>
  </MainLayout>;
}
