import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpenCheck, CheckCircle2, ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { canAccessArea } from "@/lib/accessControl";
import { useAcademyProgress } from "@/hooks/useAcademyProgress";
import { tracks } from "@/data/academyCoreTracks";
import { useAcademyLessonTranslations } from "@/hooks/useAcademyTranslations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

/** In-screen tutorial for the page a learner actually visits. This overlay
 * does not simulate clicking buttons or modify operational records. Staff
 * decide when to perform each permitted action; learner completion is explicit.
 */
export default function AcademyScreenGuide() {
  const location=useLocation();
  const [params,setParams]=useSearchParams();
  const {data:role,isLoading:roleLoading}=useUserRole();
  const academy=useAcademyProgress();
  const lessonId=params.get("academyLesson");
  const language=params.get("academyLanguage")||"en";
  const [step,setStep]=useState(0);
  const [collapsed,setCollapsed]=useState(false);
  const match=useMemo(()=>{
    for(const track of tracks){
      const lesson=track.lessons.find(item=>item.id===lessonId);
      if(lesson)return {track,lesson};
    }
    return null;
  },[lessonId]);
  const translated=useAcademyLessonTranslations(match?.lesson.id);
  const possible=translated.data?.find(t=>t.language_code===language&&t.status==="reviewed");
  const verified=possible&&possible.translated_steps.length===match?.lesson.steps.length?possible:null;
  useEffect(()=>{setStep(0);setCollapsed(false);},[lessonId,language]);
  if(!lessonId||roleLoading||!match||match.lesson.path!==location.pathname)return null;
  if(match.lesson.area&&!canAccessArea(role?.role,match.lesson.area,role))return null;
  const {track,lesson}=match;
  const instructions=verified?.translated_steps||lesson.steps;
  const displayedTitle=verified?.translated_title||lesson.name;
  const displayedGoal=verified?.translated_objective||lesson.goal;
  const displayedPractice=verified?.translated_practice||lesson.practice;
  const current=Math.max(0,Math.min(step,instructions.length-1));
  const isFinal=current===instructions.length-1;
  const done=(academy.progress.data||[]).some(p=>p.lesson_id===lesson.id);
  const returnUrl="/learning?track="+encodeURIComponent(track.id)+"&lesson="+encodeURIComponent(lesson.id)+"&academyLanguage="+language;
  const exit=()=>{const next=new URLSearchParams(params);next.delete("academyLesson");next.delete("academyLanguage");setParams(next,{replace:true});};
  const save=async()=>{
    if(done||!academy.progress.isSuccess)return;
    try{
      await academy.mark.mutateAsync(lesson.id);
      toast.success("Practice completion saved to your HPG account.");
    }catch(e){toast.error(e instanceof Error?e.message:"Could not save your completion.");}
  };
  return <aside aria-label="Guided Workspace Training" className="fixed bottom-3 right-3 z-[80] w-[calc(100vw-1.5rem)] max-w-md rounded-xl border bg-background p-4 shadow-2xl sm:bottom-5 sm:right-5">
    <div className="flex items-center gap-2">
      <BookOpenCheck className="h-5 w-5 text-primary"/>
      <span className="min-w-0 flex-1 text-sm font-semibold">Workspace Training · Live guidance</span>
      <Badge variant="secondary">Step {current+1}/{instructions.length}</Badge>
      <Button type="button" size="icon" variant="ghost" aria-label={collapsed?"Expand training guide":"Collapse training guide"}
        onClick={()=>setCollapsed(x=>!x)}>{collapsed?<ChevronUp className="h-4 w-4"/>:<ChevronDown className="h-4 w-4"/>}</Button>
      <Button type="button" size="icon" variant="ghost" aria-label="Close training guide" onClick={exit}>
        <X className="h-4 w-4"/>
      </Button>
    </div>
    {!collapsed&&<div className="mt-3 space-y-4">
      <div><p className="text-xs text-muted-foreground">{track.title}</p>
        <h2 lang={verified?language:"en"} className="font-semibold">{displayedTitle}</h2>
        <p lang={verified?language:"en"} className="mt-1 text-xs text-muted-foreground">{displayedGoal}</p>
      </div>
      {language!=="en"&&!verified&&<p className="text-xs text-amber-700 dark:text-amber-300">
        No approved {language.toUpperCase()} translation yet; displaying the original English instructions.
      </p>}
      <Progress value={100*(current+1)/Math.max(1,instructions.length)}/>
      <div aria-live="polite" className="max-h-[36vh] overflow-y-auto rounded-lg bg-muted/40 p-4 text-sm leading-relaxed">
        <span lang={verified?language:"en"}>{instructions[current]}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        This guide does not alter HPG records. Follow only actions authorized for your role; never create fictitious projects, approvals, votes or payments.
      </p>
      {isFinal&&<div className="rounded-md border p-3 text-xs">
        <p className="font-semibold">Practice check</p><p lang={verified?language:"en"} className="mt-1">{displayedPractice}</p>
      </div>}
      <div className="flex flex-wrap gap-2 items-center">
        <Button size="sm" variant="outline" disabled={current===0} onClick={()=>setStep(x=>Math.max(0,x-1))}>
          <ArrowLeft className="mr-1 h-4 w-4"/>Previous
        </Button>
        {!isFinal?<Button size="sm" onClick={()=>setStep(x=>Math.min(instructions.length-1,x+1))}>
          Next<ArrowRight className="ml-1 h-4 w-4"/></Button>:
          <Button size="sm" disabled={done||academy.mark.isPending||!academy.progress.isSuccess} onClick={save}>
            <CheckCircle2 className="mr-1 h-4 w-4"/>{done?"Already self-reported":"I completed this practice"}
          </Button>
        }
        <Button size="sm" variant="link" className="ml-auto" asChild>
          <Link to={returnUrl}>Return to Academy</Link>
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Completion is self-reported orientation only. Formal knowledge checks and supervisor review remain separate.</p>
    </div>}
  </aside>;
}
