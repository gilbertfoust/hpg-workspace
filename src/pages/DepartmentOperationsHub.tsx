import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, ClipboardCheck, FileText, GraduationCap, Megaphone, Newspaper, Plus, RefreshCcw, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDepartmentAction, useDepartmentOperations, type DepartmentLane, type OperationsRecord } from "@/hooks/useDepartmentOperations";
import { GuidedWalkthrough, type WalkthroughStep } from "@/components/onboarding/GuidedWalkthrough";
import { ensureSupabase } from "@/integrations/supabase/client";
import { usePublications, usePublishCommunicationsEditorial, useWithdrawCommunicationsEditorial } from "@/hooks/usePublications";

type RecordKind = "editorial" | "publications" | "campaigns" | "posts";
const kindBoard: Record<RecordKind, string> = {
  editorial: "communications_editorial", publications: "communications_publications",
  campaigns: "marketing_campaigns", posts: "marketing_social",
};
const kindTitle: Record<RecordKind, string> = {
  editorial: "Editorial stories and interviews", publications: "Magazine and publication issues",
  campaigns: "Marketing campaigns", posts: "Social-media posts",
};
const stageNext: Record<RecordKind, Record<string, string[]>> = {
  editorial: {
    pitch: ["assigned"], assigned: ["reporting", "drafting"], reporting: ["drafting"],
    drafting: ["editorial_review"], revisions: ["editorial_review"],
    editorial_review: ["revisions", "fact_check"], fact_check: ["revisions", "approval"],
    approval: ["revisions", "scheduled"],
  },
  publications: {
    planning: ["commissioning"], commissioning: ["production"], production: ["review"],
    review: ["changes_requested", "approved"], changes_requested: ["production", "review"],
    approved: ["scheduled"],
  },
  campaigns: {
    intake: ["strategy"], strategy: ["planning"], planning: ["production"],
    production: ["approvals"], approvals: ["changes_requested", "approved"],
    changes_requested: ["production", "approvals"], approved: ["scheduled", "changes_requested"],
    live: ["optimization"], optimization: ["reporting"], reporting: ["closed", "optimization"],
  },
  posts: {
    idea: ["brief"], brief: ["drafting"], drafting: ["creative", "review"],
    creative: ["drafting", "review"], review: ["changes_requested", "approved"],
    changes_requested: ["drafting", "creative", "review"], approved: ["scheduled", "changes_requested"],
    published: ["measured"], measured: ["archived"],
  },
};
const pretty = (text: string) => text.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
const iso = (date: string) => date ? new Date(date + "T12:00:00").toISOString() : undefined;
const yyyyMmDd = (date?: string | null) => date?.slice(0, 10) || "";
const localDateTime = (date?: string | null) => {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const dateTimeIso = (date: string) => date ? new Date(date).toISOString() : undefined;
const errText = (err: unknown) => err instanceof Error ? err.message : "Unable to complete the request.";
type Draft = {
  title: string; summary: string; ownerId: string; editorId: string; audience: string;
  platform: string; channels: string; campaignType: string; contentType: string;
  body: string; due: string; approvalType: string; decision: "approved" | "changes_requested" | "rejected";
  notes: string;
  campaignId: string;
  accountId: string;
  scheduled: string;
  designProof: string;
};
const defaultDraft = (): Draft => ({
  title: "", summary: "", ownerId: "none", editorId: "none", audience: "",
  platform: "facebook", channels: "website", campaignType: "awareness", contentType: "magazine_feature",
  body: "", due: "", approvalType: "editorial", decision: "approved", notes: "", campaignId: "none", accountId: "none", scheduled: "", designProof: "",
});
function countLabel(n: unknown) { return typeof n === "number" ? n.toLocaleString() : String(n ?? "0"); }

export default function DepartmentOperationsHub({ lane }: { lane: DepartmentLane }) {
  const communication = lane === "communications";
  const operations = useDepartmentOperations(lane);
  const action = useDepartmentAction(lane);
  const publicCatalog = usePublications();
  const publisher = usePublishCommunicationsEditorial();
  const withdrawPublication = useWithdrawCommunicationsEditorial();
  const publisherPermission = useQuery({
    queryKey: ["communications-publisher-authorization", lane],
    enabled: lane === "communications" && !!operations.data,
    retry: false,
    queryFn: async () => {
      const result = await ensureSupabase().rpc("is_communications_approver" as never);
      if (result.error) throw result.error;
      return result.data === true;
    },
  });
  const [tab, setTab] = useState<RecordKind>(communication ? "editorial" : "campaigns");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(defaultDraft);
  const [changeReason, setChangeReason] = useState("");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("none");
  const [versionBody, setVersionBody] = useState("");
  const [versionSummary, setVersionSummary] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState("document");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceConsent, setSourceConsent] = useState("not_required");
  const [consentSubject, setConsentSubject] = useState("");
  const [consentType, setConsentType] = useState("interview");
  const [reviewConsentId, setReviewConsentId] = useState("none");
  const [reviewConsentDecision, setReviewConsentDecision] = useState<"granted" | "not_required" | "declined" | "requested">("granted");
  const [reviewConsentEvidence, setReviewConsentEvidence] = useState("");
  const [reviewConsentScope, setReviewConsentScope] = useState("");
  const [reviewConsentExpiry, setReviewConsentExpiry] = useState("");
  const [placementCandidate, setPlacementCandidate] = useState("none");
  const [sectionName, setSectionName] = useState("");
  const [publicSlug, setPublicSlug] = useState("");
  const [releaseConfirmed, setReleaseConfirmed] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const data = operations.data;
  const records: OperationsRecord[] = data ? data[tab] || [] : [];
  const selected = records.find(row => row.id === selectedId);
  const livePublication = publicCatalog.data?.find(item => item.communications_editorial_item_id === selectedId);
  const publicUrl = (slug: string) => new URL(import.meta.env.BASE_URL + "publications/" + slug, window.location.origin).toString();
  const scheduledReady = !!selected?.scheduled_at && new Date(selected.scheduled_at).getTime() <= Date.now();
  const editorialSources = (data?.sources || []).filter(item => item.editorial_item_id === selectedId);
  const editorialRights = (data?.rights || []).filter(item => item.editorial_item_id === selectedId);
  const placements = (data?.placements || []).filter(item => item.publication_id === selectedId).sort((a,b) => a.position-b.position);
  const eligibleContents = (data?.editorial || []).filter(item => ["scheduled","published"].includes(item.status) && !placements.some(p => p.editorial_item_id === item.id));
  const filtered = useMemo(() => records.filter(row =>
    (row.title + " " + (row.pitch_summary || "") + " " + (row.objective || "") + " " + (row.platform || "")).toLowerCase().includes(search.toLowerCase())
  ), [records, search]);
  const stageOptions = selected ? stageNext[tab][selected.status] || [] : [];
  const counts = communication ? [
    ["Active editorial", data?.summary.active_editorial],
    ["Review queue", data?.summary.editorial_review_queue],
    ["Publications in production", data?.summary.publications_in_production],
    ["Overdue work", data?.summary.overdue_work],
  ] : [
    ["Active campaigns", data?.summary.active_campaigns],
    ["Scheduled posts", data?.summary.scheduled_posts],
    ["Creative under review", data?.summary.creative_in_review],
    ["Overdue work", data?.summary.overdue_cards],
  ];

  useEffect(() => { setSelectedId(null); setSearch(""); setStage("none"); setChangeReason(""); }, [tab, lane]);
  useEffect(() => {
    if (!selected) return;
    setDraft({
      title: selected.title || "", summary: String(selected.pitch_summary || selected.objective || ""),
      ownerId: selected.production_owner_user_id || selected.owner_user_id || "none", editorId: selected.editor_user_id || selected.strategist_user_id || "none",
      audience: String(selected.audience_segment || selected.target_audience || ""),
      platform: String(selected.platform || "facebook"), channels: (selected.channels || []).join(", "),
      campaignType: String(selected.campaign_type || "awareness"), contentType: String(selected.content_type || "magazine_feature"),
      body: String(selected.body_text || ""), due: yyyyMmDd(selected.due_at),
      approvalType: tab === "editorial" ? "editorial" : tab === "publications" ? "publication" : "marketing",
      decision: "approved", notes: "", campaignId: selected.campaign_id || "none", accountId: selected.channel_account_id || "none",
      scheduled: localDateTime(selected.scheduled_at), designProof: selected.design_proof_url || "",
    });
    setStage("none"); setVersionBody(""); setVersionSummary("");
    setSourceName(""); setSourceUrl(""); setConsentSubject(""); setPlacementCandidate("none");
    setPublicSlug(selected.title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 82));
    setReleaseConfirmed(false); setWithdrawReason("");
    setReviewConsentId("none"); setReviewConsentEvidence(""); setReviewConsentScope(""); setReviewConsentExpiry("");
  }, [selectedId, selected?.updated_at, selected?.current_version, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const newRecord = () => {
    setSelectedId(null);
    setDraft(defaultDraft());
    setCreateOpen(true);
  };
  const createRecord = async () => {
    const owner = draft.ownerId === "none" ? null : draft.ownerId;
    const editor = draft.editorId === "none" ? null : draft.editorId;
    const channels = draft.channels.split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
    let record: Record<string, unknown>;
    if (tab === "editorial") {
      record = {
        title: draft.title.trim(), pitch_summary: draft.summary.trim(),
        content_type: draft.contentType, owner_user_id: owner, editor_user_id: editor,
        due_at: iso(draft.due), scheduled_at: dateTimeIso(draft.scheduled), channels, sensitivity: "routine", priority: "medium",
      };
    } else if (tab === "publications") {
      record = {
        title: draft.title.trim(), publication_type: "magazine_issue",
        audience_segment: draft.audience.trim(), editor_user_id: editor,
        production_owner_user_id: owner, due_at: iso(draft.due), scheduled_at: dateTimeIso(draft.scheduled), channels, priority: "medium",
      };
    } else if (tab === "campaigns") {
      record = {
        title: draft.title.trim(), objective: draft.summary.trim(),
        campaign_type: draft.campaignType, target_audience: draft.audience.trim(),
        primary_cta: draft.body.trim(), channels, owner_user_id: owner,
        strategist_user_id: editor, scheduled_at: dateTimeIso(draft.scheduled), communications_review_required: true, priority: "medium",
      };
    } else {
      record = {
        title: draft.title.trim(), platform: draft.platform,
        body_text: draft.body.trim(), post_format: "text",
        owner_user_id: owner, scheduled_at: dateTimeIso(draft.scheduled), communications_review_required: true, priority: "medium",
        campaign_id: draft.campaignId === "none" ? null : draft.campaignId,
        channel_account_id: draft.accountId === "none" ? null : draft.accountId,
      };
    }
    try {
      const id = await action.mutateAsync({ action: "create", lane, board: kindBoard[tab], record });
      await operations.refetch();
      setCreateOpen(false);
      setSelectedId(id ? String(id) : null);
      toast.success("Created in the existing " + pretty(lane) + " workflow.");
    } catch (error) { toast.error(errText(error)); }
  };
  const saveDetails = async () => {
    if (!selected) return;
    if (tab === "publications" && draft.designProof.trim() && !/^https:\/\/\S+$/i.test(draft.designProof.trim())) {
      toast.error("Magazine design proofs must use an HTTPS URL.");
      return;
    }
    const owner = draft.ownerId === "none" ? "" : draft.ownerId;
    const editor = draft.editorId === "none" ? "" : draft.editorId;
    const changes: Record<string, unknown> = {};
    const updateIfChanged = (key: string, current: unknown, target: unknown) => {
      if (JSON.stringify(current ?? "") !== JSON.stringify(target ?? "")) changes[key] = target;
    };
    updateIfChanged("title", selected.title, draft.title.trim());
    if (tab === "editorial") {
      updateIfChanged("pitch_summary", selected.pitch_summary, draft.summary.trim());
      updateIfChanged("owner_user_id", selected.owner_user_id, owner);
      updateIfChanged("editor_user_id", selected.editor_user_id, editor);
      if (draft.due !== yyyyMmDd(selected.due_at)) changes.due_at = iso(draft.due) || "";
      if (draft.scheduled !== localDateTime(selected.scheduled_at)) changes.scheduled_at = dateTimeIso(draft.scheduled) || "";
    } else if (tab === "publications") {
      updateIfChanged("audience_segment", selected.audience_segment, draft.audience.trim());
      updateIfChanged("editor_user_id", selected.editor_user_id, editor);
      updateIfChanged("production_owner_user_id", selected.production_owner_user_id, owner);
      if (draft.due !== yyyyMmDd(selected.due_at)) changes.due_at = iso(draft.due) || "";
      if (draft.scheduled !== localDateTime(selected.scheduled_at)) changes.scheduled_at = dateTimeIso(draft.scheduled) || "";
      updateIfChanged("design_proof_url", selected.design_proof_url, draft.designProof.trim());
    } else if (tab === "campaigns") {
      updateIfChanged("objective", selected.objective, draft.summary.trim());
      updateIfChanged("target_audience", selected.target_audience, draft.audience.trim());
      updateIfChanged("primary_cta", selected.primary_cta, draft.body.trim());
      updateIfChanged("owner_user_id", selected.owner_user_id, owner);
      updateIfChanged("strategist_user_id", selected.strategist_user_id, editor);
      const channels = draft.channels.split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
      if (JSON.stringify(selected.channels || []) !== JSON.stringify(channels)) changes.channels = channels;
      if (draft.scheduled !== localDateTime(selected.scheduled_at)) changes.scheduled_at = dateTimeIso(draft.scheduled) || "";
    } else {
      updateIfChanged("body_text", selected.body_text, draft.body.trim());
      updateIfChanged("platform", selected.platform, draft.platform);
      updateIfChanged("owner_user_id", selected.owner_user_id, owner);
      updateIfChanged("channel_account_id", selected.channel_account_id, draft.accountId === "none" ? "" : draft.accountId);
      if (draft.scheduled !== localDateTime(selected.scheduled_at)) changes.scheduled_at = dateTimeIso(draft.scheduled) || "";
    }
    if (Object.keys(changes).length === 0) {
      toast.info("No changes to save.");
      return;
    }
    try {
      await action.mutateAsync({ action: "update", lane, board: kindBoard[tab], id: selected.id, changes, reason: changeReason.trim() });
      toast.success("Changes saved through departmental review controls");
      setChangeReason("");
    } catch (error) { toast.error(errText(error)); }
  };
  const advance = async () => {
    if (!selected || stage === "none") return;
    try {
      await action.mutateAsync({ action: "transition", lane, board: kindBoard[tab], id: selected.id, target: stage, reason: changeReason.trim() });
      setStage("none"); setChangeReason("");
      toast.success("Workflow stage updated");
    } catch (error) { toast.error(errText(error)); }
  };
  const submitVersion = async () => {
    if (!selected) return;
    const entityType = tab === "editorial" ? "editorial_item" : tab === "campaigns" ? "campaign" : "social_post";
    try {
      await action.mutateAsync({
        action: "version", lane, entityType, id: selected.id, headline: selected.title,
        body: versionBody.trim(), summary: communication ? versionSummary.trim() : "Staff-submitted packet",
      });
      setVersionBody(""); setVersionSummary("");
      toast.success("Version submitted and recorded");
    } catch (error) { toast.error(errText(error)); }
  };
  const review = async () => {
    if (!selected) return;
    const entityType = tab === "editorial" ? "editorial_item" : tab === "publications" ? "publication" : tab === "campaigns" ? "campaign" : "social_post";
    try {
      await action.mutateAsync({
        action: "approve", lane, entityType, id: selected.id, approvalType: draft.approvalType,
        decision: draft.decision, notes: draft.notes,
      });
      toast.success("Review decision recorded by the canonical workflow");
    } catch (error) { toast.error(errText(error)); }
  };
  const addSource = async () => {
    if (!selected || !sourceName.trim()) return;
    if (sourceUrl.trim() && !/^https:\/\/[^\s]+$/i.test(sourceUrl.trim())) {
      toast.error("Source URLs must use HTTPS.");
      return;
    }
    try {
      await action.mutateAsync({ action: "source", lane, id: selected.id, sourceName, sourceType, sourceUrl, consentStatus: sourceConsent });
      setSourceName(""); setSourceUrl("");
      toast.success("Source recorded in the canonical editorial evidence register");
    } catch (error) { toast.error(errText(error)); }
  };
  const addConsentRequirement = async () => {
    if (!selected || !consentSubject.trim()) return;
    try {
      await action.mutateAsync({ action: "consent", lane, id: selected.id, subject: consentSubject, consentType });
      setConsentSubject("");
      toast.success("Required consent recorded; proof and verification are still needed");
    } catch (error) { toast.error(errText(error)); }
  };
  const reviewConsent = async () => {
    if (reviewConsentId === "none") return;
    try {
      await action.mutateAsync({
        action: "consentDecision", lane, id: reviewConsentId,
        decision: reviewConsentDecision,
        evidenceUrl: reviewConsentEvidence.trim(),
        scopeNotes: reviewConsentScope.trim(),
        expiresAt: reviewConsentExpiry ? new Date(reviewConsentExpiry + "T12:00:00").toISOString() : null,
      });
      setReviewConsentId("none"); setReviewConsentEvidence(""); setReviewConsentScope(""); setReviewConsentExpiry("");
      toast.success("Independent consent decision and evidence recorded");
    } catch (error) { toast.error(errText(error)); }
  };
  const addPlacement = async () => {
    if (!selected || placementCandidate === "none") return;
    try {
      await action.mutateAsync({ action: "place", lane, id: selected.id, editorialId: placementCandidate, sectionName });
      setPlacementCandidate("none"); setSectionName("");
      toast.success("Approved story placed into the magazine issue");
    } catch (error) { toast.error(errText(error)); }
  };
  const removePlacement = async (placementId: string) => {
    if (!selected) return;
    try {
      await action.mutateAsync({ action: "removePlacement", lane, id: selected.id, placementId });
      toast.success("Story removed from the issue");
    } catch (error) { toast.error(errText(error)); }
  };
  const publishCanonical = async () => {
    if (!selected || !releaseConfirmed) return;
    try {
      const snapshot = await publisher.mutateAsync({ id: selected.id, slug: publicSlug });
      setReleaseConfirmed(false);
      toast.success("Approved editorial text released: " + publicUrl(snapshot.slug));
    } catch (error) { toast.error(errText(error)); }
  };
  const withdrawCanonical = async () => {
    if (!selected) return;
    try {
      await withdrawPublication.mutateAsync({ id: selected.id, reason: withdrawReason.trim() });
      setWithdrawReason("");
      toast.success("Public edition withdrawn. Previously cached copies may still exist.");
    } catch (error) { toast.error(errText(error)); }
  };
  const canSubmitVersion = !!selected && (tab === "editorial" ? ["assigned", "reporting", "drafting", "revisions"].includes(selected.status) :
    tab === "campaigns" ? ["strategy", "planning", "production", "changes_requested"].includes(selected.status) :
      tab === "posts" && ["brief", "drafting", "creative", "changes_requested"].includes(selected.status));
  const canReview = !!selected && (tab === "editorial" ? ["editorial_review", "fact_check", "approval", "scheduled"].includes(selected.status) :
    tab === "publications" ? ["review", "scheduled"].includes(selected.status) :
      tab === "campaigns" ? ["approvals", "changes_requested"].includes(selected.status) :
        ["review", "changes_requested"].includes(selected.status));
  const walkthroughSteps = useMemo<WalkthroughStep[]>(() => [
    { target: '[data-tour="department-intro"]', title: "Your operational hub", text: "This page reads the department's real workflow database. Drafting and review take place here; public distribution still requires separate approval and verified evidence." },
    { target: '[data-tour="department-metrics"]', title: "Understand the workload", text: "These figures come from the department's existing operational reporting functions, not sample course data." },
    { target: '[data-tour="department-tabs"]', title: "Choose your work area", text: communication ? "Use Editorial for stories and interviews or Magazine issues to assemble approved contributions. Schedule shows planned dates." : "Use Campaigns, Social posts, Schedule, and Accounts to locate your approved area of responsibility." },
    { target: '[data-tour="department-records"]', title: "Select a record", text: "Choose an existing record to see status, owner, draft details and approvals. Do not create practice records in the production workspace." },
    ...(selected ? [{ target: '[data-tour="department-details"]', title: "Inspect this assignment", text: "Edit only your authorized fields and save. A substantive change may reopen approvals. Work Items remain linked when a task was generated by the backend." }] : []),
    ...(selected && stageOptions.length ? [{ target: '[data-tour="department-transition"]', title: "Understand the stage gate", text: "The database checks the required owner, source, version, consent, and approval evidence before it accepts a move to the next stage." }] : []),
  ], [communication, selected, stageOptions.length]);
  const editable = !!selected && !(communication ? ["published", "distributed", "archived", "canceled"].includes(selected.status) : ["published", "measured", "archived", "closed", "canceled", "live", "optimization", "reporting"].includes(selected.status));

  return <MainLayout title={communication ? "Communications Operations" : "Marketing Operations"}
    subtitle={communication ? "Canonical editorial and magazine production records, assignments, and review." : "Canonical campaign and social workflow, channel inventory, approvals, and schedules."}
    actions={<Button data-tour="department-new" disabled={!data} onClick={newRecord}><Plus className="mr-2 h-4 w-4" /> New {tab === "editorial" ? "story" : tab === "publications" ? "issue" : tab === "campaigns" ? "campaign" : "post"}</Button>}>
    <div className="space-y-5">
      <Card data-tour="department-intro">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex-1">
            <p className="font-semibold">Working with HPG's original department records</p>
            <p className="text-sm text-muted-foreground">This screen uses existing approved workflow functions and keeps tasks, version history, approvals, and publication evidence connected. Drafting and status changes do not post to public channels.</p>
          </div>
          <GuidedWalkthrough steps={walkthroughSteps} />
          <Button size="sm" variant="outline" asChild><Link to={"/learning?track=" + lane}><GraduationCap className="mr-1 h-4 w-4" /> Tutorial</Link></Button>
          <Button size="sm" variant="outline" onClick={() => operations.refetch()}><RefreshCcw className="mr-1 h-4 w-4" /> Refresh</Button>
          <Button size="sm" variant="outline" asChild><Link to={communication ? "/communications/editorial" : "/marketing/assignments"}>
            {communication ? "Standalone editorial editor" : "Assignment tracking"}</Link></Button>
        </CardContent>
      </Card>
      {operations.isLoading && <p className="text-sm text-muted-foreground">Checking department permissions and loading canonical records…</p>}
      {operations.error && <Card><CardContent className="p-6 text-sm text-destructive" role="alert">{errText(operations.error)}. Check department membership and authorization before continuing.</CardContent></Card>}
      {!!data && <>
        <div data-tour="department-metrics" className="grid gap-3 sm:grid-cols-4">
          {counts.map(([label, value]) => <Card key={String(label)}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{countLabel(value)}</p>
          </CardContent></Card>)}
        </div>
        <Tabs defaultValue={communication ? "editorial" : "campaigns"} onValueChange={value => {
          if (value !== "calendar" && value !== "channels") setTab(value as RecordKind);
        }}>
          <TabsList data-tour="department-tabs" className="h-auto flex-wrap justify-start">
            {communication ? <>
              <TabsTrigger value="editorial"><Newspaper className="mr-1 h-4 w-4" /> Editorial</TabsTrigger>
              <TabsTrigger value="publications"><FileText className="mr-1 h-4 w-4" /> Magazine issues</TabsTrigger>
            </> : <>
              <TabsTrigger value="campaigns"><Megaphone className="mr-1 h-4 w-4" /> Campaigns</TabsTrigger>
              <TabsTrigger value="posts"><FileText className="mr-1 h-4 w-4" /> Social posts</TabsTrigger>
            </>}
            <TabsTrigger value="calendar"><CalendarDays className="mr-1 h-4 w-4" /> Schedule</TabsTrigger>
            {!communication && <TabsTrigger value="channels"><Users className="mr-1 h-4 w-4" /> Accounts</TabsTrigger>}
          </TabsList>
          {(communication ? ["editorial", "publications"] : ["campaigns", "posts"]).map(name =>
            <TabsContent key={name} value={name} className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <Card data-tour="department-records" className="h-fit">
                <CardHeader><CardTitle className="text-lg">{kindTitle[name as RecordKind]}</CardTitle>
                  <CardDescription>Records from the department's existing database, not duplicate work items.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title or subject" aria-label="Search records" />
                  <div className="max-h-[560px] space-y-2 overflow-auto">
                    {filtered.length === 0 && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No matching records. New work can be created using the button above.</p>}
                    {filtered.map(item => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)}
                      className={"block w-full rounded-lg border p-3 text-left hover:bg-muted/40 " + (selectedId === item.id ? "border-primary bg-primary/5" : "")}>
                      <p className="text-sm font-semibold">{item.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="outline">{pretty(item.status)}</Badge>
                        {item.due_at && <span className="text-xs text-muted-foreground">{yyyyMmDd(item.due_at)}</span>}
                      </div>
                    </button>)}
                  </div>
                </CardContent>
              </Card>
              {!selected ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
                Select a record to inspect its owner, draft, stage, and evidence requirements. Nothing on this screen automatically publishes or sends content.
              </CardContent></Card> : <div className="space-y-4">
                <Card data-tour="department-details">
                  <CardHeader><CardTitle>{selected.title}</CardTitle>
                    <CardDescription className="flex flex-wrap gap-2"><Badge>{pretty(selected.status)}</Badge>
                      <Badge variant="outline">Workflow version {selected.current_version ?? 0}</Badge>
                      {selected.work_item_id && <Link className="text-primary underline" to={"/work-items?workItemId=" + selected.work_item_id}>Open linked task</Link>}
                    </CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1"><Label>Title</Label><Input value={draft.title} maxLength={240} disabled={!editable} onChange={e => setDraft(v => ({ ...v, title: e.target.value }))} /></div>
                    {(tab === "editorial" || tab === "campaigns") && <div className="space-y-1"><Label>{tab === "editorial" ? "Story brief" : "Campaign objective"}</Label><Textarea rows={3} value={draft.summary} disabled={!editable} onChange={e => setDraft(v => ({ ...v, summary: e.target.value }))} /></div>}
                    {(tab === "campaigns" || tab === "posts") && <div className="space-y-1"><Label>{tab === "posts" ? "Post text" : "Primary call to action"}</Label><Textarea rows={tab === "posts" ? 7 : 2} value={draft.body} disabled={!editable} onChange={e => setDraft(v => ({ ...v, body: e.target.value }))} /></div>}
                    {(tab === "campaigns" || tab === "publications") && <div className="space-y-1"><Label>{tab === "campaigns" ? "Target audience" : "Audience segment"}</Label><Input value={draft.audience} disabled={!editable} onChange={e => setDraft(v => ({ ...v, audience: e.target.value }))} /></div>}
                    {tab === "campaigns" && <div className="space-y-1"><Label>Channels (comma-separated)</Label><Input value={draft.channels} disabled={!editable} onChange={e => setDraft(v => ({ ...v, channels: e.target.value }))} /></div>}
                    {tab === "posts" && <div className="space-y-1"><Label>Platform</Label><Select value={draft.platform} disabled={!editable} onValueChange={v => setDraft(s => ({ ...s, platform: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["facebook","instagram","linkedin","x","youtube","tiktok","threads","pinterest","other"].map(v => <SelectItem key={v} value={v}>{pretty(v)}</SelectItem>)}</SelectContent></Select></div>}
                    {tab === "posts" && <div className="space-y-1"><Label>Registered channel account (optional)</Label>
                      <Select value={draft.accountId} disabled={!editable} onValueChange={v => setDraft(s => ({ ...s, accountId: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">No account selected</SelectItem>{data.accounts.map(account => <SelectItem key={account.id} value={account.id}>{pretty(account.platform)} — {account.scope_name}</SelectItem>)}</SelectContent>
                      </Select>
                      {selected.campaign_id && <p className="text-xs text-muted-foreground">Linked campaign: {data.campaigns.find(c => c.id === selected.campaign_id)?.title || selected.campaign_id}</p>}
                    </div>}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1"><Label>{tab === "publications" ? "Production owner" : "Assigned owner"}</Label>
                        <Select value={draft.ownerId} disabled={!editable} onValueChange={v => setDraft(s => ({ ...s, ownerId: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Unassigned</SelectItem>{(data.people||[]).map(p=><SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent></Select>
                      </div>
                      {tab !== "posts" && <div className="space-y-1"><Label>{tab === "campaigns" ? "Strategist" : "Editor"}</Label>
                        <Select value={draft.editorId} disabled={!editable} onValueChange={v => setDraft(s => ({ ...s, editorId: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Unassigned</SelectItem>{(data.people||[]).map(p=><SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent></Select>
                      </div>}
                    </div>
                    {(tab === "editorial" || tab === "publications") && <div className="space-y-1"><Label>Due date</Label><Input type="date" value={draft.due} disabled={!editable} onChange={e=>setDraft(s=>({...s,due:e.target.value}))}/></div>}
                    <div className="space-y-1"><Label>Planned publication, distribution or launch time</Label><Input type="datetime-local" value={draft.scheduled} disabled={!editable} onChange={e => setDraft(v => ({ ...v, scheduled: e.target.value }))} />
                      <p className="text-xs text-muted-foreground">Planning a time never posts or distributes content automatically.</p></div>
                    {tab === "publications" && <div className="space-y-1"><Label>Design or campaign proof (HTTPS)</Label><Input type="url" value={draft.designProof} disabled={!editable} placeholder="https://..." onChange={e => setDraft(v => ({ ...v, designProof: e.target.value }))} />
                      <p className="text-xs text-muted-foreground">A valid proof is required before the magazine issue can enter review.</p></div>}
                    {editable && <>
                      <div className="space-y-1"><Label>Revision reason (required when material has already been reviewed)</Label><Input value={changeReason} onChange={e=>setChangeReason(e.target.value)} placeholder="Explain changes after review" /></div>
                      <Button disabled={action.isPending || draft.title.trim().length < 3} onClick={saveDetails}>Save changes through workflow</Button>
                    </>}
                    <p className="text-xs text-muted-foreground">The database determines which revisions are permitted and can reopen a review cycle if material changes after approval.</p>
                  </CardContent>
                </Card>
                {tab === "editorial" && <Card>
                  <CardHeader><CardTitle className="text-base">Sources and consent evidence</CardTitle>
                    <CardDescription>Journalism, interviews and impact stories require documented sources. Publishing sensitive stories may require verified consent and separate Legal approval.</CardDescription></CardHeader>
                  <CardContent className="space-y-5">
                    <div>
                      <p className="mb-2 text-sm font-medium">Recorded sources ({editorialSources.length})</p>
                      {editorialSources.length === 0 && <p className="text-xs text-muted-foreground">No sources recorded. A sourced story cannot advance to drafting.</p>}
                      {editorialSources.map(source => <div key={source.id} className="flex flex-wrap gap-2 border-b py-2 text-sm">
                        <span className="flex-1 font-medium">{source.source_name}</span>
                        <Badge variant="outline">{pretty(source.source_type)}</Badge>
                        <Badge variant="secondary">{pretty(source.consent_status)}</Badge>
                        {source.source_url?.startsWith("https://") && <a className="text-primary underline" href={source.source_url} target="_blank" rel="noopener noreferrer">Evidence</a>}
                      </div>)}
                    </div>
                    <div className="space-y-2 rounded-lg border p-3">
                      <p className="text-sm font-medium">Record a source</p>
                      <Input aria-label="Source name" placeholder="Source or document name" value={sourceName} onChange={e => setSourceName(e.target.value)} />
                      <Input aria-label="Source evidence URL" placeholder="https://... (optional verified source)" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} />
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Select value={sourceType} onValueChange={setSourceType}><SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{["document","interview","dataset","official_record","expert","participant","observation","other"].map(v => <SelectItem key={v} value={v}>{pretty(v)}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={sourceConsent} onValueChange={setSourceConsent}><SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{["not_required","requested","restricted"].map(v => <SelectItem key={v} value={v}>Consent: {pretty(v)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <Button size="sm" variant="outline" disabled={action.isPending || sourceName.trim().length < 2} onClick={addSource}>Save source</Button>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium">Rights and consent determinations ({editorialRights.length})</p>
                      {editorialRights.length === 0 && <p className="text-xs text-muted-foreground">No rights determinations recorded.</p>}
                      {editorialRights.map(right => <div key={right.id} className="flex flex-wrap items-center gap-2 border-b py-2 text-sm">
                        <span className="flex-1">{right.subject_reference}</span>
                        <Badge variant="outline">{pretty(right.consent_type)}</Badge>
                        <Badge variant="secondary">{pretty(right.status)}</Badge>
                        {right.expires_at && <span className="text-xs text-muted-foreground">Expires {new Date(right.expires_at).toLocaleDateString()}</span>}
                        {right.evidence_url?.startsWith("https://") && <a href={right.evidence_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">View evidence</a>}
                      </div>)}
                    </div>
                    <div className="space-y-2 rounded-lg border p-3">
                      <p className="text-sm font-medium">Register a consent requirement</p>
                      <Input placeholder="Interviewee / rights holder" aria-label="Consent subject" value={consentSubject} onChange={e => setConsentSubject(e.target.value)} />
                      <Select value={consentType} onValueChange={setConsentType}><SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{["interview","quotation","photograph","video","audio","beneficiary_story","minor_guardian","license","other"].map(v => <SelectItem key={v} value={v}>{pretty(v)}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" disabled={action.isPending || consentSubject.trim().length < 2} onClick={addConsentRequirement}>Save pending consent requirement</Button>
                      <p className="text-xs text-muted-foreground">This only records that consent is required. It does not certify that permission was granted or verified.</p>
                    </div>
                    {publisherPermission.data === true && editorialRights.length > 0 &&
                      !["published","archived","canceled"].includes(selected.status) && <div data-tour="consent-review" className="space-y-3 rounded-lg border border-primary/20 p-3">
                      <p className="text-sm font-semibold">Independent consent review</p>
                      <p className="text-xs text-muted-foreground">Only an authorized Communications reviewer other than the person who registered the requirement can record a decision. Granted permission requires an HTTPS evidence link and a defined scope.</p>
                      <div className="space-y-1"><Label>Consent record</Label>
                        <Select value={reviewConsentId} onValueChange={setReviewConsentId}><SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="none">Choose rights record</SelectItem>
                            {editorialRights.map(right => <SelectItem key={right.id} value={right.id}>{right.subject_reference} — {pretty(right.status)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1"><Label>Decision</Label>
                        <Select value={reviewConsentDecision} onValueChange={value => setReviewConsentDecision(value as typeof reviewConsentDecision)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="granted">Permission granted — evidence required</SelectItem>
                            <SelectItem value="not_required">Not required — explain why</SelectItem>
                            <SelectItem value="requested">Permission requested / reopened</SelectItem>
                            <SelectItem value="declined">Permission declined</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1"><Label>Scope and decision rationale</Label>
                        <Textarea rows={3} value={reviewConsentScope} onChange={e => setReviewConsentScope(e.target.value)}
                          placeholder="Describe the specific publication, media use, audience, permissions or reason for this decision" />
                      </div>
                      <div className="space-y-1"><Label>Evidence link (HTTPS; required if granted)</Label>
                        <Input type="url" value={reviewConsentEvidence} onChange={e => setReviewConsentEvidence(e.target.value)}
                          placeholder="https://... to the authorized release or permission document" />
                      </div>
                      {reviewConsentDecision === "granted" && <div className="space-y-1">
                        <Label>Consent expiration, if applicable</Label>
                        <Input type="date" value={reviewConsentExpiry} onChange={e => setReviewConsentExpiry(e.target.value)} />
                      </div>}
                      <Button variant="outline" disabled={action.isPending || reviewConsentId === "none" ||
                        reviewConsentScope.trim().length < 10 ||
                        (reviewConsentDecision === "granted" && !/^https:\/\/\S+$/i.test(reviewConsentEvidence.trim()))}
                        onClick={reviewConsent}>Record independent decision</Button>
                    </div>}
                  </CardContent>
                </Card>}
                {tab === "publications" && <Card>
                  <CardHeader><CardTitle className="text-base">Magazine story placements</CardTitle>
                    <CardDescription>Existing Communications rules permit only scheduled or published approved stories to be placed into issues.</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    {!placements.length && <p className="text-sm text-muted-foreground">No approved stories are placed in this issue yet.</p>}
                    {placements.map(item => <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
                      <span className="flex-1">{(data.editorial || []).find(e => e.id === item.editorial_item_id)?.title || "Editorial record"}</span>
                      {item.section_name && <Badge variant="secondary">{item.section_name}</Badge>}
                      {["planning","commissioning","production","changes_requested"].includes(selected.status) &&
                        <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => removePlacement(item.id)}>Remove</Button>}
                    </div>)}
                    {["planning","commissioning","production","changes_requested"].includes(selected.status) &&
                      <div className="space-y-2 rounded-md border p-3">
                        <Label>Approved story to add</Label>
                        <Select value={placementCandidate} onValueChange={setPlacementCandidate}><SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="none">Choose a scheduled or published story</SelectItem>
                            {eligibleContents.map(item => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input aria-label="Magazine section" placeholder="Issue section (optional)" value={sectionName} onChange={e => setSectionName(e.target.value)} />
                        <Button size="sm" disabled={action.isPending || placementCandidate === "none"} onClick={addPlacement}>Add approved contribution</Button>
                        <p className="text-xs text-muted-foreground">Placement does not approve the issue. The separate proof and independent publication approvals still apply.</p>
                      </div>}
                  </CardContent>
                </Card>}
                {tab === "editorial" && ["scheduled","published"].includes(selected.status) && <Card data-tour="canonical-public-release">
                  <CardHeader><CardTitle className="text-base">HPG public edition</CardTitle>
                    <CardDescription>Publish an immutable copy of approved text to HPG Publications. This is separate from external social posting, distribution emails and private media storage.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {livePublication && <div className="rounded-md border p-3">
                      <p className="text-sm font-semibold">Public text is live</p>
                      <a className="block break-all text-sm text-primary underline" href={publicUrl(livePublication.slug)} target="_blank" rel="noopener noreferrer">{publicUrl(livePublication.slug)}</a>
                    </div>}
                    {selected.status === "scheduled" && publisherPermission.data === true && !livePublication && <>
                      <div className="space-y-1"><Label htmlFor="canonical-public-slug">Public URL name</Label>
                        <Input id="canonical-public-slug" value={publicSlug}
                          onChange={e => setPublicSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="approved-story" />
                      </div>
                      <label className="flex items-start gap-2 text-sm">
                        <Checkbox checked={releaseConfirmed} onCheckedChange={checked => setReleaseConfirmed(checked === true)} />
                        I have reviewed the exact final text, current approvals, consent, embargo, sensitive information, and rights for this public release.
                      </label>
                      {!scheduledReady && <p className="text-sm text-muted-foreground">The scheduled release time has not arrived. Publication will remain locked until then.</p>}
                      <Button onClick={publishCanonical} disabled={publisher.isPending || !scheduledReady || !releaseConfirmed ||
                        !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(publicSlug) || publicSlug.length < 4 || publicSlug.length > 90}>
                        {publisher.isPending ? "Releasing…" : "Publish approved text to HPG"}
                      </Button>
                    </>}
                    {livePublication && publisherPermission.data === true && <div className="space-y-2 border-t pt-3">
                      <Label>Withdraw the public edition (reason required)</Label>
                      <Textarea rows={2} value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)}
                        placeholder="Explain why this public page must be withdrawn" />
                      <Button variant="outline" disabled={withdrawPublication.isPending || withdrawReason.trim().length < 10} onClick={withdrawCanonical}>
                        Withdraw from public archive
                      </Button>
                    </div>}
                    {selected.status === "published" && !livePublication && <p className="text-sm text-muted-foreground">This item has a recorded publication history, but no currently live HPG Publications snapshot. It may have been withdrawn or published elsewhere. Do not assume the historical URL is still accessible.</p>}
                    <p className="text-xs text-muted-foreground">The database rechecks the current independent editorial, fact-check, publication and applicable Legal approvals before any release. No consent documents or private media are copied to this page.</p>
                  </CardContent>
                </Card>}
                {!!stageOptions.length && <Card data-tour="department-transition">
                  <CardHeader><CardTitle className="text-base">Move to the next stage</CardTitle><CardDescription>Stages must pass the underlying source, approvals, rights and evidence gates. No external publishing is triggered.</CardDescription></CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Select value={stage} onValueChange={setStage}><SelectTrigger className="min-w-52 flex-1"><SelectValue placeholder="Choose allowed next stage" /></SelectTrigger>
                      <SelectContent><SelectItem value="none">Choose stage</SelectItem>{stageOptions.map(v=><SelectItem key={v} value={v}>{pretty(v)}</SelectItem>)}</SelectContent></Select>
                    <Button disabled={stage === "none" || action.isPending} onClick={advance}>Advance <ArrowRight className="ml-1 h-4 w-4" /></Button>
                  </CardContent>
                </Card>}
                {canSubmitVersion && <Card>
                  <CardHeader><CardTitle className="text-base">Submit a numbered version</CardTitle><CardDescription>{communication ? "Submit the current story text; source evidence and required review are controlled by the Communications workflow." : "Freeze the currently saved campaign or social packet for review. Save details before submitting a version."}</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    {communication && <>
                      <div className="space-y-1"><Label>Headline</Label><Input value={selected.title} readOnly /></div>
                      <div className="space-y-1"><Label>Draft article or interview text</Label><Textarea rows={9} value={versionBody} onChange={e=>setVersionBody(e.target.value)} placeholder="Use at least 20 characters of substantive draft text" /></div>
                      <div className="space-y-1"><Label>Subtitle / description</Label><Input value={versionSummary} onChange={e=>setVersionSummary(e.target.value)} /></div>
                    </>}
                    <Button disabled={action.isPending || (communication && versionBody.trim().length < 20)} onClick={submitVersion}><FileText className="mr-1 h-4 w-4" /> Submit numbered version</Button>
                  </CardContent>
                </Card>}
                {canReview && <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Review and approval</CardTitle>
                    <CardDescription>Only an independently authorized reviewer can approve work. Source, legal, finance, and publication requirements remain active.</CardDescription></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1"><Label>Review type</Label>
                        <Select value={draft.approvalType} onValueChange={v=>setDraft(s=>({...s,approvalType:v}))}>
                          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                            {(communication ? (tab === "editorial" ? ["editorial","fact_check","legal","executive","publication"] : ["publication","distribution"]) : ["marketing","communications","legal","brand","finance","development","program","executive"]).map(v=><SelectItem key={v} value={v}>{pretty(v)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1"><Label>Decision</Label>
                        <Select value={draft.decision} onValueChange={v=>setDraft(s=>({...s,decision:v as Draft["decision"]}))}>
                          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["approved","changes_requested","rejected"].map(v=><SelectItem key={v} value={v}>{pretty(v)}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Textarea rows={3} placeholder="Reviewer findings and evidence rationale" value={draft.notes} onChange={e=>setDraft(s=>({...s,notes:e.target.value}))}/>
                    <Button disabled={action.isPending || (draft.decision !== "approved" && !draft.notes.trim())} variant="outline" onClick={review}><ClipboardCheck className="mr-1 h-4 w-4" /> Record review decision</Button>
                  </CardContent>
                </Card>}
                <Card><CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
                  <p><strong>Release controls:</strong> Scheduling, distribution and publishing are not automatic. Approved releases require the separate verified-evidence workflow.</p>
                  {communication ? <Button size="sm" variant="outline" asChild><Link to="/communications/editorial">Open standalone editorial edition desk</Link></Button> :
                    <Button size="sm" variant="outline" asChild><Link to="/modules/marketing">Marketing dashboard</Link></Button>}
                </CardContent></Card>
              </div>}
            </TabsContent>
          )}
          <TabsContent value="calendar" className="mt-4"><Card>
            <CardHeader><CardTitle className="text-lg">Department schedule</CardTitle><CardDescription>These are planned dates, not proof of posting or distribution.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {!data.calendar.length && <p className="text-sm text-muted-foreground">No dated records have been scheduled in this department.</p>}
              {data.calendar.filter(event => !!event.starts_at).slice(0,120).map((e,i)=><div key={e.id + ":" + i} className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
                <CalendarDays className="h-4 w-4 text-muted-foreground" /><p className="min-w-48 flex-1 font-medium">{e.title}</p>
                <Badge variant="outline">{pretty(e.kind)}</Badge><Badge variant="secondary">{pretty(e.status)}</Badge>
                <span className="text-xs text-muted-foreground">{e.starts_at ? new Date(e.starts_at).toLocaleDateString() : "TBD"}</span>
              </div>)}
            </CardContent>
          </Card></TabsContent>
          {!communication && <TabsContent value="channels" className="mt-4"><Card>
            <CardHeader><CardTitle className="text-lg">Registered marketing channel accounts</CardTitle>
              <CardDescription>Inventory and ownership records only. A saved social-media account does not establish a connected publishing integration.</CardDescription></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {!data.accounts.length && <p className="text-sm text-muted-foreground">No channel accounts are registered.</p>}
              {data.accounts.map(account=><div key={account.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2"><strong>{pretty(account.platform)}</strong><Badge variant="outline">{pretty(account.ownership_status)}</Badge></div>
                <p className="mt-2 text-sm text-muted-foreground">{account.scope_name}{account.handle ? " · "+account.handle : ""}</p>
                {account.public_url?.startsWith("https://") && <a className="mt-2 block text-sm text-primary underline" href={account.public_url} target="_blank" rel="noopener noreferrer">View registered public page</a>}
              </div>)}
            </CardContent>
          </Card></TabsContent>}
        </Tabs>
      </>}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>Create {pretty(tab === "editorial" ? "editorial pitch" : tab === "publications" ? "magazine issue" : tab === "campaigns" ? "marketing campaign" : "social post")}</DialogTitle>
            <DialogDescription>Creates a real record in HPG's canonical departmental workflow. Do not use production records for tutorial practice.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Title</Label><Input value={draft.title} maxLength={240} onChange={e=>setDraft(s=>({...s,title:e.target.value}))} /></div>
            {tab === "editorial" && <div className="space-y-1"><Label>Type</Label><Select value={draft.contentType} onValueChange={v=>setDraft(s=>({...s,contentType:v}))}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["magazine_feature","interview","news_article","impact_story","newsletter_story","press_release","investigative_feature","op_ed","internal_memo","web_copy"].map(v=><SelectItem key={v} value={v}>{pretty(v)}</SelectItem>)}</SelectContent></Select></div>}
            {(tab === "editorial" || tab === "campaigns") && <div className="space-y-1"><Label>{tab === "editorial" ? "Story pitch (at least 10 characters)" : "Objective (at least 10 characters)"}</Label><Textarea value={draft.summary} rows={3} onChange={e=>setDraft(s=>({...s,summary:e.target.value}))} /></div>}
            {(tab === "campaigns" || tab === "publications") && <div className="space-y-1"><Label>{tab === "campaigns" ? "Target audience" : "Audience segment"}</Label><Input value={draft.audience} onChange={e=>setDraft(s=>({...s,audience:e.target.value}))} /></div>}
            {tab === "campaigns" && <div className="space-y-1"><Label>Campaign type</Label><Select value={draft.campaignType} onValueChange={v=>setDraft(s=>({...s,campaignType:v}))}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["awareness","fundraising","event","program_launch","ngo_spotlight","recruitment","partnership","advocacy"].map(v=><SelectItem key={v} value={v}>{pretty(v)}</SelectItem>)}</SelectContent></Select></div>}
            {(tab === "campaigns" || tab === "posts") && <div className="space-y-1"><Label>{tab === "campaigns" ? "Primary call to action" : "Draft post text"}</Label><Textarea rows={tab === "posts" ? 5 : 2} value={draft.body} onChange={e=>setDraft(s=>({...s,body:e.target.value}))} /></div>}
            {tab === "posts" && <div className="space-y-1"><Label>Platform</Label><Select value={draft.platform} onValueChange={v=>setDraft(s=>({...s,platform:v}))}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["facebook","instagram","linkedin","x","youtube","tiktok","threads","other"].map(v=><SelectItem key={v} value={v}>{pretty(v)}</SelectItem>)}</SelectContent></Select></div>}
            {tab === "posts" && <>
              <div className="space-y-1"><Label>Linked campaign (optional)</Label>
                <Select value={draft.campaignId} onValueChange={v=>setDraft(s=>({...s,campaignId:v}))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No campaign</SelectItem>{(data?.campaigns || []).map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Channel account (optional)</Label>
                <Select value={draft.accountId} onValueChange={v=>setDraft(s=>({...s,accountId:v}))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">No channel account</SelectItem>{(data?.accounts || []).map(a => <SelectItem key={a.id} value={a.id}>{pretty(a.platform)} — {a.scope_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>}
            {(tab === "campaigns" || tab === "publications" || tab === "editorial") && <div className="space-y-1"><Label>Channels, comma separated</Label><Input value={draft.channels} onChange={e=>setDraft(s=>({...s,channels:e.target.value}))}/></div>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Owner {communication ? "(optional at pitch stage)" : "(required)"}</Label>
                <Select value={draft.ownerId} onValueChange={v=>setDraft(s=>({...s,ownerId:v}))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Choose owner</SelectItem>{(data?.people || []).map(p=><SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent></Select>
              </div>
              {tab !== "posts" && <div className="space-y-1"><Label>{tab === "campaigns" ? "Strategist" : "Editor"}</Label>
                <Select value={draft.editorId} onValueChange={v=>setDraft(s=>({...s,editorId:v}))}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Choose reviewer or editor</SelectItem>{(data?.people || []).map(p=><SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent></Select>
              </div>}
            </div>
            {communication && <div className="space-y-1"><Label>Due date</Label><Input type="date" value={draft.due} onChange={e=>setDraft(s=>({...s,due:e.target.value}))}/></div>}
            <div className="space-y-1"><Label>Planned publication, distribution, or campaign date (optional)</Label><Input type="datetime-local" value={draft.scheduled} onChange={e=>setDraft(s=>({...s,scheduled:e.target.value}))}/>
              <p className="text-xs text-muted-foreground">A date records a plan, not a confirmed external release.</p></div>
            <p className="text-xs text-muted-foreground">Approval and published status are not set by creation. The database will enforce every downstream step.</p>
            <Button className="w-full" disabled={action.isPending || draft.title.trim().length < 3 ||
              (tab === "editorial" && draft.summary.trim().length < 10) ||
              (tab === "campaigns" && (draft.summary.trim().length < 10 || draft.audience.trim().length < 2 || draft.body.trim().length < 2 || draft.ownerId === "none")) ||
              (tab === "publications" && draft.audience.trim().length < 2) ||
              (tab === "posts" && draft.ownerId === "none")}
              onClick={createRecord}>{action.isPending ? "Creating…" : "Create departmental record"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  </MainLayout>;
}
