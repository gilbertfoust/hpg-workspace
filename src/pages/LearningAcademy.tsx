import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Circle, ExternalLink, GraduationCap, LockKeyhole, Wrench } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { canAccessArea, type AccessArea } from "@/lib/accessControl";

type Lesson = {
  id: string;
  name: string;
  goal: string;
  steps: string[];
  practice: string;
  path?: string;
  area?: AccessArea;
  readiness: "navigation" | "pending";
};

type Track = { id: string; title: string; audience: string; lessons: Lesson[] };

const tracks: Track[] = [
  { id: "start", title: "Start Here", audience: "Everyone with internal workspace access", lessons: [
    { id: "welcome", name: "Find your dashboard", goal: "Recognize the major areas without needing to learn everything at once.", path: "/dashboard", area: "dashboard", readiness: "navigation", steps: ["Open your Dashboard and look at the section headings.", "Find the main sidebar. It contains your available work areas; not every colleague sees the same links.", "Return to the Academy using the Learning Academy navigation link."], practice: "Identify the dashboard and the way back to this tutorial." },
    { id: "assignments", name: "Find your assigned work", goal: "Know where to see a task before editing a live record.", path: "/my-queue", area: "work_items", readiness: "navigation", steps: ["Open My Queue.", "Look for the title, status, and due date of an existing assignment.", "Open a task only if you are responsible for it; do not change real assignments while practicing."], practice: "Locate an existing assignment or recognize that your queue is empty." },
    { id: "documents", name: "Understand documents", goal: "Know where organizational documents are stored.", path: "/documents", area: "documents", readiness: "navigation", steps: ["Open Documents.", "Use existing search and filters to locate an appropriate file.", "Confirm the NGO or departmental context before adding any document."], practice: "Locate an authorized document without modifying it." },
  ] },
  { id: "grants", title: "Grant Writers & Development", audience: "Grant writers and development staff", lessons: [
    { id: "grant-search", name: "Find a funding opportunity", goal: "Identify possible funding sources without assuming eligibility.", path: "/grants/search", area: "development", readiness: "navigation", steps: ["Open Grant Search and review the search and status filters.", "Inspect one result's funder, deadline, restrictions, and website.", "Document any unverified eligibility details before recommending a match."], practice: "Identify an opportunity and one eligibility question to investigate." },
    { id: "grant-pipeline", name: "Track an application", goal: "Understand how grants are linked to NGOs and monitored.", path: "/grants/pipeline", area: "development", readiness: "navigation", steps: ["Open the Grant Pipeline.", "Review the By Stage and By NGO views.", "Identify how a new grant is associated with an NGO. Do not create a test item in live data."], practice: "Find a tracked grant or confirm the current pipeline is empty." },
    { id: "grant-draft", name: "Coordinate a proposal", goal: "Find the shared proposal workflow.", path: "/proposal-collaboration", area: "development", readiness: "navigation", steps: ["Open Proposal Collaboration.", "Identify where research, budgets, and proposal material come together.", "Review the appropriate approvals before submitting a real proposal."], practice: "Describe which collaborators should review a proposal before submission." },
  ] },
  { id: "communications", title: "Communications, Magazines & Interviews", audience: "Editors, interviewers, writers, and communications staff", lessons: [
    { id: "editorial-queue", name: "Create an editorial assignment", goal: "Track a magazine article, interview, press release, or newsletter.", path: "/modules/communications", area: "communications", readiness: "navigation", steps: ["Open Communications Studio.", "Review the existing editorial task list and work types.", "Use New assignment when you have a real approved assignment; add a title, description, and due date.", "Track its stage and use Documents for the related files."], practice: "Identify which type of assignment you would create for a planned interview." },
    { id: "interview", name: "Plan and document an interview", goal: "Use an assignment to coordinate consent, research, recording, and transcription.", path: "/modules/communications", area: "communications", readiness: "navigation", steps: ["Choose Interview in Communications Studio for an authorized interview assignment.", "Document the subject, purpose, interview questions, and consent requirements in the description.", "Maintain recordings and transcripts in approved document storage; do not publish without editorial approval."], practice: "Outline an interview's purpose, questions, and consent check." },
    { id: "publish-magazine", name: "Publish a magazine issue", goal: "Move an approved issue into a controlled publishing workflow.", readiness: "pending", steps: ["Editorial calendar, layout approval, issue assembly, and publishing remain to be implemented."], practice: "Await the publishing workflow before treating this as a completed lesson." },
  ] },
  { id: "marketing", title: "Social Media & Marketing", audience: "Campaign planners and social-media staff", lessons: [
    { id: "campaign-task", name: "Plan a campaign", goal: "Track social posts, campaign assets, and approvals.", path: "/modules/marketing", area: "communications", readiness: "navigation", steps: ["Open Marketing Studio.", "Review campaign and social-media assignments.", "Create a real Social post or Campaign assignment only with an authorized brief.", "Track content preparation and approvals before publishing outside the workspace."], practice: "Recognize where to record a draft post and its intended platform." },
    { id: "social-publish", name: "Schedule and publish social posts", goal: "Publish through connected and authorized social accounts.", readiness: "pending", steps: ["Platform authentication, scheduling, posting, and analytics are not yet connected in this module."], practice: "Do not assume task tracking automatically posts to social platforms." },
  ] },
  { id: "research", title: "Research & Evidence", audience: "Researchers and program development teams", lessons: [
    { id: "research-task", name: "Track a research assignment", goal: "Organize research responsibilities and outputs.", path: "/work-items", area: "work_items", readiness: "navigation", steps: ["Open Work Items and find the relevant research assignment.", "Review the description, responsible person, and deadline.", "Keep source links and findings in the assigned document or evidence record."], practice: "Identify what evidence would support a project recommendation." },
    { id: "research-files", name: "Keep source evidence organized", goal: "Support reproducible findings with source documentation.", path: "/documents", area: "documents", readiness: "navigation", steps: ["Open Documents and locate the correct NGO or project context.", "Use original publications and dated source documents.", "Distinguish verified information from hypotheses and commentary."], practice: "Identify an original source and record its date and author." },
    { id: "research-library", name: "Managed research library", goal: "Maintain linked citations, literature notes, and peer review.", readiness: "pending", steps: ["A dedicated citation and research review workflow requires implementation."], practice: "Continue using approved document storage until that workflow is available." },
  ] },
  { id: "budget", title: "Budgeting & Financial Planning", audience: "Budget planners and authorized finance colleagues", lessons: [
    { id: "budget-screen", name: "Review program budgets", goal: "Navigate a proposed financial plan without accidentally entering transactions.", path: "/financial-hub/accounting/budgets", area: "finance", readiness: "navigation", steps: ["Open Budgets in the Financial Hub.", "Identify the fiscal period, categories, and budget status.", "Before entering any real amounts, confirm the NGO, source documents, and authorized reviewer."], practice: "Find where planned expenses are recorded, without changing a live budget." },
    { id: "finance-operations", name: "Follow finance approvals", goal: "Understand the difference between budget planning and approved payment.", path: "/financial-hub/operations", area: "finance", readiness: "navigation", steps: ["Open Finance Operations.", "Identify requests and approval responsibilities.", "Confirm that a proposed budget does not itself authorize a financial transfer."], practice: "Explain which approval would be required before spending." },
  ] },
  { id: "accounting", title: "Accounting & Financial Records", audience: "Accountants, controllers, and authorized financial staff", lessons: [
    { id: "receipts", name: "Find receipts", goal: "Locate evidence supporting financial activity.", path: "/financial-hub/accounting/receipts", area: "finance", readiness: "navigation", steps: ["Open Receipts.", "Check the related NGO and financial period.", "Do not upload sample receipts into production records."], practice: "Find the receipt area and identify the supporting metadata needed." },
    { id: "reconciliation", name: "Review reconciliation", goal: "Recognize outstanding differences without changing posted amounts.", path: "/financial-hub/accounting/reconciliation", area: "finance", readiness: "navigation", steps: ["Open Reconciliation.", "Identify the account, statement period, and discrepancy status.", "Escalate unmatched items through the established finance review workflow."], practice: "Explain why an unmatched entry needs supporting evidence." },
    { id: "reports", name: "Review financial reports", goal: "Recognize ledger and report outputs.", path: "/financial-hub/accounting/reports", area: "finance", readiness: "navigation", steps: ["Open Financial Reports.", "Identify the selected period and report type.", "Check whether reported figures come from approved and reconciled records."], practice: "Locate the reporting area and the selected accounting period." },
  ] },
  { id: "board", title: "Board of Directors", audience: "Board directors and governance officers", lessons: [
    { id: "board-dashboard", name: "Read organizational reports", goal: "Find authorized oversight materials using board-level permissions.", path: "/reports", area: "reports", readiness: "navigation", steps: ["Open Reports.", "Review only reports available to your role.", "Record questions or requests through approved board communication channels; do not edit staff records."], practice: "Find an authorized report and identify one oversight question." },
    { id: "board-hub", name: "Board meeting and voting hub", goal: "Access agendas, minutes, committee assignments, and recorded votes.", readiness: "pending", steps: ["A dedicated board hub and voting workflow are not yet verified in this application."], practice: "Use the existing authorized governance process until a verified board workflow is introduced." },
  ] },
];

