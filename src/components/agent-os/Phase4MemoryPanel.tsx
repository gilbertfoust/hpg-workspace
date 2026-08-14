import { useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  Archive,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  CircleDashed,
  FileCheck2,
  GitBranch,
  History,
  LibraryBig,
  LockKeyhole,
  Network,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { isAdminRole, useUserRole } from "@/hooks/useUserRole";
import {
  useLinkPhase4Precedent,
  usePhase4Memory,
  useRecordPhase4Memory,
  useRecordPhase4Outcome,
  useRefreshPhase4Sources,
  useResolvePhase4Conflict,
  useReviewPhase4Gate,
  useRunPhase4Validation,
  useVerifyPhase4Memory,
  type Phase4Gate,
  type Phase4Memory,
} from "@/hooks/usePhase4Memory";

const titleCase = (value: string | null | undefined) =>
  (value || "Not recorded").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusVariant = (status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" => {
  if (["failed", "blocked", "high", "critical", "paused", "confirmed", "rejected"].includes(status || "")) return "destructive";
  if (["pending", "proposed", "captured", "moderate", "validating", "ready_for_human_review", "potential"].includes(status || "")) return "secondary";
  if (["passed", "verified", "active", "pilot", "low", "completed", "complete", "successful", "current"].includes(status || "")) return "default";
  return "outline";
};

const formatDate = (value: string | null | undefined, dateOnly = false) => {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, dateOnly ? "MMM d, yyyy" : "MMM d, yyyy h:mm a");
};

const parseJson = <T,>(value: string, fallback: T): T => {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return JSON.parse(trimmed) as T;
};

const defaultCapture = {
  memoryType: "operational",
  title: "",
  summary: "",
  narrative: "",
  accessArea: "organization",
  confidentiality: "internal",
  importance: "important",
  confidence: "moderate",
  primaryEntityType: "",
  primaryEntityId: "",
  factKey: "",
  factValueJson: "",
  occurredAt: "",
  effectiveFrom: "",
  effectiveTo: "",
  ownerAgentKey: "",
  decisionText: "",
  rationale: "",
  alternativesJson: "[]",
  expectedOutcome: "",
  tags: "",
  evidenceTitle: "",
  evidenceReference: "",
  evidenceUrl: "",
  evidenceSnapshotJson: "{}",
  evidenceStrength: "3",
  supersedesMemoryId: "none",
};

