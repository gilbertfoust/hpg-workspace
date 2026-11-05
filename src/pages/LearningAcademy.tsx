import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Circle, ExternalLink, GraduationCap, LockKeyhole, Search, Wrench } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { tracks, type Lesson } from "@/data/academyCoreTracks";
import AcademyNarratedSteps from "@/components/onboarding/AcademyNarratedSteps";
import AcademyLessonResources from "@/components/onboarding/AcademyLessonResources";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole, isAdminRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { useAcademyProgress, useAcademyTeamProgress } from "@/hooks/useAcademyProgress";
import { canAccessArea } from "@/lib/accessControl";
import { ensureSupabase } from "@/integrations/supabase/client";

const isReady = (lesson: Lesson, editorReady: boolean, publicationReady: boolean, mediaReady: boolean, canonicalCommsReady: boolean, canonicalMarketingReady: boolean, canonicalPublisherReady: boolean, canonicalIssueReady: boolean, canonicalMediaReady: boolean, boardReady: boolean) =>
  lesson.readiness === "navigation" || (!!lesson.requiresEditorial && editorReady) ||
  (!!lesson.requiresPublications && editorReady && publicationReady) ||
  (!!lesson.requiresMedia && editorReady && mediaReady) ||
  (!!lesson.requiresCanonicalCommunications && canonicalCommsReady) ||
  (!!lesson.requiresCanonicalMarketing && canonicalMarketingReady) ||
  (!!lesson.requiresCanonicalPublishing && canonicalCommsReady && canonicalPublisherReady) ||
  (!!lesson.requiresCanonicalIssuePublishing && canonicalCommsReady && canonicalIssueReady) ||
  (!!lesson.requiresCanonicalMedia && canonicalCommsReady && canonicalMediaReady) ||
  (!!lesson.requiresBoardHub && boardReady);

const isAllowed = (lesson: Lesson, role?: string | null, access?: Parameters<typeof canAccessArea>[2]) =>
  !lesson.area || canAccessArea(role, lesson.area, access);

