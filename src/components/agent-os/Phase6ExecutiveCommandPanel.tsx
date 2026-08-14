import { useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Database,
  FileCheck2,
  Gauge,
  Gavel,
  LayoutDashboard,
  LockKeyhole,
  Network,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
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
import { useToast } from "@/hooks/use-toast";
import {
  isAdminRole,
  isDepartmentLeadRole,
  isVpRole,
  useUserRole,
} from "@/hooks/useUserRole";
import {
  useBeginPhase6DecisionReview,
  usePhase6Command,
  useRecordPhase6Decision,
  useRecordPhase6Position,
  useReviewPhase6Gate,
  useRunPhase6Refresh,
  useRunPhase6Validation,
  useUpdatePhase6Assignment,
  type Phase6Decision,
  type Phase6Gate,
} from "@/hooks/usePhase6Command";

const titleCase = (value: string | null | undefined) =>
  (value || "Not recorded").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusVariant = (value: string | null | undefined): "default" | "secondary" | "destructive" | "outline" => {
  if (["critical", "high_risk", "failed", "paused", "blocked", "overdue", "rejected", "declined"].includes(value || "")) return "destructive";
  if (["action_required", "watch", "queued", "under_review", "returned_for_evidence", "deferred", "pending", "ready_for_human_review"].includes(value || "")) return "secondary";
  if (["healthy", "active", "pilot", "passed", "decided", "completed", "acknowledged", "in_progress"].includes(value || "")) return "default";
  return "outline";
};

const formatDate = (value: string | null | undefined, dateOnly = false) => {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, dateOnly ? "MMM d, yyyy" : "MMM d, yyyy h:mm a");
};

const displayValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "Not recorded";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const recordValue = (record: Record<string, unknown>, key: string) => displayValue(record[key]);

