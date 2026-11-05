import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, ShieldCheck } from "lucide-react";
import { useAcademySupervisorAssessments, useSignoffAssessment } from "@/hooks/useAcademyAssessments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const readable=(s:string)=>s.replaceAll("_"," ").replace(/\b\w/g,c=>c.toUpperCase());
export default function AcademySupervisorReview({ userId }: { userId: string }) {
  const reviews=useAcademySupervisorAssessments();
  const signoff=useSignoffAssessment();
  const [selected,setSelected]=useState<string>("");
  const [decision,setDecision]=useState<"endorsed"|"needs_practice">("endorsed");
  const [note,setNote]=useState("");
  const entries=(reviews.data||[]).filter(r=>r.user_id===userId);
  const current=entries.find(row=>row.assessment_id===selected);
  const submit=async()=>{
    if(!current||note.trim().length<10)return;
    try {
      await signoff.mutateAsync({userId,assessmentId:current.assessment_id,decision,note:note.trim()});
      toast.success("Supervisor assessment review recorded.");
      setNote("");
    } catch(err){
      toast.error(err instanceof Error ? err.message : "Unable to record the review.");
    }
  };
  return <Card>
    <CardHeader>
      <CardTitle className="flex gap-2 text-lg"><ClipboardCheck className="h-5 w-5"/>Knowledge checks and supervisor review</CardTitle>
      <CardDescription>
        Scores come from server-graded scenario questions. An endorsement records the reviewer's own documented assessment; it is not an external qualification, license, or automatic HR clearance.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {reviews.isLoading&&<p className="text-sm text-muted-foreground">Loading authorized assessment results…</p>}
      {reviews.error&&<p className="text-sm text-destructive" role="alert">Supervisor assessment records are not available for this account.</p>}
      {!reviews.isLoading&&!reviews.error&&entries.length===0&&<p className="text-sm text-muted-foreground">
        No submitted knowledge checks exist for this colleague. A supervisor decision requires an actual learner attempt.
      </p>}
      {entries.map(entry=><div key={entry.assessment_id} className="flex flex-wrap gap-2 items-center rounded-md border p-3 text-sm">
        <div className="min-w-44 flex-1">
          <p className="font-medium">{entry.assessment_title}</p>
          <p className="text-xs text-muted-foreground">
            {entry.score}/{entry.total} correct · {new Date(entry.submitted_at).toLocaleDateString()}
          </p>
        </div>
        <Badge variant={entry.passed?"default":"outline"}>{entry.passed?"Passed check":"Needs practice"}</Badge>
        {entry.signoff_decision&&<Badge variant="secondary">{readable(entry.signoff_decision)}</Badge>}
        <Button size="sm" variant="outline" onClick={()=>{setSelected(entry.assessment_id);setDecision(entry.passed?"endorsed":"needs_practice");setNote("");}}>
          Review
        </Button>
      </div>)}
      {current&&<div className="space-y-3 rounded-lg border border-primary/20 p-4">
        <p className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4"/>{current.assessment_title}</p>
        <p className="text-xs text-muted-foreground">Current attempt: {current.score}/{current.total} · {current.passed?"Passing":"Not passing"}. Previous signoff: {current.signoff_decision?readable(current.signoff_decision):"None on this attempt"}.</p>
        <div className="space-y-1"><Label>Decision</Label>
          <Select value={decision} onValueChange={v=>setDecision(v as typeof decision)}>
            <SelectTrigger><SelectValue/></SelectTrigger><SelectContent>
              {current.passed&&<SelectItem value="endorsed">Endorse demonstrated readiness</SelectItem>}
              <SelectItem value="needs_practice">Request further practice</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Observed evidence and rationale (required)</Label>
          <Textarea rows={3} value={note} onChange={e=>setNote(e.target.value)}
            placeholder="Document the conversation, observed work, evidence or specific additional practice required."/>
        </div>
        <Button onClick={submit} disabled={signoff.isPending||note.trim().length<10||(!current.passed&&decision==="endorsed")}>
          {signoff.isPending?"Recording…":"Record supervisor review"}
        </Button>
        <p className="text-xs text-muted-foreground">
          The database verifies your direct reporting relationship and prevents self-endorsement. Signoffs are appended to an audit history and tied to the reviewed attempt.
        </p>
      </div>}
    </CardContent>
  </Card>;
}