export function Phase4MemoryPanel() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: userRole } = useUserRole();
  const phase4 = usePhase4Memory();
  const refreshSources = useRefreshPhase4Sources();
  const runValidation = useRunPhase4Validation();
  const recordMemory = useRecordPhase4Memory();
  const verifyMemory = useVerifyPhase4Memory();
  const recordOutcome = useRecordPhase4Outcome();
  const linkPrecedent = useLinkPhase4Precedent();
  const resolveConflict = useResolvePhase4Conflict();
  const reviewGate = useReviewPhase4Gate();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentOnly, setCurrentOnly] = useState(false);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const [capture, setCapture] = useState(defaultCapture);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [verifyEvidenceReference, setVerifyEvidenceReference] = useState("");
  const [outcomeText, setOutcomeText] = useState("");
  const [outcomeStatus, setOutcomeStatus] = useState("successful");
  const [lessonsJson, setLessonsJson] = useState("[]");
  const [outcomeEvidenceReference, setOutcomeEvidenceReference] = useState("");
  const [precedentMemoryId, setPrecedentMemoryId] = useState("none");
  const [precedentRelationship, setPrecedentRelationship] = useState("supports");
  const [precedentRationale, setPrecedentRationale] = useState("");
  const [precedentConfidence, setPrecedentConfidence] = useState("moderate");
  const [conflictResolution, setConflictResolution] = useState("contextual");
  const [conflictNotes, setConflictNotes] = useState("");
  const [conflictEvidenceReference, setConflictEvidenceReference] = useState("");
  const [selectedGateKey, setSelectedGateKey] = useState<string | null>(null);
  const [gateStatus, setGateStatus] = useState<"passed" | "failed" | "waived">("passed");
  const [gateNotes, setGateNotes] = useState("");
  const [gateEvidenceReference, setGateEvidenceReference] = useState("");

  const isAdmin = isAdminRole(userRole?.role);

  const filteredMemories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (phase4.data?.memories || []).filter((memory) => {
      if (typeFilter !== "all" && memory.memory_type !== typeFilter) return false;
      if (currentOnly && memory.calculated_temporal_state !== "current") return false;
      if (!query) return true;
      return [
        memory.memory_reference,
        memory.title,
        memory.summary,
        memory.memory_type,
        memory.primary_entity_type,
        memory.primary_entity_id,
        memory.source_display_name,
        memory.source_table,
        memory.decision_text,
        memory.actual_outcome,
        ...(memory.tags || []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [phase4.data?.memories, search, typeFilter, currentOnly]);

  const selectedMemory = useMemo(
    () => (phase4.data?.memories || []).find((memory) => memory.id === selectedMemoryId) || null,
    [phase4.data?.memories, selectedMemoryId],
  );

  const precedentCandidates = useMemo(
    () =>
      (phase4.data?.memories || []).filter(
        (memory) =>
          memory.id !== selectedMemoryId &&
          ["verified", "expired", "superseded"].includes(memory.lifecycle_status),
      ),
    [phase4.data?.memories, selectedMemoryId],
  );

  const provenanceGroups = useMemo(() => {
    const groups = new Map<string, number>();
    for (const row of phase4.data?.provenance || []) {
      groups.set(row.object_type, (groups.get(row.object_type) || 0) + 1);
    }
    return Array.from(groups.entries()).sort((a, b) => b[1] - a[1]);
  }, [phase4.data?.provenance]);

  if (phase4.isLoading) return <Skeleton className="h-[760px] w-full" />;

  if (phase4.error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Phase 4 could not be loaded</AlertTitle>
        <AlertDescription>
          {phase4.error instanceof Error ? phase4.error.message : "The institutional-memory runtime is unavailable."}
        </AlertDescription>
      </Alert>
    );
  }

  if (phase4.data && !phase4.data.runtimeReady) {
    return (
      <Alert>
        <BrainCircuit className="h-4 w-4" />
        <AlertTitle>Phase 4 runtime pending</AlertTitle>
        <AlertDescription>{phase4.data.runtimeMessage}</AlertDescription>
      </Alert>
    );
  }

  const data = phase4.data;
  const dashboard = data?.dashboard;
  if (!dashboard) return null;

  const showError = (title: string, error: unknown) =>
    toast({
      variant: "destructive",
      title,
      description: error instanceof Error ? error.message : "The governed Phase 4 action could not be completed.",
    });

  const runControlledAction = async (
    action: typeof refreshSources | typeof runValidation,
    successTitle: string,
  ) => {
    try {
      const result = await action.mutateAsync();
      toast({ title: successTitle, description: JSON.stringify(result) });
    } catch (error) {
      showError("Controlled action failed", error);
    }
  };

  const submitCapture = async () => {
    if (capture.title.trim().length < 5 || capture.summary.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Title and summary required",
        description: "Provide a descriptive title and a summary of at least ten characters.",
      });
      return;
    }

    try {
      const alternatives = parseJson<unknown[]>(capture.alternativesJson, []);
      const evidenceSnapshot = parseJson<Record<string, unknown>>(capture.evidenceSnapshotJson, {});
      const factValue = capture.factValueJson.trim() ? parseJson<unknown>(capture.factValueJson, null) : null;
      if (!Array.isArray(alternatives)) throw new Error("Alternatives must be a JSON array.");
      const result = await recordMemory.mutateAsync({
        memoryType: capture.memoryType,
        title: capture.title.trim(),
        summary: capture.summary.trim(),
        narrative: capture.narrative.trim() || null,
        accessArea: capture.accessArea,
        confidentiality: capture.confidentiality,
        importance: capture.importance,
        confidence: capture.confidence,
        primaryEntityType: capture.primaryEntityType.trim() || null,
        primaryEntityId: capture.primaryEntityId.trim() || null,
        factKey: capture.factKey.trim() || null,
        factValue,
        occurredAt: capture.occurredAt ? new Date(capture.occurredAt).toISOString() : null,
        effectiveFrom: capture.effectiveFrom ? new Date(capture.effectiveFrom).toISOString() : null,
        effectiveTo: capture.effectiveTo ? new Date(capture.effectiveTo).toISOString() : null,
        ownerAgentKey: capture.ownerAgentKey.trim() || null,
        decisionMakerUserId: capture.memoryType === "decision" ? user?.id || null : null,
        decisionText: capture.decisionText.trim() || null,
        rationale: capture.rationale.trim() || null,
        alternativesConsidered: alternatives,
        expectedOutcome: capture.expectedOutcome.trim() || null,
        tags: capture.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        evidenceTitle: capture.evidenceTitle.trim() || null,
        evidenceReference: capture.evidenceReference.trim() || null,
        evidenceUrl: capture.evidenceUrl.trim() || null,
        evidenceSnapshot,
        evidenceStrength: Number(capture.evidenceStrength) || 3,
        supersedesMemoryId: capture.supersedesMemoryId === "none" ? null : capture.supersedesMemoryId,
        idempotencyKey: `workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      toast({ title: "Institutional memory captured", description: JSON.stringify(result) });
      setCapture(defaultCapture);
    } catch (error) {
      showError("Memory was not captured", error);
    }
  };

  const submitVerification = async () => {
    if (!selectedMemory || verifyNotes.trim().length < 10 || !verifyEvidenceReference.trim()) {
      toast({
        variant: "destructive",
        title: "Review evidence required",
        description: "Select a memory and provide an evidence reference with at least ten characters of review notes.",
      });
      return;
    }
    try {
      const result = await verifyMemory.mutateAsync({
        memoryId: selectedMemory.id,
        notes: verifyNotes.trim(),
        evidence: {
          evidence_reference: verifyEvidenceReference.trim(),
          reviewed_from_workspace: true,
          workspace_route: "/hpg-assistant#phase-4",
        },
      });
      toast({ title: "Memory verified", description: JSON.stringify(result) });
      setVerifyNotes("");
      setVerifyEvidenceReference("");
    } catch (error) {
      showError("Memory was not verified", error);
    }
  };

  const submitOutcome = async () => {
    if (!selectedMemory || outcomeText.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Outcome required",
        description: "Select a verified memory and describe the observed result.",
      });
      return;
    }
    try {
      const lessons = parseJson<unknown[]>(lessonsJson, []);
      if (!Array.isArray(lessons)) throw new Error("Lessons must be a JSON array.");
      const result = await recordOutcome.mutateAsync({
        memoryId: selectedMemory.id,
        actualOutcome: outcomeText.trim(),
        outcomeStatus,
        lessons,
        evidenceReference: outcomeEvidenceReference.trim() || undefined,
      });
      toast({ title: "Outcome added to institutional memory", description: JSON.stringify(result) });
      setOutcomeText("");
      setLessonsJson("[]");
      setOutcomeEvidenceReference("");
    } catch (error) {
      showError("Outcome was not recorded", error);
    }
  };

  const submitPrecedent = async () => {
    if (!selectedMemory || precedentMemoryId === "none" || precedentRationale.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Precedent and rationale required",
        description: "Select a prior verified memory and explain how it bears on the current record.",
      });
      return;
    }
    try {
      const result = await linkPrecedent.mutateAsync({
        sourceMemoryId: selectedMemory.id,
        precedentMemoryId,
        relationship: precedentRelationship,
        rationale: precedentRationale.trim(),
        confidence: precedentConfidence,
      });
      toast({ title: "Precedent linked", description: JSON.stringify(result) });
      setPrecedentMemoryId("none");
      setPrecedentRationale("");
    } catch (error) {
      showError("Precedent was not linked", error);
    }
  };

  const submitConflictResolution = async () => {
    if (!selectedMemory || conflictNotes.trim().length < 10 || !conflictEvidenceReference.trim()) {
      toast({
        variant: "destructive",
        title: "Conflict resolution evidence required",
        description: "Provide the resolution, evidence reference, and explanatory notes.",
      });
      return;
    }
    try {
      const result = await resolveConflict.mutateAsync({
        memoryId: selectedMemory.id,
        resolution: conflictResolution,
        notes: conflictNotes.trim(),
        evidenceReference: conflictEvidenceReference.trim(),
      });
      toast({ title: "Memory conflict resolved", description: JSON.stringify(result) });
      setConflictNotes("");
      setConflictEvidenceReference("");
    } catch (error) {
      showError("Conflict was not resolved", error);
    }
  };

  const submitGateReview = async (gate: Phase4Gate) => {
    if (gateNotes.trim().length < 10 || !gateEvidenceReference.trim()) {
      toast({
        variant: "destructive",
        title: "Evidence and review notes required",
        description: "Provide an evidence reference and at least ten characters of review notes.",
      });
      return;
    }
    try {
      const result = await reviewGate.mutateAsync({
        gateKey: gate.gate_key,
        status: gateStatus,
        notes: gateNotes.trim(),
        evidenceReference: gateEvidenceReference.trim(),
      });
      toast({ title: `${gate.gate_title} recorded`, description: JSON.stringify(result) });
      setSelectedGateKey(null);
      setGateNotes("");
      setGateEvidenceReference("");
      setGateStatus("passed");
    } catch (error) {
      showError("Governance review was not recorded", error);
    }
  };

  const mutationPending =
    refreshSources.isPending ||
    runValidation.isPending ||
    recordMemory.isPending ||
    verifyMemory.isPending ||
    recordOutcome.isPending ||
    linkPrecedent.isPending ||
    resolveConflict.isPending ||
    reviewGate.isPending;

  return (
    <Card id="phase-4">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BrainCircuit className="h-5 w-5" /> Phase 4 — Organizational Memory and Institutional Intelligence
            </CardTitle>
            <p className="mt-1 max-w-5xl text-sm text-muted-foreground">
              A governed memory system for decisions, precedents, relationships, grants, compliance history, operational lessons,
              outcomes, and time-aware supersession across HPG.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={statusVariant(dashboard.program_status)}>{titleCase(dashboard.program_status)}</Badge>
              <Badge variant="outline">Version {dashboard.program_version}</Badge>
              <Badge variant="outline">{dashboard.memory_count} institutional memories</Badge>
              <Badge variant="outline">{dashboard.active_source_count} governed sources</Badge>
              <Badge variant="outline">Trello: {titleCase(dashboard.trello_operating_role)}</Badge>
              <Badge variant="destructive" className="gap-1">
                <LockKeyhole className="h-3 w-3" /> High-impact autonomy disabled
              </Badge>
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={mutationPending}
                onClick={() => runControlledAction(refreshSources, "Institutional-memory sources refreshed")}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh Sources
              </Button>
              <Button
                size="sm"
                disabled={mutationPending}
                onClick={() => runControlledAction(runValidation, "Phase 4 validation completed")}
              >
                <PlayCircle className="mr-2 h-4 w-4" /> Run Eight-Scenario Suite
              </Button>
            </div>
          )}
        </div>

        <Alert className="border-warning/40 bg-warning/5">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Governed organizational memory—not autonomous authority</AlertTitle>
          <AlertDescription>
            Phase 4 records evidence, context, outcomes, and precedent. It cannot replace the Board, General Counsel, Finance,
            executive leadership, or departmental reviewers. Trello identifiers are retained only as historical provenance;
            the HPG Workspace and Supabase are authoritative.
          </AlertDescription>
        </Alert>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Metric label="Institutional memory" value={dashboard.memory_count} />
          <Metric label="Evidence records" value={dashboard.evidence_count} />
          <Metric label="Decisions" value={dashboard.decision_count} />
          <Metric label="Relationships" value={dashboard.relationship_count} />
          <Metric label="Grant history" value={dashboard.grant_count} />
          <Metric label="Compliance" value={dashboard.compliance_count} />
          <Metric label="Operational lessons" value={dashboard.operational_count} />
          <Metric label="Human gates" value={`${8 - dashboard.human_gates_pending}/8`} />
        </div>

        <Tabs defaultValue="library" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-4 xl:grid-cols-7">
            <TabsTrigger value="library">Memory Library</TabsTrigger>
            <TabsTrigger value="record">Record Memory</TabsTrigger>
            <TabsTrigger value="precedent">Precedent</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="governance">Governance</TabsTrigger>
            <TabsTrigger value="provenance">Provenance</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search decisions, NGOs, grants, relationships, outcomes, sources, and tags"
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue placeholder="Memory type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All memory types</SelectItem>
                  {memoryTypes.map((type) => <SelectItem key={type} value={type}>{titleCase(type)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant={currentOnly ? "default" : "outline"} onClick={() => setCurrentOnly((value) => !value)}>
                {currentOnly ? "Current only" : "Include history"}
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Memory</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Occurred</TableHead>
                    <TableHead className="text-right">Manage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMemories.slice(0, 250).map((memory) => (
                    <TableRow key={memory.id} className={selectedMemoryId === memory.id ? "bg-muted/40" : undefined}>
                      <TableCell>
                        <div className="font-mono text-xs font-medium">{memory.memory_reference}</div>
                        <Badge variant="outline" className="mt-1">{titleCase(memory.memory_type)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[420px]">
                        <div className="font-medium">{memory.title}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{memory.summary}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{memory.source_display_name || memory.source_table}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={statusVariant(memory.lifecycle_status)}>{titleCase(memory.lifecycle_status)}</Badge>
                          <Badge variant={statusVariant(memory.calculated_temporal_state)}>{titleCase(memory.calculated_temporal_state)}</Badge>
                          {memory.conflict_status !== "none" && (
                            <Badge variant={statusVariant(memory.conflict_status)}>{titleCase(memory.conflict_status)} conflict</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <div className="text-sm">{titleCase(memory.primary_entity_type)}</div>
                        <div className="break-all font-mono text-xs text-muted-foreground">{memory.primary_entity_id || "Not linked"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{memory.evidence_count}</div>
                        <div className="max-w-[180px] truncate text-xs text-muted-foreground">{memory.primary_evidence_reference || "No primary reference"}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(memory.outcome_status)}>{titleCase(memory.outcome_status)}</Badge>
                        {memory.actual_outcome && <div className="mt-1 max-w-[220px] line-clamp-2 text-xs text-muted-foreground">{memory.actual_outcome}</div>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(memory.occurred_at, true)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedMemoryId(memory.id)}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredMemories.length === 0 && <EmptyState icon={<LibraryBig className="h-5 w-5" />} text="No institutional memory matches the current filters." />}
            {filteredMemories.length > 250 && (
              <p className="text-xs text-muted-foreground">Showing the first 250 of {filteredMemories.length} matching records.</p>
            )}

            {selectedMemory && (
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                    <span>{selectedMemory.memory_reference} — {selectedMemory.title}</span>
                    <div className="flex gap-2">
                      <Badge variant={statusVariant(selectedMemory.lifecycle_status)}>{titleCase(selectedMemory.lifecycle_status)}</Badge>
                      <Badge variant={statusVariant(selectedMemory.conflict_status)}>{titleCase(selectedMemory.conflict_status)} conflict</Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Detail label="Decision maker" value={selectedMemory.decision_maker_name || "Not applicable"} />
                    <Detail label="Owner agent" value={selectedMemory.owner_agent_name || selectedMemory.owner_agent_key || "Not assigned"} />
                    <Detail label="Effective period" value={`${formatDate(selectedMemory.effective_from, true)} → ${formatDate(selectedMemory.effective_to, true)}`} />
                    <Detail label="Supersession" value={selectedMemory.supersedes_reference ? `Replaces ${selectedMemory.supersedes_reference}` : selectedMemory.superseded_by_reference ? `Replaced by ${selectedMemory.superseded_by_reference}` : "No supersession"} />
                  </div>
                  {(selectedMemory.decision_text || selectedMemory.rationale || selectedMemory.expected_outcome) && (
                    <div className="grid gap-3 md:grid-cols-3">
                      <Detail label="Decision" value={selectedMemory.decision_text || "Not recorded"} />
                      <Detail label="Rationale" value={selectedMemory.rationale || "Not recorded"} />
                      <Detail label="Expected outcome" value={selectedMemory.expected_outcome || "Not recorded"} />
                    </div>
                  )}

                  <Tabs defaultValue="verify" className="space-y-3">
                    <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-4">
                      <TabsTrigger value="verify">Verify</TabsTrigger>
                      <TabsTrigger value="outcome">Outcome</TabsTrigger>
                      <TabsTrigger value="precedent">Precedent</TabsTrigger>
                      <TabsTrigger value="conflict">Conflict</TabsTrigger>
                    </TabsList>
                    <TabsContent value="verify" className="space-y-3 rounded-lg border p-4">
                      <Textarea value={verifyNotes} onChange={(event) => setVerifyNotes(event.target.value)} placeholder="Review findings, source comparison, and authority exercised" />
                      <Input value={verifyEvidenceReference} onChange={(event) => setVerifyEvidenceReference(event.target.value)} placeholder="Evidence reference or controlled document URL" />
                      <Button disabled={mutationPending || !["captured", "proposed"].includes(selectedMemory.lifecycle_status)} onClick={submitVerification}>
                        <FileCheck2 className="mr-2 h-4 w-4" /> Verify Memory
                      </Button>
                    </TabsContent>
                    <TabsContent value="outcome" className="space-y-3 rounded-lg border p-4">
                      <Textarea value={outcomeText} onChange={(event) => setOutcomeText(event.target.value)} placeholder="What happened after the decision, intervention, grant, relationship action, or compliance response?" />
                      <div className="grid gap-3 md:grid-cols-2">
                        <Select value={outcomeStatus} onValueChange={setOutcomeStatus}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {outcomeStatuses.map((status) => <SelectItem key={status} value={status}>{titleCase(status)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input value={outcomeEvidenceReference} onChange={(event) => setOutcomeEvidenceReference(event.target.value)} placeholder="Outcome evidence reference" />
                      </div>
                      <Textarea value={lessonsJson} onChange={(event) => setLessonsJson(event.target.value)} placeholder='Lessons JSON array, for example ["Verify earlier", "Retain signed evidence"]' />
                      <Button disabled={mutationPending || !["verified", "expired", "superseded"].includes(selectedMemory.lifecycle_status)} onClick={submitOutcome}>
                        <Sparkles className="mr-2 h-4 w-4" /> Record Outcome and Lessons
                      </Button>
                    </TabsContent>
                    <TabsContent value="precedent" className="space-y-3 rounded-lg border p-4">
                      <Select value={precedentMemoryId} onValueChange={setPrecedentMemoryId}>
                        <SelectTrigger><SelectValue placeholder="Select prior verified memory" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select prior memory</SelectItem>
                          {precedentCandidates.slice(0, 200).map((memory) => (
                            <SelectItem key={memory.id} value={memory.id}>{memory.memory_reference} — {memory.title.slice(0, 80)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Select value={precedentRelationship} onValueChange={setPrecedentRelationship}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {precedentRelationships.map((relationship) => <SelectItem key={relationship} value={relationship}>{titleCase(relationship)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={precedentConfidence} onValueChange={setPrecedentConfidence}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {confidenceLevels.map((confidence) => <SelectItem key={confidence} value={confidence}>{titleCase(confidence)} confidence</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Textarea value={precedentRationale} onChange={(event) => setPrecedentRationale(event.target.value)} placeholder="Explain why the prior memory supports, conflicts with, or should be distinguished from this record" />
                      <Button disabled={mutationPending || !["verified", "expired", "superseded"].includes(selectedMemory.lifecycle_status)} onClick={submitPrecedent}>
                        <GitBranch className="mr-2 h-4 w-4" /> Link Precedent
                      </Button>
                    </TabsContent>
                    <TabsContent value="conflict" className="space-y-3 rounded-lg border p-4">
                      <Select value={conflictResolution} onValueChange={setConflictResolution}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="accept_new">Accept new fact and supersede prior record</SelectItem>
                          <SelectItem value="retain_existing">Retain existing fact and reject new claim</SelectItem>
                          <SelectItem value="contextual">Retain both with contextual distinction</SelectItem>
                        </SelectContent>
                      </Select>
                      <Textarea value={conflictNotes} onChange={(event) => setConflictNotes(event.target.value)} placeholder="Explain the factual conflict, dates, authorities, and resolution" />
                      <Input value={conflictEvidenceReference} onChange={(event) => setConflictEvidenceReference(event.target.value)} placeholder="Conflict-resolution evidence reference" />
                      <Button variant="outline" disabled={mutationPending || !["potential", "confirmed"].includes(selectedMemory.conflict_status)} onClick={submitConflictResolution}>
                        <Network className="mr-2 h-4 w-4" /> Resolve Contradictory Fact
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="record" className="space-y-4">
            <Alert>
              <BookOpenCheck className="h-4 w-4" />
              <AlertTitle>Capture first; verify through evidence and authority</AlertTitle>
              <AlertDescription>
                New records enter as proposed memory. A management reviewer must verify the evidence before the record becomes an institutional fact.
                Decision memory also requires the decision-maker, rationale, alternatives, and expected outcome.
              </AlertDescription>
            </Alert>
            <div className="grid gap-4 lg:grid-cols-3">
              <Field label="Memory type">
                <Select value={capture.memoryType} onValueChange={(value) => setCapture((state) => ({ ...state, memoryType: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{memoryTypes.map((type) => <SelectItem key={type} value={type}>{titleCase(type)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Access area">
                <Select value={capture.accessArea} onValueChange={(value) => setCapture((state) => ({ ...state, accessArea: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{accessAreas.map((area) => <SelectItem key={area} value={area}>{titleCase(area)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Confidentiality">
                <Select value={capture.confidentiality} onValueChange={(value) => setCapture((state) => ({ ...state, confidentiality: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{confidentialityLevels.map((level) => <SelectItem key={level} value={level}>{titleCase(level)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Title" className="lg:col-span-2">
                <Input value={capture.title} onChange={(event) => setCapture((state) => ({ ...state, title: event.target.value }))} placeholder="Specific decision, relationship event, grant result, compliance finding, or lesson" />
              </Field>
              <Field label="Occurred at">
                <Input type="datetime-local" value={capture.occurredAt} onChange={(event) => setCapture((state) => ({ ...state, occurredAt: event.target.value }))} />
              </Field>
              <Field label="Summary" className="lg:col-span-3">
                <Textarea value={capture.summary} onChange={(event) => setCapture((state) => ({ ...state, summary: event.target.value }))} placeholder="What happened, why it matters, and what someone should understand later" />
              </Field>
              <Field label="Full narrative" className="lg:col-span-3">
                <Textarea value={capture.narrative} onChange={(event) => setCapture((state) => ({ ...state, narrative: event.target.value }))} placeholder="Context, sequence, actors, constraints, and supporting interpretation" className="min-h-28" />
              </Field>
              <Field label="Primary entity type">
                <Input value={capture.primaryEntityType} onChange={(event) => setCapture((state) => ({ ...state, primaryEntityType: event.target.value }))} placeholder="ngo, grant_application, policy, crm_contact" />
              </Field>
              <Field label="Primary entity ID">
                <Input value={capture.primaryEntityId} onChange={(event) => setCapture((state) => ({ ...state, primaryEntityId: event.target.value }))} placeholder="UUID or stable external identifier" />
              </Field>
              <Field label="Owner agent key">
                <Input value={capture.ownerAgentKey} onChange={(event) => setCapture((state) => ({ ...state, ownerAgentKey: event.target.value }))} placeholder="hpg-aos-001" />
              </Field>
              <Field label="Importance">
                <Select value={capture.importance} onValueChange={(value) => setCapture((state) => ({ ...state, importance: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{importanceLevels.map((level) => <SelectItem key={level} value={level}>{titleCase(level)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Confidence">
                <Select value={capture.confidence} onValueChange={(value) => setCapture((state) => ({ ...state, confidence: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{confidenceLevels.map((level) => <SelectItem key={level} value={level}>{titleCase(level)}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Tags">
                <Input value={capture.tags} onChange={(event) => setCapture((state) => ({ ...state, tags: event.target.value }))} placeholder="comma, separated, tags" />
              </Field>
              <Field label="Fact key">
                <Input value={capture.factKey} onChange={(event) => setCapture((state) => ({ ...state, factKey: event.target.value }))} placeholder="sponsorship.status or policy.version" />
              </Field>
              <Field label="Fact value JSON" className="lg:col-span-2">
                <Input value={capture.factValueJson} onChange={(event) => setCapture((state) => ({ ...state, factValueJson: event.target.value }))} placeholder='{"status":"active"}' />
              </Field>
              <Field label="Effective from">
                <Input type="datetime-local" value={capture.effectiveFrom} onChange={(event) => setCapture((state) => ({ ...state, effectiveFrom: event.target.value }))} />
              </Field>
              <Field label="Effective through">
                <Input type="datetime-local" value={capture.effectiveTo} onChange={(event) => setCapture((state) => ({ ...state, effectiveTo: event.target.value }))} />
              </Field>
              <Field label="Supersedes memory">
                <Select value={capture.supersedesMemoryId} onValueChange={(value) => setCapture((state) => ({ ...state, supersedesMemoryId: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No supersession</SelectItem>
                    {(data.memories || []).filter((memory) => ["verified", "expired"].includes(memory.lifecycle_status)).slice(0, 200).map((memory) => (
                      <SelectItem key={memory.id} value={memory.id}>{memory.memory_reference} — {memory.title.slice(0, 70)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {capture.memoryType === "decision" && (
                <>
                  <Field label="Decision" className="lg:col-span-3">
                    <Textarea value={capture.decisionText} onChange={(event) => setCapture((state) => ({ ...state, decisionText: event.target.value }))} placeholder="What was decided?" />
                  </Field>
                  <Field label="Rationale" className="lg:col-span-3">
                    <Textarea value={capture.rationale} onChange={(event) => setCapture((state) => ({ ...state, rationale: event.target.value }))} placeholder="Why was this decision made?" />
                  </Field>
                  <Field label="Alternatives considered JSON" className="lg:col-span-3">
                    <Textarea value={capture.alternativesJson} onChange={(event) => setCapture((state) => ({ ...state, alternativesJson: event.target.value }))} placeholder='[{"option":"Alternative A","reason":"Why it was not selected"}]' />
                  </Field>
                  <Field label="Expected outcome" className="lg:col-span-3">
                    <Textarea value={capture.expectedOutcome} onChange={(event) => setCapture((state) => ({ ...state, expectedOutcome: event.target.value }))} placeholder="What should happen because of this decision?" />
                  </Field>
                </>
              )}

              <Field label="Evidence title">
                <Input value={capture.evidenceTitle} onChange={(event) => setCapture((state) => ({ ...state, evidenceTitle: event.target.value }))} placeholder="Board minutes, email, signed agreement, report" />
              </Field>
              <Field label="Evidence reference">
                <Input value={capture.evidenceReference} onChange={(event) => setCapture((state) => ({ ...state, evidenceReference: event.target.value }))} placeholder="Document ID, Drive link, email thread, policy citation" />
              </Field>
              <Field label="Evidence URL">
                <Input value={capture.evidenceUrl} onChange={(event) => setCapture((state) => ({ ...state, evidenceUrl: event.target.value }))} placeholder="Optional controlled URL" />
              </Field>
              <Field label="Evidence snapshot JSON" className="lg:col-span-2">
                <Textarea value={capture.evidenceSnapshotJson} onChange={(event) => setCapture((state) => ({ ...state, evidenceSnapshotJson: event.target.value }))} placeholder='{"document_version":"1.0","page":3}' />
              </Field>
              <Field label="Evidence strength">
                <Select value={capture.evidenceStrength} onValueChange={(value) => setCapture((state) => ({ ...state, evidenceStrength: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[0, 1, 2, 3, 4, 5].map((level) => <SelectItem key={level} value={String(level)}>{level} / 5</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex justify-end">
              <Button disabled={mutationPending} onClick={submitCapture}>
                <BookOpenCheck className="mr-2 h-4 w-4" /> Capture Proposed Memory
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="precedent" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Precedent links" value={dashboard.precedent_link_count} />
              <Metric label="Outcome assessed" value={dashboard.outcome_assessed_count} />
              <Metric label="Superseded records" value={dashboard.superseded_count} />
              <Metric label="Unresolved conflicts" value={dashboard.unresolved_conflict_count} />
            </div>
            {data.precedents.length === 0 ? (
              <EmptyState icon={<GitBranch className="h-5 w-5" />} text="No production precedent links have been recorded yet. Select a verified memory in the library to establish one." />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Current memory</TableHead><TableHead>Relationship</TableHead><TableHead>Prior memory</TableHead><TableHead>Rationale</TableHead><TableHead>Outcome</TableHead><TableHead>Confidence</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.precedents.map((link) => (
                      <TableRow key={link.precedent_link_id}>
                        <TableCell><div className="font-mono text-xs">{link.source_reference}</div><div className="font-medium">{link.source_title}</div></TableCell>
                        <TableCell><Badge variant={statusVariant(link.relationship)}>{titleCase(link.relationship)}</Badge></TableCell>
                        <TableCell><div className="font-mono text-xs">{link.precedent_reference}</div><div className="font-medium">{link.precedent_title}</div><div className="text-xs text-muted-foreground">{formatDate(link.precedent_occurred_at, true)}</div></TableCell>
                        <TableCell className="max-w-[420px] text-sm">{link.rationale}</TableCell>
                        <TableCell><Badge variant={statusVariant(link.precedent_outcome_status)}>{titleCase(link.precedent_outcome_status)}</Badge><div className="mt-1 max-w-[260px] line-clamp-2 text-xs text-muted-foreground">{link.precedent_actual_outcome || "Not assessed"}</div></TableCell>
                        <TableCell><Badge variant="outline">{titleCase(link.confidence)}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sources" className="space-y-4">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Memory lane</TableHead><TableHead>Owner agent</TableHead><TableHead>Source rows</TableHead><TableHead>Memory rows</TableHead><TableHead>Coverage</TableHead><TableHead>Last ingested</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.sources.map((source) => (
                    <TableRow key={source.source_key}>
                      <TableCell><div className="font-medium">{source.display_name}</div><div className="font-mono text-xs text-muted-foreground">{source.source_schema}.{source.source_table}</div></TableCell>
                      <TableCell><Badge variant="outline">{titleCase(source.memory_type_hint)}</Badge><div className="mt-1 text-xs text-muted-foreground">{titleCase(source.access_area)} · {titleCase(source.confidentiality)}</div></TableCell>
                      <TableCell>{source.owner_agent_name || source.owner_agent_key || "Not assigned"}</TableCell>
                      <TableCell>{source.last_source_row_count}</TableCell>
                      <TableCell>{source.last_memory_row_count}</TableCell>
                      <TableCell><Badge variant={source.coverage_status === "complete" ? "default" : "secondary"}>{titleCase(source.coverage_status)}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(source.last_ingested_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="mb-3 font-semibold">Draft Memory Retention Standard</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.retention.map((rule) => (
                  <div key={rule.rule_key} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{titleCase(rule.memory_type)}</div>
                      <Badge variant={rule.policy_status === "approved" ? "default" : "secondary"}>{titleCase(rule.policy_status)}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{rule.rationale}</p>
                    <div className="mt-3 text-xs text-muted-foreground">
                      {rule.permanent_retention ? "Permanent retention" : `${rule.retention_years || "Unspecified"} years`} · review every {rule.review_frequency_months} months · legal hold {rule.legal_hold_supported ? "supported" : "not supported"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="validation" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Required scenarios" value={`${dashboard.latest_passed_scenario_count || 0}/${dashboard.latest_scenario_count || dashboard.required_scenario_count}`} />
              <Metric label="Assertions" value={dashboard.latest_assertion_count || 0} />
              <Metric label="Failed assertions" value={dashboard.latest_failed_assertion_count || 0} />
              <Metric label="Source fingerprint" value={dashboard.latest_source_fingerprint_unchanged ? "Unchanged" : "Review"} />
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Scenario</TableHead><TableHead>Control</TableHead><TableHead>Assertions</TableHead><TableHead>Result</TableHead><TableHead>Completed</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.scenarios.map((scenario) => (
                    <TableRow key={scenario.scenario_key}>
                      <TableCell><div className="font-medium">{scenario.title}</div><div className="text-xs text-muted-foreground">{titleCase(scenario.scenario_type)}</div></TableCell>
                      <TableCell className="max-w-[520px]"><div className="text-sm">{scenario.description}</div><div className="mt-1 text-xs text-muted-foreground">Expected: {scenario.expected_result}</div></TableCell>
                      <TableCell>{scenario.passed_assertion_count}/{scenario.assertion_count}</TableCell>
                      <TableCell><Badge variant={scenario.passed ? "default" : "destructive"}>{scenario.passed ? "Passed" : "Failed"}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(scenario.completed_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="governance" className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.gates.map((gate) => (
                <div key={gate.gate_key} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <GateIcon status={gate.gate_status} />
                      <div>
                        <div className="font-medium">{gate.gate_title}</div>
                        <div className="text-xs text-muted-foreground">{titleCase(gate.gate_group)}</div>
                      </div>
                    </div>
                    <Badge variant={statusVariant(gate.gate_status)}>{titleCase(gate.gate_status)}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{gate.gate_description}</p>
                  {gate.required_reviewer_role && <p className="mt-2 text-xs font-medium">Reviewer: {gate.required_reviewer_role}</p>}
                  {gate.work_item_status && <p className="mt-1 text-xs text-muted-foreground">Work item: {gate.work_item_status} · due {formatDate(gate.work_item_due_date, true)}</p>}
                  {gate.notes && <p className="mt-2 rounded bg-muted/30 p-2 text-xs">{gate.notes}</p>}
                  {gate.gate_group === "human" && gate.gate_status === "pending" && (
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setSelectedGateKey(selectedGateKey === gate.gate_key ? null : gate.gate_key)}>
                      Review Gate
                    </Button>
                  )}
                  {selectedGateKey === gate.gate_key && (
                    <div className="mt-3 space-y-2 rounded-lg border bg-muted/10 p-3">
                      <Select value={gateStatus} onValueChange={(value) => setGateStatus(value as "passed" | "failed" | "waived")}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="passed">Pass with evidence</SelectItem>
                          <SelectItem value="failed">Fail and return for correction</SelectItem>
                          {isAdmin && <SelectItem value="waived">Waive with documented authority</SelectItem>}
                        </SelectContent>
                      </Select>
                      <Textarea value={gateNotes} onChange={(event) => setGateNotes(event.target.value)} placeholder="Review findings and reasoning" />
                      <Input value={gateEvidenceReference} onChange={(event) => setGateEvidenceReference(event.target.value)} placeholder="Evidence or document reference" />
                      <Button size="sm" disabled={mutationPending} onClick={() => submitGateReview(gate)}>Record Review</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="provenance" className="space-y-4">
            <Alert>
              <Archive className="h-4 w-4" />
              <AlertTitle>Trello retired as an operating authority</AlertTitle>
              <AlertDescription>
                {dashboard.trello_provenance_count} Trello identifiers and snapshots remain available for historical traceability.
                Webhook ingestion and synchronization workers now return retired responses and cannot modify Workspace or Trello records.
              </AlertDescription>
            </Alert>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Archived provenance" value={dashboard.external_provenance_count} />
              <Metric label="Trello provenance" value={dashboard.trello_provenance_count} />
              <Metric label="Provider role" value={titleCase(dashboard.trello_operating_role)} />
              <Metric label="Provider status" value={titleCase(dashboard.trello_status)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {provenanceGroups.map(([objectType, count]) => (
                <div key={objectType} className="rounded-lg border p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{titleCase(objectType)}</div>
                  <div className="mt-1 text-2xl font-semibold">{count}</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Object</TableHead><TableHead>External reference</TableHead><TableHead>Related Workspace entity</TableHead><TableHead>Authority</TableHead><TableHead>Snapshot hash</TableHead><TableHead>Captured</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.provenance.slice(0, 150).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell><Badge variant="outline">{titleCase(row.object_type)}</Badge><div className="mt-1 text-xs text-muted-foreground">{row.source_table}</div></TableCell>
                      <TableCell className="max-w-[260px]"><div className="break-all font-mono text-xs">{row.external_object_id}</div>{row.external_object_url && <div className="mt-1 truncate text-xs text-muted-foreground">{row.external_object_url}</div>}</TableCell>
                      <TableCell><div className="text-sm">{titleCase(row.related_entity_type)}</div><div className="break-all font-mono text-xs text-muted-foreground">{row.related_entity_id || "Not linked"}</div></TableCell>
                      <TableCell><Badge variant={row.authoritative ? "destructive" : "secondary"}>{row.authoritative ? "Authoritative" : "Historical only"}</Badge></TableCell>
                      <TableCell className="max-w-[180px] truncate font-mono text-xs">{row.snapshot_sha256}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(row.captured_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Authoritative source: {dashboard.authoritative_source.replace(/_/g, " ")} · Trello: {titleCase(dashboard.trello_operating_role)}
          </div>
          <div className="text-muted-foreground">
            Last ingestion: {formatDate(dashboard.last_ingestion_at)} · Last validation: {formatDate(dashboard.last_validation_at)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const memoryTypes = ["decision", "precedent", "relationship", "grant", "compliance", "operational"];
const accessAreas = ["organization", "administration", "development", "partnership", "program", "finance", "legal", "hr", "it", "marketing", "communications", "operations", "ngo_coordination"];
const confidentialityLevels = ["internal", "restricted", "highly_restricted"];
const importanceLevels = ["routine", "important", "high", "critical"];
const confidenceLevels = ["high", "moderate", "low", "unknown"];
const outcomeStatuses = ["pending", "successful", "partially_successful", "unsuccessful", "indeterminate"];
const precedentRelationships = ["similar", "supports", "conflicts", "distinguished", "overruled", "supersedes"];

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/10 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-5 py-10 text-sm text-muted-foreground">
      {icon} {text}
    </div>
  );
}

function GateIcon({ status }: { status: string }) {
  if (status === "passed" || status === "waived") return <CheckCircle2 className="mt-0.5 h-4 w-4" />;
  if (status === "failed") return <XCircle className="mt-0.5 h-4 w-4 text-destructive" />;
  return <CircleDashed className="mt-0.5 h-4 w-4 text-muted-foreground" />;
}