export default function LearningAcademy() {
  const { user } = useAuth();
  const { data: access } = useUserRole();
  const academy = useAcademyProgress();
  const team = useAcademyTeamProgress();
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
  const boardReadiness = useQuery({
    queryKey: ["board-academy-workflow-ready",user?.id],
    enabled: !!user?.id && canAccessArea(access?.role,"reports",access),
    retry: false,
    queryFn: async () => {
      const result=await ensureSupabase().rpc("can_read_bod_meetings" as never);
      return !result.error && result.data === true;
    }
  });
  const boardReady = boardReadiness.data === true;
  const [params, setParams] = useSearchParams();
  const selectedTrackId = params.get("track") || "start";
  const activeTrack = tracks.find(track => track.id === selectedTrackId) || tracks[0];
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [lessonSearch, setLessonSearch] = useState("");
  const [step, setStep] = useState(0);
  const [legacyCompleted, setLegacyCompleted] = useState<string[]>([]);
  const completed = (academy.progress.data || []).map(item => item.lesson_id);
  const storageKey = user?.id ? "hpg-academy:v1:" + user.id : null;
  const mayViewTeam = isAdminRole(access?.role) || (team.data || []).length > 0;

  useEffect(() => {
    setLegacyCompleted([]);
    if (!storageKey) return;
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      if (Array.isArray(saved)) setLegacyCompleted(saved.filter((value): value is string => typeof value === "string"));
    } catch {
      setLegacyCompleted([]);
    }
  }, [storageKey]);

  useEffect(() => { setSelectedLessonId(params.get("lesson")); setStep(0); }, [selectedTrackId]);

  const selectedLesson = activeTrack.lessons.find(lesson => lesson.id === selectedLessonId);
  const availableLessons = useMemo(
    () => tracks.flatMap(track => track.lessons).filter(lesson => isReady(lesson, editorReady, publicationReady, mediaReady, canonicalCommsReady, canonicalMarketingReady, canonicalPublisherReady, canonicalIssueReady, canonicalMediaReady, boardReady) && isAllowed(lesson, access?.role, access)),
    [access, editorReady, publicationReady, mediaReady, canonicalCommsReady, canonicalMarketingReady, canonicalPublisherReady, canonicalIssueReady, canonicalMediaReady, boardReady],
  );
  const foundLessons = lessonSearch.trim().length >= 2
    ? tracks.flatMap(track => track.lessons
        .filter(lesson => isAllowed(lesson, access?.role, access)
          && (lesson.name + " " + lesson.goal + " " + track.title + " " + lesson.steps.join(" "))
            .toLowerCase().includes(lessonSearch.trim().toLowerCase()))
        .map(lesson => ({trackId:track.id,trackTitle:track.title,lesson})))
    : [];
  const doneCount = availableLessons.filter(lesson => completed.includes(lesson.id)).length;
  const percent = availableLessons.length ? Math.round(doneCount / availableLessons.length * 100) : 0;

  const legacyEligible = legacyCompleted.filter(id =>
    availableLessons.some(lesson => lesson.id === id) && !completed.includes(id));
  const markComplete = async (id: string) => {
    if (completed.includes(id)) return;
    try {
      await academy.mark.mutateAsync(id);
      toast.success("Practice completion saved to your HPG account.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Training progress could not be saved.");
    }
  };
  const undoCompletion = async (id: string) => {
    try {
      await academy.undo.mutateAsync(id);
      toast.success("Self-reported completion corrected.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not correct your training record.");
    }
  };
  const importLocalProgress = async () => {
    if (!storageKey || legacyEligible.length === 0) return;
    try {
      const count = await academy.importLegacy.mutateAsync(legacyEligible);
      window.localStorage.removeItem(storageKey);
      setLegacyCompleted([]);
      toast.success(count + " local practice completions imported to your HPG account.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Device progress could not be imported.");
    }
  };

  return (
    <MainLayout title="HPG Executive Professional Academy — Workspace Training" subtitle="One of five parallel Academy divisions. Learn HPG internal systems safely, one task at a time.">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="border-primary/20 bg-card/95">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="rounded-xl bg-primary/10 p-3"><GraduationCap className="h-8 w-8 text-primary" /></div>
            <div className="flex-1 space-y-2">
              <h2 className="text-xl font-semibold">Workspace Training: learn your role inside HPG.</h2>
              <p className="text-sm text-muted-foreground">This free internal track is one of five equal divisions of the HPG Executive Professional Academy. The other divisions also use HPG Workspace as their learning platform, but are not part of Workspace Training. Guided lessons never create fake accounting entries, grant applications, or Board votes.</p>
              <div className="flex items-center gap-3"><Progress value={percent} className="max-w-sm" /><span className="whitespace-nowrap text-xs text-muted-foreground">{doneCount}/{availableLessons.length} lessons</span></div>
              <p className="text-xs text-muted-foreground">Completion is self-reported and saved to your HPG account across devices. It is not an official HR certification or competency assessment.</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm"><Link to="/learning/assessments">Take a role-related knowledge check</Link></Button>
                <Button asChild variant="outline" size="sm"><Link to="/learning/practice">Open the safe practice lab</Link></Button>
                {isAdminRole(access?.role)&&<Button asChild variant="outline" size="sm"><Link to="/learning/studio">Author instructional recordings</Link></Button>}
                {isAdminRole(access?.role)&&<Button asChild variant="outline" size="sm"><Link to="/learning/readiness">Review completion evidence and remaining gaps</Link></Button>}
                {mayViewTeam && <Button asChild variant="outline" size="sm"><Link to="/learning/team">View authorized team progress and signoffs</Link></Button>}
              </div>
              {academy.progress.error && <p role="alert" className="text-sm text-destructive">Account progress is unavailable. Completions will not be saved until this connection works.</p>}
              {academy.progress.isLoading && <p className="text-xs text-muted-foreground">Loading your saved learning history…</p>}
            </div>
          </CardContent>
        </Card>

        <Card><CardContent className="space-y-3 p-4">
          <label htmlFor="academy-search" className="text-sm font-semibold">Search Workspace Training instructions</label>
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/>
            <Input id="academy-search" className="pl-9" value={lessonSearch}
              onChange={e=>setLessonSearch(e.target.value)}
              placeholder="Search roles, modules, records, approvals or procedures" />
          </div>
          {lessonSearch.trim().length >= 2 && <div className="max-h-72 space-y-2 overflow-y-auto">
            {foundLessons.length===0&&<p className="text-sm text-muted-foreground">No accessible lessons match this search.</p>}
            {foundLessons.map(found=><button key={found.lesson.id} type="button"
              onClick={()=>{setParams({track:found.trackId,lesson:found.lesson.id});setLessonSearch("");}}
              className="flex w-full items-center justify-between gap-2 rounded-md border p-3 text-left hover:bg-muted/40">
              <span><span className="block text-sm font-medium">{found.lesson.name}</span>
                <span className="text-xs text-muted-foreground">{found.trackTitle}</span></span>
              <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground"/>
            </button>)}
          </div>}
        </CardContent></Card>
        {legacyEligible.length > 0 && academy.progress.isSuccess && <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-56 flex-1">
              <p className="font-medium">Previous device-only progress found</p>
              <p className="text-sm text-muted-foreground">{legacyEligible.length} previously marked lessons can be copied to your account if you choose. No import happens automatically.</p>
            </div>
            <Button variant="outline" disabled={academy.importLegacy.isPending} onClick={importLocalProgress}>
              {academy.importLegacy.isPending ? "Importing…" : "Import my earlier progress"}
            </Button>
          </CardContent>
        </Card>}
        <div className="grid gap-6 lg:grid-cols-[285px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader><CardTitle className="text-base">Learning paths</CardTitle><CardDescription>Select your area of work.</CardDescription></CardHeader>
            <CardContent className="space-y-1">
              {tracks.map(track => {
                const allowed = track.lessons.some(lesson => isAllowed(lesson, access?.role, access) && isReady(lesson, editorReady, publicationReady, mediaReady, canonicalCommsReady, canonicalMarketingReady, canonicalPublisherReady, canonicalIssueReady, canonicalMediaReady, boardReady));
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
                  {!isReady(selectedLesson, editorReady, publicationReady, mediaReady, canonicalCommsReady, canonicalMarketingReady, canonicalPublisherReady, canonicalIssueReady, canonicalMediaReady, boardReady) ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm">This workflow is not ready for hands-on training. Its lesson will be activated when the underlying feature is verified.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant="secondary">Step {step + 1} of {selectedLesson.steps.length}</Badge>
                        {completed.includes(selectedLesson.id) && <Badge variant="outline"><CheckCircle2 className="mr-1 h-3 w-3" /> Self-reported complete</Badge>}
                      </div>
                      <div className="rounded-xl border bg-muted/30 p-5">
                        <p className="text-base font-medium">{selectedLesson.steps[step]}</p>
                      </div>
                      <AcademyNarratedSteps title={selectedLesson.name} steps={selectedLesson.steps} currentStep={step} />
                      <AcademyLessonResources lessonId={selectedLesson.id} />
                      {selectedLesson.path && (
                        <Button asChild variant="outline"><Link to={selectedLesson.path + "?academyLesson=" + encodeURIComponent(selectedLesson.id)}><ExternalLink className="mr-2 h-4 w-4" /> Open workspace screen with guided instructions</Link></Button>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button variant="outline" disabled={step === 0} onClick={() => setStep(previous => Math.max(0, previous - 1))}><ArrowLeft className="mr-2 h-4 w-4" /> Previous</Button>
                        {step < selectedLesson.steps.length - 1 ? (
                          <Button onClick={() => setStep(previous => previous + 1)}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
                        ) : (
                          <Button onClick={() => markComplete(selectedLesson.id)} disabled={completed.includes(selectedLesson.id) || academy.mark.isPending || !academy.progress.isSuccess}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> {completed.includes(selectedLesson.id) ? "Completed" : "I completed this practice"}
                          </Button>
                        )}
                      </div>
                      {completed.includes(selectedLesson.id) && <Button size="sm" variant="ghost" disabled={academy.undo.isPending} onClick={() => undoCompletion(selectedLesson.id)}>Correct my completion record</Button>}
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
                    const pending = !isReady(lesson, editorReady, publicationReady, mediaReady, canonicalCommsReady, canonicalMarketingReady, canonicalPublisherReady, canonicalIssueReady, canonicalMediaReady, boardReady);
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
