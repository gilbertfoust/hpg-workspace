import { useEffect,useMemo,useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen,Languages,ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole,isAdminRole } from "@/hooks/useUserRole";
import { tracks } from "@/data/academyCoreTracks";
import { useAcademyLessonTranslations,useAcademyTranslationAdministration,type AcademyLanguage } from "@/hooks/useAcademyTranslations";
import { supportedAcademyLanguages } from "@/lib/academyLocalization";

const supported=["fr","es","pt"] as const;
export default function AcademyTranslationEditor(){
  const {user}=useAuth();
  const {data:role,isLoading}=useUserRole();
  const admin=isAdminRole(role?.role);
  const lessons=useMemo(()=>tracks.flatMap(track=>track.lessons.map(lesson=>({...lesson,track:track.title}))),[]);
  const [lessonId,setLessonId]=useState("welcome");
  const [language,setLanguage]=useState<"fr"|"es"|"pt">("fr");
  const [title,setTitle]=useState("");
  const [objective,setObjective]=useState("");
  const [steps,setSteps]=useState<string[]>([]);
  const [practice,setPractice]=useState("");
  const [dirty,setDirty]=useState(false);
  const selected=lessons.find(x=>x.id===lessonId)||lessons[0];
  const {data:records,isLoading:loading,error}=useAcademyLessonTranslations(lessonId);
  const actions=useAcademyTranslationAdministration(lessonId);
  const found=(records||[]).find(x=>x.language_code===language);
  useEffect(()=>{
    setTitle(found?.translated_title||"");
    setObjective(found?.translated_objective||"");
    setSteps(found?.translated_steps||selected.steps.map(()=>""));
    setPractice(found?.translated_practice||"");
    setDirty(false);
  },[found?.version,found?.language_code,selected.id,language]); // eslint-disable-line react-hooks/exhaustive-deps
  const setStep=(i:number,term:string)=>{setSteps(previous=>previous.map((s,j)=>j===i?term:s));setDirty(true);};
  const complete=title.trim().length>=5&&objective.trim().length>=20&&practice.trim().length>=20
    &&steps.length===selected.steps.length&&steps.every(x=>x.trim().length>=5);
  const save=async()=>{
    try{await actions.save.mutateAsync({language,title,objective,steps,practice});
      toast.success("Translation saved as a private draft for another administrator's review.");}
    catch(e){toast.error(e instanceof Error?e.message:"Could not save the translation.");}
  };
  const review=async(action:"publish"|"withdraw")=>{
    try{await actions.review.mutateAsync({language,action});
      toast.success("Translation review recorded and version history retained.");}
    catch(e){toast.error(e instanceof Error?e.message:"Translation review was not permitted.");}
  };
  return <MainLayout title="Academy — Multilingual Curriculum Review"
    subtitle="Language fidelity, source context and independent publication controls for French, Spanish and Portuguese lessons.">
    <div className="mx-auto max-w-6xl space-y-4">
      <Card><CardContent className="flex flex-wrap items-center gap-3 p-5">
        <Languages className="h-8 w-8 text-primary"/>
        <div className="min-w-64 flex-1">
          <h2 className="font-semibold">Translate from the actual English lesson</h2>
          <p className="text-sm text-muted-foreground">Translate every instruction without changing HPG's approval, financial, consent or security obligations. Only independently reviewed translations appear to learners. Drafts are never counted as published translations.</p>
        </div><Button variant="outline" asChild><Link to="/learning"><BookOpen className="mr-2 h-4 w-4"/>Academy</Link></Button>
      </CardContent></Card>
      {!isLoading&&!admin&&<p className="text-sm text-destructive">Curriculum translation authoring is restricted to authorized Academy administrators.</p>}
      {admin&&<div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card><CardHeader><CardTitle className="text-lg">English source — authoritative</CardTitle>
          <CardDescription>Do not translate personal information or secrets; use only approved instruction text.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Label>Lesson</Label>
            <Select value={lessonId} onValueChange={setLessonId}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{lessons.map(x=><SelectItem key={x.id} value={x.id}>{x.track} — {x.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="rounded-lg bg-muted/30 p-4 text-sm">
              <p className="font-semibold">{selected.name}</p>
              <p className="mt-2"><strong>Goal:</strong> {selected.goal}</p>
              <ol className="mt-2 list-decimal space-y-2 pl-5">
                {selected.steps.map((item,i)=><li key={i}>{item}</li>)}
              </ol>
              <p className="mt-2"><strong>Practice:</strong> {selected.practice}</p>
            </div>
          </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-lg">Reviewed target-language lesson</CardTitle>
          <CardDescription>Maintain the same number and meaning of procedural steps. Translation accuracy requires a second reviewer.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Label>Target language</Label>
            <Select value={language} onValueChange={x=>setLanguage(x as typeof language)}>
              <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
                {supported.map(code=><SelectItem key={code} value={code}>
                  {supportedAcademyLanguages.find(x=>x.code===(code as AcademyLanguage))?.name}</SelectItem>)}
              </SelectContent></Select>
            {loading&&<p className="text-xs text-muted-foreground">Loading existing translation revision…</p>}
            {error&&<p className="text-sm text-destructive" role="alert">Translation details could not be loaded.</p>}
            <div className="flex flex-wrap gap-2">
              <Badge variant={found?.status==="reviewed"?"secondary":"outline"}>
                {found?.status||"not translated"}</Badge>
              {found&&<Badge variant="outline">Version {found.version}</Badge>}
            </div>
            <div className="space-y-1"><Label>Translated title</Label><Input value={title}
              onChange={e=>{setTitle(e.target.value);setDirty(true);}}/></div>
            <div className="space-y-1"><Label>Translated objective</Label><Textarea rows={3} value={objective}
              onChange={e=>{setObjective(e.target.value);setDirty(true);}}/></div>
            {selected.steps.map((_,i)=><div key={i} className="space-y-1">
              <Label>Translated step {i+1} of {selected.steps.length}</Label>
              <Textarea rows={3} value={steps[i]||""} onChange={e=>setStep(i,e.target.value)}/></div>)}
            <div className="space-y-1"><Label>Translated practice check</Label><Textarea rows={3} value={practice}
              onChange={e=>{setPractice(e.target.value);setDirty(true);}}/></div>
            <Button disabled={actions.save.isPending||!complete||!dirty} onClick={save}>Save private translation draft</Button>
            {found?.status==="draft"&&<Button variant="outline"
              disabled={actions.review.isPending||found.authored_by===user?.id}
              title={found.authored_by===user?.id?"A separate authorized administrator must review the translation.":undefined}
              onClick={()=>review("publish")}>
              <ShieldCheck className="mr-2 h-4 w-4"/>Independently approve translation
            </Button>}
            {found?.status==="reviewed"&&<Button variant="outline"
              disabled={actions.review.isPending} onClick={()=>review("withdraw")}>Withdraw reviewed translation</Button>}
            <p className="text-xs text-muted-foreground">
              Until approved, learners receive the unchanged English source with a language-fallback notice. A draft is not a published French, Spanish, or Portuguese lesson.
            </p>
          </CardContent></Card>
      </div>}
    </div>
  </MainLayout>;
}
