import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { ensureSupabase } from "@/integrations/supabase/client";

type Lesson = {
  id: string;
  name: string;
  goal: string;
  steps: string[];
  practice: string;
  path?: string;
  area?: AccessArea;
  readiness: "navigation" | "pending";
  requiresEditorial?: boolean;
  requiresPublications?: boolean;
  requiresMedia?: boolean;
  requiresCanonicalCommunications?: boolean;
  requiresCanonicalMarketing?: boolean;
  requiresCanonicalPublishing?: boolean;
  requiresCanonicalIssuePublishing?: boolean;
  requiresCanonicalMedia?: boolean;
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
    { id: "editorial-queue", name: "Create and assign an editorial pitch", goal: "Start the original Communications editorial workflow.", path: "/modules/communications", area: "communications", requiresCanonicalCommunications: true, readiness: "pending", steps: ["Open Communications Operations and review existing editorial records.", "For an authorized story, choose New Story and enter a working title and pitch of at least 10 characters.", "Choose a responsible owner and a distinct editor if known. Keep sensitive context out of the public publication pages.", "Create the pitch, open its record, and follow the controlled stages. The database will require sources, versions, and approvals before publication."], practice: "Locate the title, status, assigned writer and editor on a real editorial record." },
    { id: "editorial-sources", name: "Document evidence for a story", goal: "Record sources and consent requirements in the canonical Communications evidence register.", path: "/modules/communications", area: "communications", requiresCanonicalCommunications: true, readiness: "pending", steps: ["Open Communications Operations and select an existing editorial story.", "Find Sources and consent evidence below the record details.", "Review existing source names and links. For real approved work, use Record a source with an HTTPS link and its correct consent classification.", "For interviews and impact stories, register a pending consent requirement if needed. A pending requirement never claims permission was granted.", "Return to the stage menu. The backend will check whether a documented source is present before advancing to drafting."], practice: "Find a source record and distinguish a pending consent requirement from a verified release." },
    { id: "consent-review", name: "Review an interview or media consent requirement", goal: "Record independent permission decisions with evidence and expiration before final editorial approval.", path: "/modules/communications", area: "communications", requiresCanonicalCommunications: true, readiness: "pending", steps: ["Open Communications Operations, select an editorial story, and locate Sources and consent evidence.", "A staff member registers the subject and type of required permission. This does not authorize public use.", "A different authorized Communications reviewer selects the consent record in Independent consent review.", "Record the precise approved scope and an HTTPS reference to the actual permission evidence. For granted permission, set the expiration date when one exists.", "Confirm the decision is displayed as Granted or Not Required, as applicable. Declined or pending requirements block the public release workflow; independent editorial approvals must still be current."], practice: "Identify the difference between a consent request, verified permission, and editorial publication approval." },
    { id: "canonical-magazine-assembly", name: "Assemble a canonical magazine issue", goal: "Link approved stories, record a proof, and follow the issue's production and review gates.", path: "/modules/communications", area: "communications", requiresCanonicalCommunications: true, readiness: "pending", steps: ["Open Communications Operations and select Magazine issues.", "Choose an existing issue or create an authorized issue with its intended audience and responsible editor.", "Under Magazine story placements, choose an editorial contribution already scheduled or published and add it to the issue.", "Record the HTTPS design-proof location and planned release date in the issue details, then save.", "Follow the planning, commissioning, production and review stages. The backend requires separate story and issue approvals; a planned date never distributes the issue."], practice: "Identify the issue's approved story placement and design-proof URL." },
    { id: "canonical-issue-release", name: "Preview and publish an approved HPG magazine issue", goal: "Generate an internal proof and publish only after the canonical issue and all articles pass approval.", path: "/modules/communications", area: "communications", requiresCanonicalIssuePublishing: true, readiness: "pending", steps: ["Open Communications Operations → Magazine issues and select an existing issue.", "Under Magazine story placements, verify each story is reviewed, approved and placed in the intended order.", "Open Magazine proof and publication, inspect the internal text proof and use Print internal proof for editorial review. A proof does not publish the issue.", "Confirm the issue has a reviewed HTTPS design proof, a scheduled release time, an independent publication approval and a separate distribution approval.", "At or after the planned release time, an authorized publisher confirms the rights and approval checks, enters a unique URL name, and selects Publish approved issue to HPG.", "Open the live edition to verify the released text. If necessary, an authorized publisher can withdraw the public edition with a reason; the original distribution record remains for audit."], practice: "Locate the internal proof, the current issue status, and the public release controls. Explain why a magazine containing an unapproved or embargoed story cannot be published." },
    { id: "canonical-public-release", name: "Release an approved Communications story", goal: "Publish reviewed text to HPG Publications while preserving the original approval and evidence history.", path: "/modules/communications", area: "communications", requiresCanonicalPublishing: true, readiness: "pending", steps: ["Open Communications Operations and select an authorized story in Scheduled status.", "Verify that its publication date and any embargo have passed, a numbered version exists, and independent editorial, fact-check, publication and applicable Legal approvals are current.", "Review the rights and consent evidence; sensitive interview or impact material requires documented active permission.", "An authorized Communications publisher chooses a unique public URL name and confirms the final text and permissions before selecting Publish approved text to HPG.", "Open the public page and verify the approved text. If withdrawal is necessary, use the reasoned Withdraw action; cached copies may remain elsewhere."], practice: "Explain why the Scheduled stage alone cannot release a public story and identify the separate withdrawal safeguard." },
    { id: "interview", name: "Begin an interview assignment", goal: "Coordinate editorial responsibility and then document interview evidence.", path: "/modules/communications", area: "communications", requiresCanonicalCommunications: true, readiness: "pending", steps: ["Create an Editorial record with content type Interview and provide a clear research pitch.", "Assign a writer and separate editor before advancing beyond pitch.", "Use the private Editorial Media Library for recordings, and the approved editorial process for consent and interviews.", "Do not move the work to public release until required sources, consent, fact checks and approvals are recorded."], practice: "Identify the stage gate that requires explicit interview consent." },
    { id: "editorial-calendar", name: "Plan the editorial calendar", goal: "Schedule an upcoming story or release and see it on the internal calendar.", path: "/communications/editorial", area: "communications", requiresEditorial: true, readiness: "pending", steps: ["Open Editorial Production Desk and create a real article or interview brief.", "Save its planned release date.", "Open the Calendar tab to locate the scheduled item. This date does not automatically publish content."], practice: "Locate the saved planned date without changing a live published item." },
    { id: "interview-controls", name: "Document interview consent", goal: "Link stored release evidence before an interview is approved.", path: "/communications/editorial", area: "communications", requiresEditorial: true, readiness: "pending", steps: ["Open an existing Interview item.", "Attach a signed consent/release from the authorized Documents area.", "Confirm the agreed publication scope and add a transcript link if available.", "Submit the saved version for a separate editorial review."], practice: "Identify which document demonstrates consent for a real interview." },
    { id: "publish-magazine", name: "Assemble and publish an HPG magazine", goal: "Arrange approved contributions and release a controlled public edition.", path: "/communications/editorial", area: "communications", requiresPublications: true, readiness: "pending", steps: ["Create an issue and add the relevant article contributions.", "Arrange the order, print an internal proof, and verify each contribution is approved.", "Submit the saved issue for an independent review. Authors cannot approve their own work.", "After approval, select Publish to HPG Publications, choose a unique URL slug, and confirm the text is approved for public release.", "Open the public edition and verify the article contents. A publisher can withdraw a released page if necessary."], practice: "Explain the distinction between an internal proof, editorial approval, and public release." },
    { id: "canonical-media", name: "Attach private media to a Communications story", goal: "Link recordings and photographs to the original story while retaining independent rights review.", path: "/communications/media", area: "communications", requiresCanonicalMedia: true, readiness: "pending", steps: ["Open a real story in Communications Operations and choose Open private editorial media.", "Confirm that Original Communications Operations is the media source, then select the story; the file will remain in the canonical private storage bucket.", "Upload an authorized photo, PDF, audio or short video file with an attribution and rights basis. Store larger recordings through approved organizational Drive storage.", "Attach the permission or license document where required, and save any corrected attribution or alternative text while the record is pending.", "A separate authorized reviewer clears or rejects media rights. Rights clearance does not publish the file, expose it publicly, or override a story's consent and editorial approval steps."], practice: "Find the story-linked media record and distinguish Pending, Cleared, and Rejected rights states." },
    { id: "media-rights", name: "Manage editorial media and rights", goal: "Store interviews, photos and recordings privately and review rights before use.", path: "/communications/media", area: "communications", requiresMedia: true, readiness: "pending", steps: ["Open Editorial Media Library and choose a real editorial item.", "Upload the file with a creator credit, description, and verifiable rights basis.", "Attach a permission or license record for material that requires it.", "A different authorized reviewer checks the evidence and clears or rejects the asset.", "Remember: clearance does not publish the private media or make the file publicly accessible."], practice: "Locate a private media asset and identify its rights review status." },
  ] },
  { id: "marketing", title: "Social Media & Marketing", audience: "Campaign planners and social-media staff", lessons: [
    { id: "campaign-task", name: "Create a Marketing campaign", goal: "Use the actual campaign database and cross-department review controls.", path: "/modules/marketing", area: "communications", requiresCanonicalMarketing: true, readiness: "pending", steps: ["Open Marketing Operations and inspect the current campaign pipeline.", "For an authorized campaign, select New Campaign and supply the objective, audience, call to action, channels, and approved owner.", "Save the campaign, review its stage and assigned strategist, then submit a versioned campaign packet when appropriate.", "Record marketing and required Communications, Finance, Development, Program or Legal approvals before attempting a launch."], practice: "Find an existing campaign and identify which approvals it requires." },
    { id: "social-draft", name: "Draft and review a social post", goal: "Prepare a post and move it through the approved social workflow without publishing it automatically.", path: "/modules/marketing", area: "communications", requiresCanonicalMarketing: true, readiness: "pending", steps: ["Open Marketing Operations → Social posts.", "Review a real post and its intended social platform.", "Save edits, then submit a numbered version and advance through drafting and review when permitted.", "Verify publication rights and approvals separately. The internal Scheduled or Approved stage does not post to external accounts."], practice: "Explain the distinction between a scheduled post and a verified external publication." },
    { id: "marketing-channel", name: "Connect a post to a campaign and channel", goal: "Associate social content with the correct registered platform account.", path: "/modules/marketing", area: "communications", requiresCanonicalMarketing: true, readiness: "pending", steps: ["Open Marketing Operations and view the registered Accounts tab.", "Identify the account's ownership status; a registered account does not necessarily mean publishing credentials are connected.", "Open Social posts, choose an existing draft or create a real approved assignment, and select the corresponding channel account.", "For a new post, choose the related campaign if applicable and submit a numbered version before review.", "Set a planned release time only after review. Publishing externally and recording provider evidence are separate authorized actions."], practice: "Identify the chosen channel and explain why a scheduled post is not a published post." },
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

const isReady = (lesson: Lesson, editorReady: boolean, publicationReady: boolean, mediaReady: boolean, canonicalCommsReady: boolean, canonicalMarketingReady: boolean, canonicalPublisherReady: boolean, canonicalIssueReady: boolean, canonicalMediaReady: boolean) =>
  lesson.readiness === "navigation" || (!!lesson.requiresEditorial && editorReady) ||
  (!!lesson.requiresPublications && editorReady && publicationReady) ||
  (!!lesson.requiresMedia && editorReady && mediaReady) ||
  (!!lesson.requiresCanonicalCommunications && canonicalCommsReady) ||
  (!!lesson.requiresCanonicalMarketing && canonicalMarketingReady) ||
  (!!lesson.requiresCanonicalPublishing && canonicalCommsReady && canonicalPublisherReady) ||
  (!!lesson.requiresCanonicalIssuePublishing && canonicalCommsReady && canonicalIssueReady) ||
  (!!lesson.requiresCanonicalMedia && canonicalCommsReady && canonicalMediaReady);

const isAllowed = (lesson: Lesson, role?: string | null, access?: Parameters<typeof canAccessArea>[2]) =>
  !lesson.area || canAccessArea(role, lesson.area, access);

export default function LearningAcademy() {
  const { user } = useAuth();
  const { data: access } = useUserRole();
  const editorialReadiness = useQuery({
    queryKey: ["editorial-academy-readiness", user?.id],
    enabled: !!user?.id && canAccessArea(access?.role, "communications", access),
    retry: false,
    queryFn: async () => {
      const { data, error } = await ensureSupabase().rpc("can_write_editorial" as never);
      return !error && (data as unknown) === true;
    },
  });
  const editorReady = editorialReadiness.data === true;
  const nativeReadiness = useQuery({
    queryKey: ["editorial-native-readiness", user?.id],
    enabled: editorReady,
    retry: false,
    queryFn: async () => {
      const client = ensureSupabase();
      const [publication, media] = await Promise.all([
        client.from("editorial_publications" as never).select("id", { head: true }).limit(1),
        client.from("editorial_assets" as never).select("id", { head: true }).limit(1),
      ]);
      return { publicationReady: !publication.error, mediaReady: !media.error };
    },
  });
  const publicationReady = nativeReadiness.data?.publicationReady === true;
  const mediaReady = nativeReadiness.data?.mediaReady === true;
  const canonicalReadiness = useQuery({
    queryKey: ["department-operating-readiness", user?.id],
    enabled: !!user?.id && canAccessArea(access?.role, "communications", access),
    retry: false,
    queryFn: async () => {
      const client = ensureSupabase();
      const [comms, marketing] = await Promise.all([
        client.rpc("is_communications_staff" as never),
        client.rpc("is_marketing_staff" as never),
      ]);
      return { communications: !comms.error && comms.data === true, marketing: !marketing.error && marketing.data === true };
    },
  });
  const canonicalCommsReady = canonicalReadiness.data?.communications === true;
  const canonicalMarketingReady = canonicalReadiness.data?.marketing === true;
  const publisherSchemaReadiness = useQuery({
    queryKey: ["canonical-publication-schema-readiness", user?.id],
    enabled: canonicalCommsReady,
    retry: false,
    queryFn: async () => {
      const result = await ensureSupabase()
        .from("editorial_publications" as never)
        .select("communications_editorial_item_id", { head: true }).limit(1);
      return !result.error;
    },
  });
  const canonicalPublisherReady = publisherSchemaReadiness.data === true;
  const canonicalIssueSchemaReadiness = useQuery({
    queryKey: ["canonical-magazine-schema-readiness", user?.id],
    enabled: canonicalCommsReady,
    retry: false,
    queryFn: async () => {
      const result = await ensureSupabase()
        .from("editorial_publications" as never)
        .select("communications_publication_id", { head: true }).limit(1);
      return !result.error;
    },
  });
  const canonicalIssueReady = canonicalIssueSchemaReadiness.data === true;
  const canonicalMediaReadiness = useQuery({
    queryKey: ["canonical-media-schema-readiness", user?.id],
    enabled: canonicalCommsReady,
    retry: false,
    queryFn: async () => {
      const result = await ensureSupabase()
        .from("editorial_assets" as never)
        .select("communications_editorial_item_id", { head: true }).limit(1);
      return !result.error;
    },
  });
  const canonicalMediaReady = canonicalMediaReadiness.data === true;
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
    () => tracks.flatMap(track => track.lessons).filter(lesson => isReady(lesson, editorReady, publicationReady, mediaReady, canonicalCommsReady, canonicalMarketingReady, canonicalPublisherReady, canonicalIssueReady, canonicalMediaReady) && isAllowed(lesson, access?.role, access)),
    [access, editorReady, publicationReady, mediaReady, canonicalCommsReady, canonicalMarketingReady, canonicalPublisherReady, canonicalIssueReady, canonicalMediaReady],
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
                const allowed = track.lessons.some(lesson => isAllowed(lesson, access?.role, access) && isReady(lesson, editorReady, publicationReady, mediaReady));
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
                  {!isReady(selectedLesson, editorReady, publicationReady, mediaReady, canonicalCommsReady, canonicalMarketingReady, canonicalPublisherReady, canonicalIssueReady, canonicalMediaReady) ? (
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
                    const pending = !isReady(lesson, editorReady, publicationReady, mediaReady);
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