const isAllowed = (lesson: Lesson, role?: string | null, access?: Parameters<typeof canAccessArea>[2]) =>
  !lesson.area || canAccessArea(role, lesson.area, access);

export default function LearningAcademy() {
  const { user } = useAuth();
  const { data: access } = useUserRole();
  const [params, setParams] = useSearchParams();
  const selectedTrackId = params.get("track") || "start";
  const activeTrack = tracks.find(track => track.id === selectedTrackId) || tracks[0];
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState<string[]>([]);
  const storageKey = user?.id ? "hpg-academy:v1:" + user.id : null;

  useEffect(() => {
    setCompleted([]);
    if (!storageKey) return;
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(saved)) setCompleted(saved.filter((value): value is string => typeof value === "string"));
    } catch {
      setCompleted([]);
    }
  }, [storageKey]);

  useEffect(() => { setSelectedLessonId(null); setStep(0); }, [selectedTrackId]);

  const selectedLesson = activeTrack.lessons.find(lesson => lesson.id === selectedLessonId);
  const availableLessons = useMemo(
    () => tracks.flatMap(track => track.lessons).filter(lesson => lesson.readiness === "navigation" && isAllowed(lesson, access?.role, access)),
    [access],
  );
  const doneCount = availableLessons.filter(lesson => completed.includes(lesson.id)).length;
  const percent = availableLessons.length ? Math.round(doneCount / availableLessons.length * 100) : 0;

  const markComplete = (id: string) => {
    if (!storageKey) return;
    const next = Array.from(new Set([...completed, id]));
    setCompleted(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  return (
    <MainLayout title="HPG Workspace Learning Academy" subtitle="Learn your role inside the actual workspace—one task at a time.">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="border-primary/20 bg-card/95">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="rounded-xl bg-primary/10 p-3"><GraduationCap className="h-8 w-8 text-primary" /></div>
            <div className="flex-1 space-y-2">
              <h2 className="text-xl font-semibold">Welcome. Start with one useful action.</h2>
              <p className="text-sm text-muted-foreground">Open the real workspace screens, follow the guided instructions, and return when ready. Training never creates fake accounting entries, grant applications, or board votes.</p>
              <div className="flex items-center gap-3"><Progress value={percent} className="max-w-sm" /><span className="whitespace-nowrap text-xs text-muted-foreground">{doneCount}/{availableLessons.length} lessons</span></div>
              <p className="text-xs text-muted-foreground">Completion is self-reported and saved on this device only; it is not an official HR training record.</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[285px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader><CardTitle className="text-base">Learning paths</CardTitle><CardDescription>Select your area of work.</CardDescription></CardHeader>
            <CardContent className="space-y-1">
              {tracks.map(track => {
                const allowed = track.lessons.some(lesson => isAllowed(lesson, access?.role, access) && lesson.readiness === "navigation");
                return (
                  <Button key={track.id} size="sm" variant={activeTrack.id === track.id ? "secondary" : "ghost"}
                    className="h-auto w-full justify-start py-2 text-left whitespace-normal"
                    disabled={!allowed} onClick={() => setParams({ track: track.id })}>
                    {!allowed ? <LockKeyhole className="mr-2 h-4 w-4 shrink-0" /> : <BookOpen className="mr-2 h-4 w-4 shrink-0" />}
                    {track.title}
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {selectedLesson ? (
              <Card>
                <CardHeader>
                  <Button variant="ghost" size="sm" className="w-fit px-0" onClick={() => { setSelectedLessonId(null); setStep(0); }}><ArrowLeft className="mr-2 h-4 w-4" /> All lessons</Button>
                  <CardTitle>{selectedLesson.name}</CardTitle>
                  <CardDescription>{selectedLesson.goal}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {selectedLesson.readiness === "pending" ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm">This workflow is not ready for hands-on training. Its lesson will be activated when the underlying feature is verified.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant="secondary">Step {step + 1} of {selectedLesson.steps.length}</Badge>
                        {completed.includes(selectedLesson.id) && <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" /> Completed on this device</Badge>}
                      </div>
                      <div className="rounded-xl border bg-muted/30 p-5">
                        <p className="text-base font-medium">{selectedLesson.steps[step]}</p>
                      </div>
                      {selectedLesson.path && (
                        <Button asChild variant="outline"><Link to={selectedLesson.path}><ExternalLink className="mr-2 h-4 w-4" /> Open workspace screen</Link></Button>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button variant="outline" disabled={step === 0} onClick={() => setStep(previous => Math.max(0, previous - 1))}><ArrowLeft className="mr-2 h-4 w-4" /> Previous</Button>
                        {step < selectedLesson.steps.length - 1 ? (
                          <Button onClick={() => setStep(previous => previous + 1)}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
                        ) : (
                          <Button onClick={() => markComplete(selectedLesson.id)} disabled={completed.includes(selectedLesson.id)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> {completed.includes(selectedLesson.id) ? "Completed" : "I completed this practice"}
                          </Button>
                        )}
                      </div>
                      <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4 text-sm"><strong>Practice check:</strong> {selectedLesson.practice}</div>
                    </>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div><h2 className="text-xl font-semibold">{activeTrack.title}</h2><p className="text-sm text-muted-foreground">{activeTrack.audience}</p></div>
                <div className="grid gap-3">
                  {activeTrack.lessons.map(lesson => {
                    const allowed = isAllowed(lesson, access?.role, access);
                    const pending = lesson.readiness === "pending";
                    return (
                      <Card key={lesson.id}>
                        <CardContent className="flex flex-wrap items-center gap-4 p-4">
                          {pending ? <Wrench className="h-5 w-5 text-muted-foreground" /> : completed.includes(lesson.id) ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                          <div className="min-w-[180px] flex-1">
                            <p className="font-medium">{lesson.name}</p>
                            <p className="text-sm text-muted-foreground">{lesson.goal}</p>
                          </div>
                          <Badge variant={pending ? "outline" : "secondary"}>{pending ? "Function not ready" : allowed ? "Guided navigation" : "Restricted"}</Badge>
                          <Button size="sm" variant="outline" disabled={pending || !allowed} onClick={() => { setSelectedLessonId(lesson.id); setStep(0); }}>Start <ArrowRight className="ml-2 h-3 w-3" /></Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