export function Phase6ExecutiveCommandPanel() {
  const { toast } = useToast();
  const { data: userRole } = useUserRole();
  const phase6 = usePhase6Command();
  const runRefresh = useRunPhase6Refresh();
  const runValidation = useRunPhase6Validation();
  const beginReview = useBeginPhase6DecisionReview();
  const recordDecision = useRecordPhase6Decision();
  const recordPosition = useRecordPhase6Position();
  const reviewGate = useReviewPhase6Gate();
  const updateAssignment = useUpdatePhase6Assignment();

  const [decisionSearch, setDecisionSearch] = useState("");
  const [decisionStatus, setDecisionStatus] = useState("active");
  const [decisionCategory, setDecisionCategory] = useState("all");
  const [decisionSeverity, setDecisionSeverity] = useState("all");
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [selectedOptionKey, setSelectedOptionKey] = useState("");
  const [decisionCode, setDecisionCode] = useState("approve");
  const [decisionText, setDecisionText] = useState("");
  const [decisionRationale, setDecisionRationale] = useState("");
  const [decisionConditions, setDecisionConditions] = useState("");
  const [decisionEvidenceReference, setDecisionEvidenceReference] = useState("");
  const [positionAgentKey, setPositionAgentKey] = useState("");
  const [positionType, setPositionType] = useState("support");
  const [positionOptionKey, setPositionOptionKey] = useState("none");
  const [positionSummary, setPositionSummary] = useState("");
  const [positionRationale, setPositionRationale] = useState("");
  const [positionConfidence, setPositionConfidence] = useState("75");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentDepartment, setAssignmentDepartment] = useState("all");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [assignmentStatus, setAssignmentStatus] = useState("acknowledged");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [selectedGateKey, setSelectedGateKey] = useState<string | null>(null);
  const [gateStatus, setGateStatus] = useState<"passed" | "failed" | "waived">("passed");
  const [gateNotes, setGateNotes] = useState("");
  const [gateEvidenceReference, setGateEvidenceReference] = useState("");

  const isAdmin = isAdminRole(userRole?.role);
  const isCeo = userRole?.org_rank === "chief_executive";
  const canManage = isAdmin || isVpRole(userRole?.role) || isDepartmentLeadRole(userRole?.role) || userRole?.role === "executive_secretariat";

  const data = phase6.data;
  const dashboard = data?.dashboard;
  const latestBrief = data?.briefs?.[0] || null;

  const filteredDecisions = useMemo(() => {
    const query = decisionSearch.trim().toLowerCase();
    return (data?.decisions || []).filter((decision) => {
      if (decisionStatus === "active" && !["queued", "under_review", "returned_for_evidence", "deferred"].includes(decision.status)) return false;
      if (decisionStatus !== "all" && decisionStatus !== "active" && decision.status !== decisionStatus) return false;
      if (decisionCategory !== "all" && decision.category !== decisionCategory) return false;
      if (decisionSeverity !== "all" && decision.severity_key !== decisionSeverity) return false;
      if (!query) return true;
      return [
        decision.decision_reference,
        decision.title,
        decision.decision_question,
        decision.context_summary,
        decision.category,
        decision.decision_type,
        decision.severity_key,
        decision.status,
        decision.prepared_by_agent_name,
        decision.requested_by_agent_name,
        decision.recommendation_summary,
        decision.recommendation_rationale,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [data?.decisions, decisionSearch, decisionStatus, decisionCategory, decisionSeverity]);

  const selectedDecision = useMemo(
    () => (data?.decisions || []).find((entry) => entry.id === selectedDecisionId) || null,
    [data?.decisions, selectedDecisionId],
  );
  const selectedOptions = useMemo(
    () => (data?.options || []).filter((entry) => entry.decision_item_id === selectedDecisionId),
    [data?.options, selectedDecisionId],
  );
  const selectedEvidence = useMemo(
    () => (data?.evidence || []).filter((entry) => entry.decision_item_id === selectedDecisionId),
    [data?.evidence, selectedDecisionId],
  );
  const selectedPositions = useMemo(
    () => (data?.positions || []).filter((entry) => entry.decision_item_id === selectedDecisionId),
    [data?.positions, selectedDecisionId],
  );
  const selectedEvents = useMemo(
    () => (data?.events || []).filter((entry) => entry.decision_item_id === selectedDecisionId),
    [data?.events, selectedDecisionId],
  );

  const filteredAssignments = useMemo(() => {
    const query = assignmentSearch.trim().toLowerCase();
    return (data?.assignments || []).filter((assignment) => {
      if (assignmentDepartment !== "all" && assignment.module_key !== assignmentDepartment) return false;
      if (!query) return true;
      return [
        assignment.work_title,
        assignment.work_description,
        assignment.department_name,
        assignment.assigned_agent_name,
        assignment.assigned_human_name,
        assignment.source_owner_name,
        assignment.ngo_common_name,
        assignment.ngo_legal_name,
        assignment.hpg_reference_number,
        assignment.workflow_stage,
        assignment.next_action,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [data?.assignments, assignmentSearch, assignmentDepartment]);

  const selectedAssignment = useMemo(
    () => (data?.assignments || []).find((entry) => entry.assignment_id === selectedAssignmentId) || null,
    [data?.assignments, selectedAssignmentId],
  );

  if (phase6.isLoading) return <Skeleton className="h-[900px] w-full" />;
  if (phase6.error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Phase 6 could not be loaded</AlertTitle>
        <AlertDescription>{phase6.error instanceof Error ? phase6.error.message : "The executive-command runtime is unavailable."}</AlertDescription>
      </Alert>
    );
  }
  if (data && !data.runtimeReady) {
    return (
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertTitle>Phase 6 runtime pending</AlertTitle>
        <AlertDescription>{data.runtimeMessage}</AlertDescription>
      </Alert>
    );
  }
  if (!data || !dashboard) return null;

  const mutationPending =
    runRefresh.isPending ||
    runValidation.isPending ||
    beginReview.isPending ||
    recordDecision.isPending ||
    recordPosition.isPending ||
    reviewGate.isPending ||
    updateAssignment.isPending;

  const showError = (title: string, error: unknown) => {
    toast({
      variant: "destructive",
      title,
      description: error instanceof Error ? error.message : "The governed Phase 6 action could not be completed.",
    });
  };

  const runControlledAction = async (
    action: typeof runRefresh | typeof runValidation,
    successTitle: string,
  ) => {
    try {
      const result = await action.mutateAsync();
      toast({ title: successTitle, description: JSON.stringify(result) });
    } catch (error) {
      showError("Controlled action failed", error);
    }
  };

  const openDecision = (decision: Phase6Decision) => {
    setSelectedDecisionId(decision.id);
    setSelectedOptionKey(decision.recommended_option_key || "");
    setPositionAgentKey(decision.requested_by_agent_key || decision.prepared_by_agent_key);
    setPositionOptionKey(decision.recommended_option_key || "none");
  };

  const submitBeginReview = async () => {
    if (!selectedDecision || reviewNotes.trim().length < 10) {
      toast({ variant: "destructive", title: "Review notes required", description: "Select a decision and provide substantive CEO review notes." });
      return;
    }
    try {
      const result = await beginReview.mutateAsync({ decisionItemId: selectedDecision.id, notes: reviewNotes.trim() });
      toast({ title: "CEO review started", description: JSON.stringify(result) });
      setReviewNotes("");
    } catch (error) {
      showError("Decision review was not started", error);
    }
  };

  const submitDecision = async () => {
    if (!selectedDecision || !selectedOptionKey || decisionText.trim().length < 10 || decisionRationale.trim().length < 10 || !decisionEvidenceReference.trim()) {
      toast({
        variant: "destructive",
        title: "Complete decision record required",
        description: "Select an option and provide decision text, rationale, and an evidence reference.",
      });
      return;
    }
    try {
      const result = await recordDecision.mutateAsync({
        decisionItemId: selectedDecision.id,
        decisionCode,
        optionKey: selectedOptionKey,
        decisionText: decisionText.trim(),
        rationale: decisionRationale.trim(),
        conditions: decisionConditions.split("\n").map((entry) => entry.trim()).filter(Boolean),
        evidenceReference: decisionEvidenceReference.trim(),
      });
      toast({ title: "CEO decision recorded", description: JSON.stringify(result) });
      setDecisionText("");
      setDecisionRationale("");
      setDecisionConditions("");
      setDecisionEvidenceReference("");
    } catch (error) {
      showError("CEO decision was not recorded", error);
    }
  };

  const submitPosition = async () => {
    if (!selectedDecision || !positionAgentKey.trim() || positionSummary.trim().length < 10 || positionRationale.trim().length < 10) {
      toast({ variant: "destructive", title: "Complete agent position required", description: "Provide the agent key, position, summary, and rationale." });
      return;
    }
    try {
      const result = await recordPosition.mutateAsync({
        decisionItemId: selectedDecision.id,
        agentKey: positionAgentKey.trim(),
        positionType,
        optionKey: positionOptionKey === "none" ? null : positionOptionKey,
        summary: positionSummary.trim(),
        rationale: positionRationale.trim(),
        confidenceScore: Math.max(0, Math.min(100, Number(positionConfidence) || 0)),
        evidenceReferences: selectedEvidence.map((entry) => entry.evidence_sha256).slice(0, 5),
      });
      toast({ title: "Agent position recorded", description: JSON.stringify(result) });
      setPositionSummary("");
      setPositionRationale("");
    } catch (error) {
      showError("Agent position was not recorded", error);
    }
  };

  const submitAssignmentReview = async () => {
    if (!selectedAssignment || assignmentNotes.trim().length < 10) {
      toast({ variant: "destructive", title: "Assignment notes required", description: "Select an assignment and describe the human-led response." });
      return;
    }
    try {
      const result = await updateAssignment.mutateAsync({
        assignmentId: selectedAssignment.assignment_id,
        status: assignmentStatus,
        notes: assignmentNotes.trim(),
      });
      toast({ title: "Assignment review recorded", description: JSON.stringify(result) });
      setAssignmentNotes("");
    } catch (error) {
      showError("Assignment review failed", error);
    }
  };

  const submitGateReview = async (gate: Phase6Gate) => {
    if (gateNotes.trim().length < 10 || !gateEvidenceReference.trim()) {
      toast({ variant: "destructive", title: "Gate evidence required", description: "Provide substantive review notes and an evidence reference." });
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

  const waitingOnMe = data.decisions.filter((decision) => ["queued", "under_review"].includes(decision.status)).length;
  const waitingOnOthers = data.decisions.filter((decision) => ["returned_for_evidence", "deferred"].includes(decision.status)).length;

  return (
    <Card id="phase-6" className="border-primary/20">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BrainCircuit className="h-5 w-5" /> Phase 6 — Workspace-Native Operations and Executive Command
            </CardTitle>
            <p className="mt-1 max-w-5xl text-sm text-muted-foreground">
              All seventy-seven agents now operate through native HPG Workspace routes, while Noemi Vale converts department
              conditions, monitoring alerts, grant choices, governance gates, precedent, and limitations into evidence-backed CEO decision packets.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={statusVariant(dashboard.program_status)}>{titleCase(dashboard.program_status)}</Badge>
              <Badge variant="outline">Version {dashboard.program_version}</Badge>
              <Badge variant="outline">{dashboard.configured_agent_count} agents</Badge>
              <Badge variant="outline">{dashboard.active_department_count} department workspaces</Badge>
              <Badge variant="outline">{dashboard.active_native_board_count} native boards</Badge>
              <Badge variant={dashboard.schedule_active ? "default" : "destructive"}>
                {dashboard.schedule_active ? "30-minute refresh active" : "Refresh schedule inactive"}
              </Badge>
              <Badge variant="destructive" className="gap-1">
                <LockKeyhole className="h-3 w-3" /> Human CEO authority only
              </Badge>
            </div>
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={mutationPending} onClick={() => runControlledAction(runRefresh, "Phase 6 Workspace refresh completed")}>
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh Command State
              </Button>
              <Button size="sm" disabled={mutationPending} onClick={() => runControlledAction(runValidation, "Phase 6 validation completed")}>
                <PlayCircle className="mr-2 h-4 w-4" /> Run Eight-Scenario Suite
              </Button>
            </div>
          )}
        </div>

        <Alert className="border-primary/30 bg-primary/5">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Noemi prepares; Gilbert decides; human leaders execute</AlertTitle>
          <AlertDescription>
            Phase 6 may classify work, maintain agent queues, calculate capacity and risk, preserve specialist dissent, and prepare
            executive packets. It cannot send email, post to Slack, alter a source work item, submit a grant, move funds, make a legal
            or Board determination, record a CEO decision autonomously, or execute the selected option.
          </AlertDescription>
        </Alert>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Metric label="People waiting on me" value={waitingOnMe} />
          <Metric label="Waiting on others" value={waitingOnOthers} />
          <Metric label="Critical decisions" value={dashboard.critical_decision_count} />
          <Metric label="Overdue decisions" value={dashboard.overdue_decision_count} />
          <Metric label="Critical departments" value={dashboard.critical_department_count} />
          <Metric label="Agent assignments" value={dashboard.active_assignment_count} />
          <Metric label="Native boards" value={dashboard.active_native_board_count} />
          <Metric label="Human gates" value={`${8 - dashboard.human_gates_pending}/8`} />
        </div>

        <Tabs defaultValue="brief" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-4 xl:grid-cols-7">
            <TabsTrigger value="brief">Executive Brief</TabsTrigger>
            <TabsTrigger value="decisions">CEO Decisions</TabsTrigger>
            <TabsTrigger value="departments">Department Command</TabsTrigger>
            <TabsTrigger value="assignments">Agent Work</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="governance">Governance</TabsTrigger>
            <TabsTrigger value="cutover">Cutover & History</TabsTrigger>
          </TabsList>

          <TabsContent value="brief" className="space-y-4">
            {latestBrief ? (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Overall health" value={titleCase(latestBrief.overall_health_status)} />
                  <Metric label="Overall risk" value={`${Math.round(latestBrief.overall_risk_score)}%`} />
                  <Metric label="Active decisions" value={latestBrief.active_decision_count} />
                  <Metric label="Critical decisions" value={latestBrief.critical_decision_count} />
                </div>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">{latestBrief.headline}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {latestBrief.brief_reference} · Prepared by {latestBrief.prepared_by_agent_name} for {latestBrief.executive_authority_name} · {formatDate(latestBrief.as_of)}
                        </p>
                      </div>
                      <Badge variant={statusVariant(latestBrief.overall_health_status)}>{titleCase(latestBrief.overall_health_status)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm leading-relaxed">{latestBrief.executive_summary}</p>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <BriefList title="Highest risks" icon={<AlertTriangle className="h-4 w-4" />} entries={latestBrief.top_risks} />
                      <BriefList title="Priority decisions" icon={<Gavel className="h-4 w-4" />} entries={latestBrief.top_decisions} />
                      <BriefList title="Funding and strategic opportunities" icon={<Sparkles className="h-4 w-4" />} entries={latestBrief.opportunities} />
                      <BriefList title="Known limitations" icon={<FileCheck2 className="h-4 w-4" />} entries={latestBrief.limitations} />
                    </div>
                    <div className="flex flex-wrap justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
                      <span>Source hash: <code>{latestBrief.source_snapshot_sha256}</code></span>
                      <span>Packet hash: <code>{latestBrief.packet_sha256}</code></span>
                      <span>External actions: {latestBrief.external_action_count}</span>
                      <span>Source mutations: {latestBrief.authoritative_source_mutation_count}</span>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <EmptyState icon={<BriefcaseBusiness className="h-5 w-5" />} text="No executive brief is available to this user." />
            )}
          </TabsContent>

          <TabsContent value="decisions" className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={decisionSearch} onChange={(event) => setDecisionSearch(event.target.value)} placeholder="Search decision, recommendation, agent, category, or evidence context" className="pl-9" />
              </div>
              <Select value={decisionStatus} onValueChange={setDecisionStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active decisions</SelectItem>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="under_review">Under review</SelectItem>
                  <SelectItem value="returned_for_evidence">Returned for evidence</SelectItem>
                  <SelectItem value="deferred">Deferred</SelectItem>
                  <SelectItem value="decided">Decided</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
              <Select value={decisionCategory} onValueChange={setDecisionCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {decisionCategories.map((category) => <SelectItem key={category} value={category}>{titleCase(category)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={decisionSeverity} onValueChange={setDecisionSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  {severityKeys.map((severity) => <SelectItem key={severity} value={severity}>{titleCase(severity)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Scores</TableHead>
                    <TableHead>Recommendation</TableHead>
                    <TableHead>Authority and timing</TableHead>
                    <TableHead>Packet integrity</TableHead>
                    <TableHead className="text-right">Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDecisions.map((decision) => (
                    <TableRow key={decision.id} className={selectedDecisionId === decision.id ? "bg-muted/40" : undefined}>
                      <TableCell>
                        <div className="font-mono text-xs font-medium">{decision.decision_reference}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant={statusVariant(decision.severity_key)}>{titleCase(decision.severity_key)}</Badge>
                          <Badge variant={statusVariant(decision.status)}>{titleCase(decision.status)}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[420px]">
                        <div className="font-medium">{decision.title}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{decision.decision_question}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{titleCase(decision.category)} · {titleCase(decision.source_type)} · occurrence {decision.occurrence_count}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        <div>Priority {Math.round(decision.priority_score)}</div>
                        <div>Urgency {Math.round(decision.urgency_score)}</div>
                        <div>Impact {Math.round(decision.impact_score)}</div>
                        <div>Readiness {Math.round(decision.readiness_score)}</div>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <div className="text-sm font-medium">{titleCase(decision.recommended_option_key)}</div>
                        <div className="mt-1 line-clamp-3 text-xs text-muted-foreground">{decision.recommendation_summary || "No recommendation recorded."}</div>
                        {decision.dissent_count > 0 && <Badge variant="destructive" className="mt-2">{decision.dissent_count} dissent</Badge>}
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <div className="text-sm">{decision.decision_authority_name}</div>
                        <div className="text-xs text-muted-foreground">Prepared by {decision.prepared_by_agent_name}</div>
                        <div className="mt-1 text-xs">Due: {formatDate(decision.decision_required_by)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">{decision.option_count} options · {decision.evidence_count} evidence · {decision.position_count} positions</div>
                        <div className="mt-1 max-w-[150px] truncate font-mono text-[10px] text-muted-foreground">{decision.packet_sha256}</div>
                      </TableCell>
                      <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => openDecision(decision)}>Open</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredDecisions.length === 0 && <EmptyState icon={<Gavel className="h-5 w-5" />} text="No decisions match the current filters." />}

            {selectedDecision && (
              <DecisionReviewCard
                decision={selectedDecision}
                options={selectedOptions}
                evidence={selectedEvidence}
                positions={selectedPositions}
                events={selectedEvents}
                isCeo={isCeo}
                canManage={canManage}
                mutationPending={mutationPending}
                reviewNotes={reviewNotes}
                setReviewNotes={setReviewNotes}
                selectedOptionKey={selectedOptionKey}
                setSelectedOptionKey={setSelectedOptionKey}
                decisionCode={decisionCode}
                setDecisionCode={setDecisionCode}
                decisionText={decisionText}
                setDecisionText={setDecisionText}
                decisionRationale={decisionRationale}
                setDecisionRationale={setDecisionRationale}
                decisionConditions={decisionConditions}
                setDecisionConditions={setDecisionConditions}
                decisionEvidenceReference={decisionEvidenceReference}
                setDecisionEvidenceReference={setDecisionEvidenceReference}
                positionAgentKey={positionAgentKey}
                setPositionAgentKey={setPositionAgentKey}
                positionType={positionType}
                setPositionType={setPositionType}
                positionOptionKey={positionOptionKey}
                setPositionOptionKey={setPositionOptionKey}
                positionSummary={positionSummary}
                setPositionSummary={setPositionSummary}
                positionRationale={positionRationale}
                setPositionRationale={setPositionRationale}
                positionConfidence={positionConfidence}
                setPositionConfidence={setPositionConfidence}
                submitBeginReview={submitBeginReview}
                submitDecision={submitDecision}
                submitPosition={submitPosition}
              />
            )}
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.departments.map((department) => (
                <Card key={department.profile_key} className="border-muted">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{department.display_name}</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">{department.lead_agent_name || department.lead_agent_key} · {department.accountable_human_role}</p>
                      </div>
                      <Badge variant={statusVariant(department.health_status)}>{titleCase(department.health_status)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <Score label="Capacity" value={department.capacity_score || 0} />
                      <Score label="Risk" value={department.risk_score || 0} />
                      <Score label="Pressure" value={department.decision_pressure_score || 0} />
                    </div>
                    <p className="text-sm text-muted-foreground">{department.executive_summary || "No current summary."}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Mini label="Open" value={department.open_work_count || 0} />
                      <Mini label="Overdue" value={department.overdue_work_count || 0} />
                      <Mini label="Due 7 days" value={department.due_seven_days_count || 0} />
                      <Mini label="Unowned" value={department.unowned_work_count || 0} />
                      <Mini label="Alerts" value={department.active_alert_count || 0} />
                      <Mini label="Assignments" value={department.active_assignment_count || 0} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{department.active_board_count || 0} boards</Badge>
                      <Badge variant="outline">{department.agent_count || 0} agents</Badge>
                      <Badge variant="outline">{titleCase(department.trend_direction)}</Badge>
                      {department.active_capacity_decision_count > 0 && <Badge variant="destructive">Executive decision active</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="assignments" className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_240px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={assignmentSearch} onChange={(event) => setAssignmentSearch(event.target.value)} placeholder="Search work, department, agent, human owner, NGO, stage, or next action" className="pl-9" />
              </div>
              <Select value={assignmentDepartment} onValueChange={setAssignmentDepartment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {data.departments.map((department) => <SelectItem key={department.module_key} value={department.module_key}>{department.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Work</TableHead><TableHead>Department and agent</TableHead><TableHead>Status</TableHead><TableHead>Priority / risk</TableHead><TableHead>Human owner</TableHead><TableHead>Due</TableHead><TableHead className="text-right">Review</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredAssignments.slice(0, 150).map((assignment) => (
                    <TableRow key={assignment.assignment_id} className={selectedAssignmentId === assignment.assignment_id ? "bg-muted/40" : undefined}>
                      <TableCell className="max-w-[400px]"><div className="font-medium">{assignment.work_title}</div><div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{assignment.work_description || assignment.next_action || "No additional description."}</div><div className="mt-1 text-xs text-muted-foreground">{assignment.ngo_common_name || assignment.ngo_legal_name || assignment.hpg_reference_number || titleCase(assignment.work_type)}</div></TableCell>
                      <TableCell><div className="text-sm font-medium">{assignment.department_name}</div><div className="text-xs text-muted-foreground">{assignment.assigned_agent_name || assignment.assigned_agent_key}</div></TableCell>
                      <TableCell><Badge variant={statusVariant(assignment.assignment_status)}>{titleCase(assignment.assignment_status)}</Badge><div className="mt-1 text-xs text-muted-foreground">Source: {titleCase(assignment.work_status)}</div></TableCell>
                      <TableCell><div className="text-sm">{Math.round(assignment.priority_score)} / {Math.round(assignment.risk_score)}</div><div className="text-xs text-muted-foreground">Priority / risk</div></TableCell>
                      <TableCell>{assignment.assigned_human_name || assignment.source_owner_name || "Not assigned"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{formatDate(assignment.work_due_date || assignment.source_due_date, true)}</TableCell>
                      <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => setSelectedAssignmentId(assignment.assignment_id)}>Open</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {selectedAssignment && (
              <Card>
                <CardHeader><CardTitle className="text-base">Assignment review — {selectedAssignment.work_title}</CardTitle></CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-3">
                    <Detail label="Agent rationale" value={selectedAssignment.assignment_reason} />
                    <Detail label="Next source action" value={selectedAssignment.next_action || "No next action recorded."} />
                    <div className="rounded-lg border bg-muted/10 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">Source snapshot</div><pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(selectedAssignment.source_snapshot, null, 2)}</pre></div>
                  </div>
                  <div className="space-y-3 rounded-lg border p-4">
                    <Field label="Assignment state">
                      <Select value={assignmentStatus} onValueChange={setAssignmentStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="acknowledged">Acknowledged</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                          <SelectItem value="queued">Return to queue</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Human review notes"><Textarea value={assignmentNotes} onChange={(event) => setAssignmentNotes(event.target.value)} placeholder="Describe the analysis requested from the agent and the human owner responsible for action" /></Field>
                    <Button disabled={mutationPending || !canManage} onClick={submitAssignmentReview}><Users className="mr-2 h-4 w-4" /> Record Review</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="validation" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Required scenarios" value={`${dashboard.latest_validation_passed_scenario_count || 0}/${dashboard.latest_validation_scenario_count || dashboard.required_scenario_count}`} />
              <Metric label="Assertions" value={dashboard.latest_validation_assertion_count || 0} />
              <Metric label="Failed assertions" value={dashboard.latest_validation_failed_assertion_count || 0} />
              <Metric label="Source fingerprint" value={dashboard.latest_validation_source_fingerprint_unchanged ? "Unchanged" : "Review"} />
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Scenario</TableHead><TableHead>Control</TableHead><TableHead>Assertions</TableHead><TableHead>Result</TableHead><TableHead>Completed</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.scenarios.map((scenario) => (
                    <TableRow key={scenario.scenario_key}>
                      <TableCell><div className="font-medium">{scenario.title}</div><div className="text-xs text-muted-foreground">{titleCase(scenario.scenario_type)}</div></TableCell>
                      <TableCell className="max-w-[620px]"><div className="text-sm">{scenario.description}</div><div className="mt-1 text-xs text-muted-foreground">Expected: {scenario.expected_result}</div></TableCell>
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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.gates.map((gate) => (
                <Card key={gate.gate_key}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2"><GateIcon status={gate.gate_status} /><div><CardTitle className="text-base">{gate.gate_title}</CardTitle><p className="text-xs text-muted-foreground">{titleCase(gate.gate_group)}</p></div></div>
                      <Badge variant={statusVariant(gate.gate_status)}>{titleCase(gate.gate_status)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{gate.gate_description}</p>
                    {gate.required_reviewer_role && <p className="mt-2 text-xs font-medium">Reviewer: {gate.required_reviewer_role}</p>}
                    {gate.work_item_status && <p className="mt-1 text-xs text-muted-foreground">Work item: {gate.work_item_status} · due {formatDate(gate.work_item_due_date, true)}</p>}
                    {gate.notes && <p className="mt-2 rounded bg-muted/30 p-2 text-xs">{gate.notes}</p>}
                    {gate.gate_group === "human" && gate.gate_status === "pending" && (
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => setSelectedGateKey(selectedGateKey === gate.gate_key ? null : gate.gate_key)}>Review Gate</Button>
                    )}
                    {selectedGateKey === gate.gate_key && (
                      <div className="mt-3 space-y-2 rounded-lg border bg-muted/10 p-3">
                        <Select value={gateStatus} onValueChange={(value) => setGateStatus(value as "passed" | "failed" | "waived")}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="passed">Pass with evidence</SelectItem>
                            <SelectItem value="failed">Fail and return for correction</SelectItem>
                            {isAdmin && <SelectItem value="waived">Waive with authority</SelectItem>}
                          </SelectContent>
                        </Select>
                        <Textarea value={gateNotes} onChange={(event) => setGateNotes(event.target.value)} placeholder="Review findings, scoring concerns, authority boundaries, and required corrections" />
                        <Input value={gateEvidenceReference} onChange={(event) => setGateEvidenceReference(event.target.value)} placeholder="Evidence or controlled document reference" />
                        <Button size="sm" disabled={mutationPending} onClick={() => submitGateReview(gate)}>Record Review</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="cutover" className="space-y-4">
            {data.cutover && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                  <Metric label="Agents" value={`${data.cutover.agents_with_workspace_routes}/${data.cutover.total_agent_count}`} />
                  <Metric label="Historical-only Trello" value={data.cutover.historical_only_trello_agent_count} />
                  <Metric label="Agent-work boards" value={data.cutover.native_agent_work_board_count} />
                  <Metric label="Board bindings" value={data.cutover.active_board_binding_count} />
                  <Metric label="Trello work sync" value={data.cutover.trello_synced_work_item_count} />
                  <Metric label="Trello queue" value={data.cutover.active_trello_queue_count} />
                  <Metric label="External actions" value={data.cutover.external_actions_enabled ? "Enabled" : "Disabled"} />
                  <Metric label="Autonomous decisions" value={data.cutover.autonomous_decisions_enabled ? "Enabled" : "Disabled"} />
                </div>
                <Alert>
                  <Database className="h-4 w-4" />
                  <AlertTitle>HPG Workspace and Supabase are authoritative</AlertTitle>
                  <AlertDescription>
                    Trello remains historical provenance only. Native Workspace boards, work items, Agent OS assignments, monitoring,
                    institutional memory, and executive decision packets now constitute the operating environment.
                  </AlertDescription>
                </Alert>
              </>
            )}
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Board</TableHead><TableHead>Access area</TableHead><TableHead>Department</TableHead><TableHead>Default agent</TableHead><TableHead>Binding role</TableHead><TableHead>Route</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.boards.map((board) => (
                    <TableRow key={board.board_key}>
                      <TableCell><div className="font-medium">{board.display_name}</div><div className="font-mono text-xs text-muted-foreground">{board.board_key}</div></TableCell>
                      <TableCell>{titleCase(board.access_area)}</TableCell>
                      <TableCell>{board.department_name || "Not bound"}</TableCell>
                      <TableCell>{board.default_agent_name || board.default_agent_key || "Not assigned"}</TableCell>
                      <TableCell>{titleCase(board.binding_role)}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs">{board.source_route_template || "Not recorded"}</TableCell>
                      <TableCell><Badge variant={statusVariant(board.binding_status || (board.is_active ? "active" : "inactive"))}>{titleCase(board.binding_status || (board.is_active ? "active" : "inactive"))}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div>
              <h3 className="mb-3 font-semibold">Refresh history</h3>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Run</TableHead><TableHead>Mode</TableHead><TableHead>Status</TableHead><TableHead>Work</TableHead><TableHead>Assignments</TableHead><TableHead>Snapshots</TableHead><TableHead>Decisions</TableHead><TableHead>Brief</TableHead><TableHead>Integrity</TableHead><TableHead>Completed</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.refreshes.map((refresh) => (
                      <TableRow key={refresh.id}>
                        <TableCell className="max-w-[230px]"><div className="font-mono text-xs">{refresh.run_key}</div><div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{refresh.summary}</div></TableCell>
                        <TableCell><Badge variant="outline">{titleCase(refresh.run_mode)}</Badge></TableCell>
                        <TableCell><Badge variant={statusVariant(refresh.status)}>{titleCase(refresh.status)}</Badge></TableCell>
                        <TableCell>{refresh.source_work_item_count}</TableCell>
                        <TableCell>{refresh.assignment_count}</TableCell>
                        <TableCell>{refresh.snapshot_count}</TableCell>
                        <TableCell>{refresh.decision_candidates}</TableCell>
                        <TableCell>{refresh.brief_count}</TableCell>
                        <TableCell className="text-xs">External {refresh.external_side_effect_count}<br />Source {refresh.authoritative_source_mutation_count}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(refresh.completed_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4" /> Executive agent: {dashboard.executive_agent_name || dashboard.executive_agent_key} · Human authority: {dashboard.executive_authority_name || "Not recorded"}</div>
          <div className="text-muted-foreground">Last refresh: {formatDate(dashboard.last_refresh_at)} · Next refresh: {formatDate(dashboard.next_scheduled_refresh_at)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

interface DecisionReviewCardProps {
  decision: Phase6Decision;
  options: ReturnType<typeof usePhase6Command>["data"] extends infer _T ? Array<import("@/hooks/usePhase6Command").Phase6DecisionOption> : never;
  evidence: Array<import("@/hooks/usePhase6Command").Phase6DecisionEvidence>;
  positions: Array<import("@/hooks/usePhase6Command").Phase6DecisionPosition>;
  events: Array<import("@/hooks/usePhase6Command").Phase6DecisionEvent>;
  isCeo: boolean;
  canManage: boolean;
  mutationPending: boolean;
  reviewNotes: string;
  setReviewNotes: (value: string) => void;
  selectedOptionKey: string;
  setSelectedOptionKey: (value: string) => void;
  decisionCode: string;
  setDecisionCode: (value: string) => void;
  decisionText: string;
  setDecisionText: (value: string) => void;
  decisionRationale: string;
  setDecisionRationale: (value: string) => void;
  decisionConditions: string;
  setDecisionConditions: (value: string) => void;
  decisionEvidenceReference: string;
  setDecisionEvidenceReference: (value: string) => void;
  positionAgentKey: string;
  setPositionAgentKey: (value: string) => void;
  positionType: string;
  setPositionType: (value: string) => void;
  positionOptionKey: string;
  setPositionOptionKey: (value: string) => void;
  positionSummary: string;
  setPositionSummary: (value: string) => void;
  positionRationale: string;
  setPositionRationale: (value: string) => void;
  positionConfidence: string;
  setPositionConfidence: (value: string) => void;
  submitBeginReview: () => void;
  submitDecision: () => void;
  submitPosition: () => void;
}

function DecisionReviewCard(props: DecisionReviewCardProps) {
  const { decision, options, evidence, positions, events } = props;
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{decision.decision_reference} — {decision.title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{decision.decision_question}</p>
          </div>
          <div className="flex gap-2"><Badge variant={statusVariant(decision.severity_key)}>{titleCase(decision.severity_key)}</Badge><Badge variant={statusVariant(decision.status)}>{titleCase(decision.status)}</Badge></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Detail label="Prepared by" value={`${decision.prepared_by_agent_name} (${decision.prepared_by_agent_key})`} />
          <Detail label="Requested by" value={decision.requested_by_agent_name || decision.requested_by_agent_key || "Not recorded"} />
          <Detail label="Human authority" value={`${decision.decision_authority_name} · ${decision.accountable_human_role}`} />
          <Detail label="Decision required" value={formatDate(decision.decision_required_by)} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Detail label="Current context" value={decision.context_summary} />
          <Detail label="Noemi recommendation" value={`${titleCase(decision.recommended_option_key)} — ${decision.recommendation_summary || "No summary."}`} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Score label="Priority" value={decision.priority_score} />
          <Score label="Urgency" value={decision.urgency_score} />
          <Score label="Impact" value={decision.impact_score} />
          <Score label="Evidence" value={decision.evidence_strength_score} />
          <Score label="Confidence" value={decision.confidence_score} />
          <Score label="Readiness" value={decision.readiness_score} />
        </div>

        <Tabs defaultValue="options" className="space-y-3">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-6">
            <TabsTrigger value="options">Options</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="context">Context</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="decision">CEO Record</TabsTrigger>
          </TabsList>
          <TabsContent value="options" className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {options.map((option) => (
              <div key={option.id} className={`rounded-lg border p-4 ${option.is_recommended ? "border-primary/40 bg-primary/5" : ""}`}>
                <div className="flex items-start justify-between gap-2"><div><div className="font-medium">{option.label}</div><div className="text-xs text-muted-foreground">Rank {option.recommendation_rank}</div></div>{option.is_recommended && <Badge>Recommended</Badge>}</div>
                <p className="mt-2 text-sm text-muted-foreground">{option.description}</p>
                <div className="mt-3 space-y-1 text-xs"><div>Effort: {option.estimated_effort || "Not recorded"}</div><div>Timeline: {option.estimated_timeline || "Not recorded"}</div><div>Reversible: {option.reversible ? "Yes" : "No"}</div></div>
                <p className="mt-3 rounded bg-muted/30 p-2 text-xs">{option.consequence_summary}</p>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="evidence" className="space-y-3">
            {evidence.map((entry) => (
              <div key={entry.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-medium">{titleCase(entry.evidence_type)} — {entry.evidence_reference || entry.source_system}</div><div className="text-xs text-muted-foreground">Strength {Math.round(entry.evidence_strength_score)} · {entry.is_primary ? "Primary" : "Supporting"}</div></div><Badge variant={entry.is_primary ? "default" : "outline"}>{entry.is_primary ? "Primary" : "Supporting"}</Badge></div>
                <p className="mt-2 text-sm text-muted-foreground">{entry.evidence_summary}</p>
                <div className="mt-2 truncate font-mono text-[10px] text-muted-foreground">{entry.evidence_sha256}</div>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="positions" className="space-y-3">
            {positions.map((position) => (
              <div key={position.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2"><div><div className="font-medium">{position.agent_name} — {titleCase(position.position_type)}</div><div className="text-xs text-muted-foreground">{position.agent_title} · confidence {Math.round(position.confidence_score)}</div></div><Badge variant={position.position_type === "dissent" || position.position_type === "concern" ? "destructive" : "outline"}>{titleCase(position.position_type)}</Badge></div>
                <p className="mt-2 text-sm">{position.summary}</p><p className="mt-1 text-xs text-muted-foreground">{position.rationale}</p>
              </div>
            ))}
            {props.canManage && (
              <div className="grid gap-3 rounded-lg border bg-muted/10 p-4 lg:grid-cols-2">
                <Field label="Agent key"><Input value={props.positionAgentKey} onChange={(event) => props.setPositionAgentKey(event.target.value)} placeholder="hpg-aos-000" /></Field>
                <Field label="Position"><Select value={props.positionType} onValueChange={props.setPositionType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{positionTypes.map((type) => <SelectItem key={type} value={type}>{titleCase(type)}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Option"><Select value={props.positionOptionKey} onValueChange={props.setPositionOptionKey}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No option selected</SelectItem>{options.map((option) => <SelectItem key={option.option_key} value={option.option_key}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Confidence"><Input type="number" min={0} max={100} value={props.positionConfidence} onChange={(event) => props.setPositionConfidence(event.target.value)} /></Field>
                <Field label="Summary"><Textarea value={props.positionSummary} onChange={(event) => props.setPositionSummary(event.target.value)} placeholder="State the agent’s recommendation, support, concern, or dissent" /></Field>
                <Field label="Rationale"><Textarea value={props.positionRationale} onChange={(event) => props.setPositionRationale(event.target.value)} placeholder="Explain the evidence and reasoning behind the position" /></Field>
                <Button className="lg:col-span-2" disabled={props.mutationPending} onClick={props.submitPosition}><Network className="mr-2 h-4 w-4" /> Record Specialist Position</Button>
              </div>
            )}
          </TabsContent>
          <TabsContent value="context" className="grid gap-3 md:grid-cols-2">
            <JsonBlock label="Assumptions" value={decision.assumptions} />
            <JsonBlock label="Dependencies" value={decision.dependencies} />
            <JsonBlock label="Risks" value={decision.risks} />
            <JsonBlock label="Expected outcomes" value={decision.expected_outcomes} />
            <JsonBlock label="Source snapshot" value={decision.source_snapshot} className="md:col-span-2" />
          </TabsContent>
          <TabsContent value="history" className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-lg border p-3"><div className="flex flex-wrap justify-between gap-2"><div className="font-medium">{titleCase(event.event_type)}</div><div className="text-xs text-muted-foreground">{formatDate(event.created_at)}</div></div><div className="mt-1 text-xs text-muted-foreground">Actor: {event.actor_user_name || event.actor_agent_name || event.actor_agent_key || "System"}</div><div className="mt-2 truncate font-mono text-[10px] text-muted-foreground">{event.event_sha256}</div></div>
            ))}
          </TabsContent>
          <TabsContent value="decision" className="space-y-4">
            {!props.isCeo && (
              <Alert><LockKeyhole className="h-4 w-4" /><AlertTitle>CEO authority required</AlertTitle><AlertDescription>You may review the packet and preserve a specialist position, but only the named Chief Executive can begin executive review or record the final decision.</AlertDescription></Alert>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-lg border p-4">
                <Field label="CEO review notes"><Textarea value={props.reviewNotes} onChange={(event) => props.setReviewNotes(event.target.value)} placeholder="Record the questions, evidence, and conditions being examined" /></Field>
                <Button variant="outline" disabled={!props.isCeo || props.mutationPending || !["queued", "returned_for_evidence", "deferred"].includes(decision.status)} onClick={props.submitBeginReview}><Clock3 className="mr-2 h-4 w-4" /> Begin CEO Review</Button>
              </div>
              <div className="space-y-3 rounded-lg border p-4">
                <Field label="Selected option"><Select value={props.selectedOptionKey} onValueChange={props.setSelectedOptionKey}><SelectTrigger><SelectValue placeholder="Select an option" /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.option_key} value={option.option_key}>{option.label}</SelectItem>)}</SelectContent></Select></Field>
                <Field label="Decision code"><Select value={props.decisionCode} onValueChange={props.setDecisionCode}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="approve">Approve selected option</SelectItem><SelectItem value="approve_with_conditions">Approve with conditions</SelectItem><SelectItem value="defer">Defer decision</SelectItem><SelectItem value="return">Return for evidence</SelectItem><SelectItem value="decline">Decline selected action</SelectItem></SelectContent></Select></Field>
                <Field label="Decision text"><Textarea value={props.decisionText} onChange={(event) => props.setDecisionText(event.target.value)} placeholder="State the human executive decision" /></Field>
                <Field label="Rationale"><Textarea value={props.decisionRationale} onChange={(event) => props.setDecisionRationale(event.target.value)} placeholder="Explain the evidence, tradeoffs, precedent, and judgment" /></Field>
                <Field label="Conditions — one per line"><Textarea value={props.decisionConditions} onChange={(event) => props.setDecisionConditions(event.target.value)} placeholder="Named human owner\nEvidence deadline\nReview date" /></Field>
                <Field label="Decision evidence reference"><Input value={props.decisionEvidenceReference} onChange={(event) => props.setDecisionEvidenceReference(event.target.value)} placeholder="Controlled document, meeting record, or evidence URL" /></Field>
                <Button disabled={!props.isCeo || props.mutationPending || !["queued", "under_review", "returned_for_evidence", "deferred"].includes(decision.status)} onClick={props.submitDecision}><Gavel className="mr-2 h-4 w-4" /> Record CEO Decision</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        <div className="flex flex-wrap justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground"><span>Source hash: <code>{decision.source_snapshot_sha256}</code></span><span>Packet hash: <code>{decision.packet_sha256}</code></span><span>External action requested: {decision.external_action_requested ? "Yes" : "No"}</span><span>Autonomous execution: {decision.autonomous_execution_enabled ? "Yes" : "No"}</span></div>
      </CardContent>
    </Card>
  );
}

const decisionCategories = ["compliance", "financial", "grant", "governance", "operational", "strategic"];
const severityKeys = ["informational", "watch", "action_required", "high_risk", "critical"];
const positionTypes = ["recommend", "support", "concern", "dissent", "abstain", "insufficient_evidence"];

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-lg border bg-muted/20 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 break-words text-2xl font-semibold">{value}</div></div>;
}

function Score({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-muted/20 p-3 text-center"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold">{Math.round(value)}</div></div>;
}

function Mini({ label, value }: { label: string; value: number }) {
  return <div className="rounded border bg-muted/10 p-2"><div className="text-muted-foreground">{label}</div><div className="font-medium">{value}</div></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border bg-muted/10 p-3"><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-sm">{value}</div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-5 py-10 text-sm text-muted-foreground">{icon} {text}</div>;
}

function GateIcon({ status }: { status: string }) {
  if (status === "passed" || status === "waived") return <CheckCircle2 className="mt-0.5 h-4 w-4" />;
  if (status === "failed") return <XCircle className="mt-0.5 h-4 w-4 text-destructive" />;
  return <CircleDashed className="mt-0.5 h-4 w-4 text-muted-foreground" />;
}

function JsonBlock({ label, value, className = "" }: { label: string; value: unknown; className?: string }) {
  return <div className={`rounded-lg border bg-muted/10 p-3 ${className}`}><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(value, null, 2)}</pre></div>;
}

function BriefList({ title, icon, entries }: { title: string; icon: ReactNode; entries: Array<Record<string, unknown>> }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="flex items-center gap-2 font-semibold">{icon} {title}</h3>
      <div className="mt-3 space-y-3">
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">No entries recorded.</p> : entries.slice(0, 8).map((entry, index) => (
          <div key={`${title}-${index}`} className="rounded border bg-muted/10 p-3">
            <div className="text-sm font-medium">{recordValue(entry, "title") !== "Not recorded" ? recordValue(entry, "title") : recordValue(entry, "opportunity")}</div>
            <div className="mt-1 text-xs text-muted-foreground">{recordValue(entry, "summary") !== "Not recorded" ? recordValue(entry, "summary") : recordValue(entry, "recommended_next_action")}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">{Object.entries(entry).slice(0, 5).map(([key, value]) => `${titleCase(key)}: ${displayValue(value)}`).join(" · ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
