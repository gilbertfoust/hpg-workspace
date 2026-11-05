import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { ensureSupabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, CheckCircle2, ClipboardCheck, LockKeyhole, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  useAcademyAssessments, useAssessmentPaper, useAssessmentAttempts,
  useSubmitAssessment, type AssessmentResult,
} from "@/hooks/useAcademyAssessments";

const pretty = (s: string) => s.replaceAll("_"," ").replace(/\b\w/g,ch=>ch.toUpperCase());
const errorText = (e: unknown) => e instanceof Error ? e.message : "Assessment could not be processed.";

export default function AcademyAssessments() {
  const {user}=useAuth();
  const boardEligibility=useQuery({
    queryKey:["academy-board-quiz-eligibility",user?.id],
    enabled:!!user?.id,retry:false,
    queryFn:async()=>{
      const result=await ensureSupabase().rpc("can_read_bod_meetings" as never);
      return !result.error && result.data === true;
    }
  });
  const catalog=useAcademyAssessments();
  const attempts=useAssessmentAttempts();
  const submit=useSubmitAssessment();
  const [selected,setSelected]=useState<string | undefined>();
  const paper=useAssessmentPaper(selected);
  const [answers,setAnswers]=useState<Record<string,number>>({});
  const [result,setResult]=useState<AssessmentResult | null>(null);
  const list=useMemo(()=>(catalog.data||[]).filter(item=>item.assessment_id!=="board"||boardEligibility.data===true),[catalog.data,boardEligibility.data]);
  const selectedCount=paper.data?.questions.filter(q=>answers[q.id]!==undefined).length||0;
  const total=paper.data?.questions.length||0;
  const latest=(id:string)=>(attempts.data||[]).find(a=>a.assessment_id===id);
  const choose=(id:string)=>{
    setSelected(id);setAnswers({});setResult(null);
  };
  const grade=async()=>{
    if(!selected||selectedCount!==total||total===0)return;
    try {
      const output=await submit.mutateAsync({id:selected,answers});
      setResult(output);
      toast.success("Knowledge check recorded on your HPG account.");
    } catch(e){toast.error(errorText(e));}
  };
  return <MainLayout title="Learning Academy — Knowledge Checks"
    subtitle="Role-related scenario questions with private answer keys and account-based results.">
    <div className="mx-auto max-w-5xl space-y-5">
      <Card><CardContent className="flex flex-wrap items-center gap-3 p-5">
        <ClipboardCheck className="h-7 w-7 text-primary"/>
        <div className="min-w-64 flex-1">
          <h2 className="font-semibold">Practice assessments</h2>
          <p className="text-sm text-muted-foreground">Questions measure understanding of documented HPG procedures. Passing is not a professional certification or independent demonstration of job performance. A supervisor may separately record an evidence-based endorsement.</p>
        </div>
        <Button variant="outline" size="sm" asChild><Link to="/learning"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Academy</Link></Button>
      </CardContent></Card>
      {(catalog.error||attempts.error)&&<p role="alert" className="text-sm text-destructive">Assessments are unavailable for this account: {errorText(catalog.error||attempts.error)}.</p>}
      {catalog.isLoading&&<p className="text-sm text-muted-foreground">Checking eligible learning tracks…</p>}
      {!selected ? <div className="grid gap-3 sm:grid-cols-2">
        {list.map(item=><Card key={item.assessment_id}><CardHeader>
          <CardTitle className="text-lg">{item.title}</CardTitle>
          <CardDescription>Learning path: {pretty(item.track_id)} · Passing threshold {item.passing_percent}%</CardDescription>
        </CardHeader><CardContent className="space-y-3">
          {latest(item.assessment_id) && <div className="flex flex-wrap gap-2 items-center">
            <Badge variant={latest(item.assessment_id)?.passed?"default":"outline"}>{latest(item.assessment_id)?.passed?"Latest attempt passed":"More practice needed"}</Badge>
            <span className="text-xs text-muted-foreground">Latest score: {latest(item.assessment_id)?.score}/{latest(item.assessment_id)?.total}</span>
          </div>}
          <Button variant="outline" size="sm" onClick={()=>choose(item.assessment_id)}>
            <BookOpen className="mr-2 h-4 w-4"/>{latest(item.assessment_id)?"Review / retry knowledge check":"Start knowledge check"}
          </Button>
        </CardContent></Card>)}
      </div> : <Card>
        <CardHeader>
          <Button variant="ghost" size="sm" className="w-fit px-0" onClick={()=>{setSelected(undefined);setResult(null);setAnswers({});}}>
            <ArrowLeft className="mr-2 h-4 w-4"/>All assessments
          </Button>
          <CardTitle>{paper.data?.title||"Knowledge check"}</CardTitle>
          <CardDescription>Responses are scored on the server. They are visible in your own history; supervisors see scores and endorsements but not your individual response selections.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {paper.isLoading&&<p className="text-sm text-muted-foreground">Loading private question paper…</p>}
          {paper.error&&<p role="alert" className="text-sm text-destructive">{errorText(paper.error)}</p>}
          {paper.data&& !result &&<>
            <div className="flex items-center gap-3">
              <Progress value={total?100*selectedCount/total:0} className="max-w-xs"/>
              <span className="whitespace-nowrap text-sm text-muted-foreground">{selectedCount} of {total} answered</span>
            </div>
            {paper.data.questions.map((q,index)=><fieldset key={q.id} className="space-y-4 rounded-lg border p-5">
              <legend className="px-2 text-sm font-semibold">Question {index+1} of {total}</legend>
              <p className="font-medium">{q.prompt}</p>
              <RadioGroup value={answers[q.id]===undefined?"":String(answers[q.id])}
                onValueChange={value=>setAnswers(prev=>({...prev,[q.id]:Number(value)}))} className="space-y-3">
                {q.options.map((option,i)=><div key={i} className="flex items-start gap-2 rounded-lg p-2 hover:bg-muted/40">
                  <RadioGroupItem value={String(i)} id={q.id+"-"+i}/>
                  <Label htmlFor={q.id+"-"+i} className="flex-1 cursor-pointer font-normal leading-relaxed">{option}</Label>
                </div>)}
              </RadioGroup>
            </fieldset>)}
            <Button disabled={submit.isPending||selectedCount!==total||!total} onClick={grade}>
              {submit.isPending?"Evaluating…":"Submit knowledge check"}
            </Button>
          </>}
          {result&&<div className="space-y-4 rounded-lg border p-6">
            <div className="flex items-center gap-2">
              {result.passed?<CheckCircle2 className="h-6 w-6 text-primary"/>:<LockKeyhole className="h-6 w-6 text-muted-foreground"/>}
              <h3 className="text-lg font-semibold">{result.passed?"Practice knowledge check passed":"Additional review recommended"}</h3>
            </div>
            <p className="text-2xl font-semibold">{result.score} / {result.total} correct — {result.percent}%</p>
            <p className="text-sm text-muted-foreground">Your result is saved. A passing knowledge check alone does not constitute manager sign-off, independent skill verification, or HR certification.</p>
            <Button variant="outline" onClick={()=>{setResult(null);setAnswers({});}}><RotateCcw className="mr-2 h-4 w-4"/>Practice again</Button>
          </div>}
        </CardContent>
      </Card>}
    </div>
  </MainLayout>;
}
