import { useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Eye,
  FileWarning,
  Layers3,
  LockKeyhole,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  TimerReset,
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
  useAcknowledgePhase5Alert,
  useDismissPhase5Alert,
  usePhase5Monitoring,
  useResolvePhase5Alert,
  useReviewPhase5Gate,
  useRunPhase5Scan,
  useRunPhase5Validation,
  useSnoozePhase5Alert,
  type Phase5Alert,
  type Phase5Gate,
} from "@/hooks/usePhase5Monitoring";

const titleCase = (value: string | null | undefined) =>
  (value || "Not recorded").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusVariant = (status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" => {
  if (["critical", "high_risk", "failed", "paused", "overdue", "escalated", "rejected"].includes(status || "")) return "destructive";
  if (["action_required", "watch", "pending", "open", "snoozed", "validating", "ready_for_human_review"].includes(status || "")) return "secondary";
  if (["passed", "active", "pilot", "resolved", "acknowledged", "complete", "completed"].includes(status || "")) return "default";
  return "outline";
};

const formatDate = (value: string | null | undefined, dateOnly = false) => {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, dateOnly ? "MMM d, yyyy" : "MMM d, yyyy h:mm a");
};

const formatMinutes = (minutes: number | null | undefined) => {
  if (!minutes && minutes !== 0) return "Default";
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes / 1440 === 1 ? "" : "s"}`;
  if (minutes % 60 === 0) return `${minutes / 60} hr`;
  return `${minutes} min`;
};

export function Phase5MonitoringPanel() {
  const { toast } = useToast();
  const { data: userRole } = useUserRole();
  const phase5 = usePhase5Monitoring();
  const runScan = useRunPhase5Scan();
  const runValidation = useRunPhase5Validation();
  const acknowledgeAlert = useAcknowledgePhase5Alert();
  const snoozeAlert = useSnoozePhase5Alert();
  const resolveAlert = useResolvePhase5Alert();
  const dismissAlert = useDismissPhase5Alert();
  const reviewGate = useReviewPhase5Gate();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [acknowledgementNotes, setAcknowledgementNotes] = useState("");
  const [snoozeUntil, setSnoozeUntil] = useState("");
  const [snoozeReason, setSnoozeReason] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [resolutionEvidence, setResolutionEvidence] = useState("");
  const [dismissalReason, setDismissalReason] = useState("");
  const [selectedGateKey, setSelectedGateKey] = useState<string | null>(null);
  const [gateStatus, setGateStatus] = useState<"passed" | "failed" | "waived">("passed");
  const [gateNotes, setGateNotes] = useState("");
  const [gateEvidenceReference, setGateEvidenceReference] = useState("");

  const isAdmin = isAdminRole(userRole?.role);
  const canManage = isAdmin || isVpRole(userRole?.role) || isDepartmentLeadRole(userRole?.role);

  const filteredAlerts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (phase5.data?.alerts || []).filter((alert) => {
      if (categoryFilter !== "all" && alert.category !== categoryFilter) return false;
      if (severityFilter !== "all" && alert.severity_key !== severityFilter) return false;
      if (statusFilter === "active" && !["open", "acknowledged", "snoozed", "escalated"].includes(alert.status)) return false;
      if (statusFilter !== "all" && statusFilter !== "active" && alert.status !== statusFilter) return false;
      if (!query) return true;
      return [
        alert.alert_reference,
        alert.title,
        alert.summary,
        alert.category,
        alert.severity_key,
        alert.status,
        alert.entity_type,
        alert.entity_id,
        alert.source_table,
        alert.ngo_name,
        alert.owner_agent_name,
        alert.owner_user_name,
        alert.rule_title,
        alert.required_response,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [phase5.data?.alerts, search, categoryFilter, severityFilter, statusFilter]);

  const selectedAlert = useMemo(
    () => (phase5.data?.alerts || []).find((alert) => alert.id === selectedAlertId) || null,
    [phase5.data?.alerts, selectedAlertId],
  );

  if (phase5.isLoading) return <Skeleton className="h-[760px] w-full" />;

  if (phase5.error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Phase 5 could not be loaded</AlertTitle>
        <AlertDescription>
          {phase5.error instanceof Error ? phase5.error.message : "The continuous-monitoring runtime is unavailable."}
        </AlertDescription>
      </Alert>
    );
  }

  if (phase5.data && !phase5.data.runtimeReady) {
    return (
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertTitle>Phase 5 runtime pending</AlertTitle>
        <AlertDescription>{phase5.data.runtimeMessage}</AlertDescription>
      </Alert>
    );
  }

  const data = phase5.data;
  const dashboard = data?.dashboard;
  if (!dashboard) return null;

  const showError = (title: string, error: unknown) =>
    toast({
      variant: "destructive",
      title,
      description: error instanceof Error ? error.message : "The governed Phase 5 action could not be completed.",
    });

  const runControlledAction = async (
    action: typeof runScan | typeof runValidation,
    successTitle: string,
  ) => {
    try {
      const result = await action.mutateAsync();
      toast({ title: successTitle, description: JSON.stringify(result) });
    } catch (error) {
      showError("Controlled action failed", error);
    }
  };

  const submitAcknowledgement = async () => {
    if (!selectedAlert || acknowledgementNotes.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Acknowledgement notes required",
        description: "Select an alert and provide at least ten characters describing the responsible human response.",
      });
      return;
    }
    try {
      const result = await acknowledgeAlert.mutateAsync({ alertId: selectedAlert.id, notes: acknowledgementNotes.trim() });
      toast({ title: "Alert acknowledged", description: JSON.stringify(result) });
      setAcknowledgementNotes("");
    } catch (error) {
      showError("Alert was not acknowledged", error);
    }
  };

  const submitSnooze = async () => {
    if (!selectedAlert || !snoozeUntil || snoozeReason.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Bounded snooze details required",
        description: "Provide a future end time and a documented reason of at least ten characters.",
      });
      return;
    }
    try {
      const result = await snoozeAlert.mutateAsync({
        alertId: selectedAlert.id,
        snoozedUntil: new Date(snoozeUntil).toISOString(),
        reason: snoozeReason.trim(),
      });
      toast({ title: "Alert snoozed with suppression record", description: JSON.stringify(result) });
      setSnoozeUntil("");
      setSnoozeReason("");
    } catch (error) {
      showError("Alert was not snoozed", error);
    }
  };

  const submitResolution = async () => {
    if (!selectedAlert || resolutionSummary.trim().length < 10 || !resolutionEvidence.trim()) {
      toast({
        variant: "destructive",
        title: "Resolution evidence required",
        description: "Provide a resolution summary and a controlled evidence reference.",
      });
      return;
    }
    try {
      const result = await resolveAlert.mutateAsync({
        alertId: selectedAlert.id,
        summary: resolutionSummary.trim(),
        evidenceReference: resolutionEvidence.trim(),
      });
      toast({ title: "Alert resolved", description: JSON.stringify(result) });
      setResolutionSummary("");
      setResolutionEvidence("");
    } catch (error) {
      showError("Alert was not resolved", error);
    }
  };

  const submitDismissal = async () => {
    if (!selectedAlert || dismissalReason.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Dismissal reason required",
        description: "Management must document why the alert is not actionable or is a false positive.",
      });
      return;
    }
    try {
      const result = await dismissAlert.mutateAsync({ alertId: selectedAlert.id, reason: dismissalReason.trim() });
      toast({ title: "Alert dismissed with audit evidence", description: JSON.stringify(result) });
      setDismissalReason("");
    } catch (error) {
      showError("Alert was not dismissed", error);
    }
  };

  const submitGateReview = async (gate: Phase5Gate) => {
    if (gateNotes.trim().length < 10 || !gateEvidenceReference.trim()) {
      toast({
        variant: "destructive",
        title: "Evidence and review notes required",
        description: "Provide an evidence reference and at least ten characters of review findings.",
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
    runScan.isPending ||
    runValidation.isPending ||
    acknowledgeAlert.isPending ||
    snoozeAlert.isPending ||
    resolveAlert.isPending ||
    dismissAlert.isPending ||
    reviewGate.isPending;

  return (
    <Card id="phase-5">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <BellRing className="h-5 w-5" /> Phase 5 — Continuous Monitoring and Proactive Intelligence
            </CardTitle>
            <p className="mt-1 max-w-5xl text-sm text-muted-foreground">
              A governed fifteen-minute monitoring layer for compliance, finance, grants, governance, deadlines,
              capacity, and operational risk—before the issue must be discovered manually.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={statusVariant(dashboard.program_status)}>{titleCase(dashboard.program_status)}</Badge>
              <Badge variant="outline">Version {dashboard.program_version}</Badge>
              <Badge variant="outline">{dashboard.active_rule_count} active rules</Badge>
              <Badge variant="outline">{dashboard.active_source_count} monitored sources</Badge>
              <Badge variant={dashboard.schedule_active ? "default" : "destructive"}>
                {dashboard.schedule_active ? "15-minute schedule active" : "Schedule inactive"}
              </Badge>
              <Badge variant="destructive" className="gap-1">
                <LockKeyhole className="h-3 w-3" /> External action disabled
              </Badge>
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={mutationPending}
                onClick={() => runControlledAction(runScan, "Phase 5 monitoring scan completed")}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Run Scan Now
              </Button>
              <Button
                size="sm"
                disabled={mutationPending}
                onClick={() => runControlledAction(runValidation, "Phase 5 validation completed")}
              >
                <PlayCircle className="mr-2 h-4 w-4" /> Run Eight-Scenario Suite
              </Button>
            </div>
          )}
        </div>

        <Alert className="border-warning/40 bg-warning/5">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Observe, alert, route, and document—without autonomous remediation</AlertTitle>
          <AlertDescription>
            Phase 5 creates internal evidence-backed alerts and internal escalation records. It cannot send email or Slack,
            create corrective work automatically, change an authoritative operational record, move funds, post journals,
            submit grants, make legal determinations, or exercise Board and executive authority.
          </AlertDescription>
        </Alert>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Metric label="Active alerts" value={dashboard.active_alert_count} />
          <Metric label="Critical" value={dashboard.critical_alert_count} />
          <Metric label="High risk" value={dashboard.high_risk_alert_count} />
          <Metric label="Action required" value={dashboard.action_required_alert_count} />
          <Metric label="Response overdue" value={dashboard.response_overdue_count} />
          <Metric label="Escalation due" value={dashboard.escalation_due_count} />
          <Metric label="Rules" value={dashboard.active_rule_count} />
          <Metric label="Human gates" value={`${8 - dashboard.human_gates_pending}/8`} />
        </div>

        <Tabs defaultValue="alerts" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-4 xl:grid-cols-7">
            <TabsTrigger value="alerts">Alert Queue</TabsTrigger>
            <TabsTrigger value="rules">Rules & Thresholds</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="governance">Governance</TabsTrigger>
            <TabsTrigger value="history">Scan History</TabsTrigger>
            <TabsTrigger value="controls">Suppressions</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_190px_190px_190px]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search alert, entity, source, owner, response, or NGO"
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => <SelectItem key={category} value={category}>{titleCase(category)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  {severityKeys.map((severity) => <SelectItem key={severity} value={severity}>{titleCase(severity)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active alerts</SelectItem>
                  <SelectItem value="all">All statuses</SelectItem>
                  {alertStatuses.map((status) => <SelectItem key={status} value={status}>{titleCase(status)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Alert</TableHead>
                    <TableHead>Owner and response</TableHead>
                    <TableHead>Deadlines</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead className="text-right">Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlerts.map((alert) => (
                    <TableRow key={alert.id} className={selectedAlertId === alert.id ? "bg-muted/40" : undefined}>
                      <TableCell>
                        <div className="font-mono text-xs font-medium">{alert.alert_reference}</div>
                        <Badge variant="outline" className="mt-1">{titleCase(alert.category)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={statusVariant(alert.severity_key)}>{titleCase(alert.severity_key)}</Badge>
                          <Badge variant={statusVariant(alert.status)}>{titleCase(alert.status)}</Badge>
                          {alert.executive_visibility && <Badge variant="destructive">Executive visibility</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[430px]">
                        <div className="font-medium">{alert.title}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{alert.summary}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {titleCase(alert.entity_type)} · {alert.aggregation_key || alert.entity_id || "Not linked"}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <div className="text-sm font-medium">{alert.owner_agent_name || alert.owner_agent_key || "Agent owner not assigned"}</div>
                        <div className="text-xs text-muted-foreground">{alert.accountable_human_role}</div>
                        <div className="mt-1 line-clamp-2 text-xs">{alert.required_response}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        <div>Source due: {formatDate(alert.due_at, true)}</div>
                        <div className="text-xs text-muted-foreground">Respond: {formatDate(alert.response_due_at)}</div>
                        <div className="text-xs text-muted-foreground">Escalate: {formatDate(alert.escalation_due_at)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{alert.signal_count} signal{alert.signal_count === 1 ? "" : "s"}</div>
                        <div className="text-xs text-muted-foreground">{alert.event_count} audit event{alert.event_count === 1 ? "" : "s"}</div>
                        <div className="mt-1 max-w-[150px] truncate font-mono text-[10px] text-muted-foreground">{alert.latest_evidence_sha256}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedAlertId(alert.id)}>Open</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredAlerts.length === 0 && <EmptyState icon={<Eye className="h-5 w-5" />} text="No alerts match the current filters." />}

            {selectedAlert && (
              <AlertReviewCard
                alert={selectedAlert}
                canManage={canManage}
                mutationPending={mutationPending}
                acknowledgementNotes={acknowledgementNotes}
                setAcknowledgementNotes={setAcknowledgementNotes}
                snoozeUntil={snoozeUntil}
                setSnoozeUntil={setSnoozeUntil}
                snoozeReason={snoozeReason}
                setSnoozeReason={setSnoozeReason}
                resolutionSummary={resolutionSummary}
                setResolutionSummary={setResolutionSummary}
                resolutionEvidence={resolutionEvidence}
                setResolutionEvidence={setResolutionEvidence}
                dismissalReason={dismissalReason}
                setDismissalReason={setDismissalReason}
                submitAcknowledgement={submitAcknowledgement}
                submitSnooze={submitSnooze}
                submitResolution={submitResolution}
                submitDismissal={submitDismissal}
              />
            )}
          </TabsContent>

          <TabsContent value="rules" className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {data.severities.map((severity) => (
                <div key={severity.severity_key} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={statusVariant(severity.severity_key)}>{severity.label}</Badge>
                    <span className="text-xs text-muted-foreground">Rank {severity.severity_rank}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{severity.description}</p>
                  <div className="mt-3 space-y-1 text-xs">
                    <div>Respond: {formatMinutes(severity.default_response_minutes)}</div>
                    <div>Escalate: {formatMinutes(severity.default_escalation_minutes)}</div>
                    <div>{severity.requires_acknowledgement ? "Acknowledgement required" : "Awareness only"}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Rule</TableHead><TableHead>Source</TableHead><TableHead>Base risk</TableHead><TableHead>Owner</TableHead><TableHead>Timing</TableHead><TableHead>Controls</TableHead><TableHead>Alerts</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.rules.map((rule) => (
                    <TableRow key={rule.rule_key}>
                      <TableCell className="max-w-[360px]"><div className="font-medium">{rule.title}</div><div className="text-xs text-muted-foreground">{titleCase(rule.category)} · {titleCase(rule.condition_type)}</div><div className="mt-1 line-clamp-2 text-xs">{rule.description}</div></TableCell>
                      <TableCell><div className="text-sm">{rule.source_name}</div><div className="font-mono text-xs text-muted-foreground">{rule.source_table}</div></TableCell>
                      <TableCell><Badge variant={statusVariant(rule.base_severity_key)}>{titleCase(rule.base_severity_key)}</Badge><div className="mt-1 text-xs text-muted-foreground">{rule.threshold_label || "Rule-specific threshold"}</div></TableCell>
                      <TableCell className="max-w-[250px]"><div className="text-sm">{rule.owner_agent_name || rule.owner_agent_key}</div><div className="text-xs text-muted-foreground">{rule.accountable_human_role}</div></TableCell>
                      <TableCell><div className="text-sm">Every {formatMinutes(rule.frequency_minutes)}</div><div className="text-xs text-muted-foreground">Suppress duplicates: {formatMinutes(rule.suppression_window_minutes)}</div></TableCell>
                      <TableCell><div className="text-sm">{titleCase(rule.aggregation_mode)} aggregation</div><div className="text-xs text-muted-foreground">Auto-resolve after {rule.resolve_after_missed_runs} clear scan{rule.resolve_after_missed_runs === 1 ? "" : "s"}</div></TableCell>
                      <TableCell><div className="font-medium">{rule.active_alert_count} active</div><div className="text-xs text-muted-foreground">{rule.total_alert_count} total</div></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="mb-3 font-semibold">Draft Financial and Operational Threshold Library</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.thresholds.map((threshold) => (
                  <div key={threshold.threshold_key} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><div className="font-medium">{threshold.label}</div><div className="text-xs text-muted-foreground">{titleCase(threshold.category)} · {threshold.unit}</div></div>
                      <Badge variant={threshold.policy_status === "approved" ? "default" : "secondary"}>{titleCase(threshold.policy_status)}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{threshold.description}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <ThresholdValue label="Watch" value={threshold.watch_value} />
                      <ThresholdValue label="Action" value={threshold.action_required_value} />
                      <ThresholdValue label="High risk" value={threshold.high_risk_value} />
                      <ThresholdValue label="Critical" value={threshold.critical_value} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="sources" className="space-y-4">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Source</TableHead><TableHead>Category</TableHead><TableHead>Owner agent</TableHead><TableHead>Rows</TableHead><TableHead>Signals</TableHead><TableHead>Active alerts</TableHead><TableHead>Coverage</TableHead><TableHead>Last scan</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.sources.map((source) => (
                    <TableRow key={source.source_key}>
                      <TableCell className="max-w-[360px]"><div className="font-medium">{source.display_name}</div><div className="font-mono text-xs text-muted-foreground">{source.source_schema}.{source.source_table}</div><div className="mt-1 line-clamp-2 text-xs">{source.source_description}</div></TableCell>
                      <TableCell><Badge variant="outline">{titleCase(source.category)}</Badge><div className="mt-1 text-xs text-muted-foreground">{titleCase(source.confidentiality)}</div></TableCell>
                      <TableCell>{source.owner_agent_name || source.owner_agent_key || "Not assigned"}</TableCell>
                      <TableCell>{source.last_source_row_count}</TableCell>
                      <TableCell>{source.last_signal_count}</TableCell>
                      <TableCell>{source.last_alert_count}</TableCell>
                      <TableCell><Badge variant={source.coverage_status === "error" ? "destructive" : source.coverage_status === "not_scanned" ? "secondary" : "default"}>{titleCase(source.coverage_status)}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(source.last_scanned_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
                      <TableCell className="max-w-[560px]"><div className="text-sm">{scenario.description}</div><div className="mt-1 text-xs text-muted-foreground">Expected: {scenario.expected_result}</div></TableCell>
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
                    <div className="flex items-start gap-2"><GateIcon status={gate.gate_status} /><div><div className="font-medium">{gate.gate_title}</div><div className="text-xs text-muted-foreground">{titleCase(gate.gate_group)}</div></div></div>
                    <Badge variant={statusVariant(gate.gate_status)}>{titleCase(gate.gate_status)}</Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{gate.gate_description}</p>
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
                          {isAdmin && <SelectItem value="waived">Waive with documented authority</SelectItem>}
                        </SelectContent>
                      </Select>
                      <Textarea value={gateNotes} onChange={(event) => setGateNotes(event.target.value)} placeholder="Review findings, threshold concerns, and false-positive assessment" />
                      <Input value={gateEvidenceReference} onChange={(event) => setGateEvidenceReference(event.target.value)} placeholder="Evidence or controlled document reference" />
                      <Button size="sm" disabled={mutationPending} onClick={() => submitGateReview(gate)}>Record Review</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Alert>
              <Clock3 className="h-4 w-4" />
              <AlertTitle>Protected continuous schedule</AlertTitle>
              <AlertDescription>
                Job {dashboard.schedule_job_id || "not recorded"} runs on <code>{dashboard.schedule_expression || "not recorded"}</code>.
                The job invokes a database-only monitoring function, uses a concurrency lock, performs no external connector call,
                and preserves zero authoritative source mutations.
              </AlertDescription>
            </Alert>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Run</TableHead><TableHead>Mode</TableHead><TableHead>Status</TableHead><TableHead>Signals</TableHead><TableHead>Created</TableHead><TableHead>Deduplicated</TableHead><TableHead>Resolved</TableHead><TableHead>Escalated</TableHead><TableHead>Integrity</TableHead><TableHead>Completed</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.scans.map((scan) => (
                    <TableRow key={scan.id}>
                      <TableCell className="max-w-[220px]"><div className="font-mono text-xs">{scan.run_key}</div><div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{scan.summary}</div></TableCell>
                      <TableCell><Badge variant="outline">{titleCase(scan.run_mode)}</Badge></TableCell>
                      <TableCell><Badge variant={statusVariant(scan.status)}>{titleCase(scan.status)}</Badge></TableCell>
                      <TableCell>{scan.signal_count}</TableCell>
                      <TableCell>{scan.alerts_created}</TableCell>
                      <TableCell>{scan.alerts_deduplicated}</TableCell>
                      <TableCell>{scan.alerts_auto_resolved}</TableCell>
                      <TableCell>{scan.alerts_escalated}</TableCell>
                      <TableCell><div className="text-xs">External: {scan.external_side_effect_count}</div><div className="text-xs">Source writes: {scan.authoritative_mutation_count}</div></TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(scan.completed_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="controls" className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Active suppressions" value={dashboard.active_suppression_count} />
              <Metric label="Pending escalations" value={dashboard.pending_escalation_count} />
              <Metric label="Snoozed alerts" value={dashboard.snoozed_alert_count} />
              <Metric label="Escalated alerts" value={dashboard.escalated_alert_count} />
            </div>
            <Alert>
              <TimerReset className="h-4 w-4" />
              <AlertTitle>Suppression is not deletion</AlertTitle>
              <AlertDescription>
                Every snooze creates a bounded, human-authorized suppression record. Signals remain preserved,
                and the condition can reopen when the suppression expires or the risk returns.
              </AlertDescription>
            </Alert>
            {data.suppressions.length === 0 ? (
              <EmptyState icon={<TimerReset className="h-5 w-5" />} text="No production alert suppressions have been recorded." />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Rule</TableHead><TableHead>Scope</TableHead><TableHead>Reason</TableHead><TableHead>Authorized by</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.suppressions.map((suppression) => (
                      <TableRow key={suppression.id}>
                        <TableCell className="font-mono text-xs">{suppression.suppression_reference}</TableCell>
                        <TableCell>{suppression.rule_title || suppression.rule_key || "Scoped suppression"}</TableCell>
                        <TableCell><div className="text-sm">{titleCase(suppression.entity_type)}</div><div className="font-mono text-xs text-muted-foreground">{suppression.entity_id || suppression.aggregation_key || "Rule-wide"}</div></TableCell>
                        <TableCell className="max-w-[380px] text-sm">{suppression.reason}</TableCell>
                        <TableCell>{suppression.authorized_by_name || suppression.authorized_by_user_id}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{formatDate(suppression.starts_at)}<br />to {formatDate(suppression.ends_at)}</TableCell>
                        <TableCell><Badge variant={statusVariant(suppression.status)}>{titleCase(suppression.status)}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {data.escalations.length > 0 && (
              <div>
                <h3 className="mb-3 font-semibold">Internal Escalation Queue</h3>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader><TableRow><TableHead>Alert</TableHead><TableHead>Level</TableHead><TableHead>Route</TableHead><TableHead>Human role</TableHead><TableHead>Reason</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.escalations.map((escalation) => (
                        <TableRow key={escalation.id}>
                          <TableCell><div className="font-mono text-xs">{escalation.alert_reference}</div><div className="font-medium">{escalation.alert_title}</div></TableCell>
                          <TableCell>{escalation.escalation_level}</TableCell>
                          <TableCell>{escalation.from_agent_name || escalation.from_agent_key} → {escalation.to_agent_name || escalation.to_agent_key || "Human authority"}</TableCell>
                          <TableCell>{escalation.to_role}</TableCell>
                          <TableCell className="max-w-[400px] text-sm">{escalation.reason}</TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{formatDate(escalation.due_at)}</TableCell>
                          <TableCell><Badge variant={statusVariant(escalation.status)}>{titleCase(escalation.status)}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Coordinator: {dashboard.coordinator_agent_name || dashboard.coordinator_agent_key} · Source: {dashboard.authoritative_source.replace(/_/g, " ")}
          </div>
          <div className="text-muted-foreground">
            Last scan: {formatDate(dashboard.last_scan_at)} · Next scan: {formatDate(dashboard.next_scheduled_scan_at)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertReviewCard({
  alert,
  canManage,
  mutationPending,
  acknowledgementNotes,
  setAcknowledgementNotes,
  snoozeUntil,
  setSnoozeUntil,
  snoozeReason,
  setSnoozeReason,
  resolutionSummary,
  setResolutionSummary,
  resolutionEvidence,
  setResolutionEvidence,
  dismissalReason,
  setDismissalReason,
  submitAcknowledgement,
  submitSnooze,
  submitResolution,
  submitDismissal,
}: {
  alert: Phase5Alert;
  canManage: boolean;
  mutationPending: boolean;
  acknowledgementNotes: string;
  setAcknowledgementNotes: (value: string) => void;
  snoozeUntil: string;
  setSnoozeUntil: (value: string) => void;
  snoozeReason: string;
  setSnoozeReason: (value: string) => void;
  resolutionSummary: string;
  setResolutionSummary: (value: string) => void;
  resolutionEvidence: string;
  setResolutionEvidence: (value: string) => void;
  dismissalReason: string;
  setDismissalReason: (value: string) => void;
  submitAcknowledgement: () => void;
  submitSnooze: () => void;
  submitResolution: () => void;
  submitDismissal: () => void;
}) {
  const active = ["open", "acknowledged", "snoozed", "escalated", "suppressed"].includes(alert.status);
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-start justify-between gap-3 text-base">
          <span>{alert.alert_reference} — {alert.title}</span>
          <div className="flex gap-2">
            <Badge variant={statusVariant(alert.severity_key)}>{titleCase(alert.severity_key)}</Badge>
            <Badge variant={statusVariant(alert.status)}>{titleCase(alert.status)}</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Detail label="Human authority" value={alert.accountable_human_role} />
          <Detail label="Agent owner" value={alert.owner_agent_name || alert.owner_agent_key || "Not assigned"} />
          <Detail label="Response due" value={formatDate(alert.response_due_at)} />
          <Detail label="Escalation due" value={formatDate(alert.escalation_due_at)} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Detail label="Required response" value={alert.required_response} />
          <Detail label="Evidence source" value={`${alert.source_table}${alert.source_record_id ? ` · ${alert.source_record_id}` : ""}`} />
        </div>
        <div className="rounded-lg border bg-muted/10 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Latest signal evidence</div>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(alert.signal_value || alert.evidence_snapshot || {}, null, 2)}</pre>
        </div>

        <Tabs defaultValue="acknowledge" className="space-y-3">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-4">
            <TabsTrigger value="acknowledge">Acknowledge</TabsTrigger>
            <TabsTrigger value="snooze">Snooze</TabsTrigger>
            <TabsTrigger value="resolve">Resolve</TabsTrigger>
            <TabsTrigger value="dismiss">Dismiss</TabsTrigger>
          </TabsList>
          <TabsContent value="acknowledge" className="space-y-3 rounded-lg border p-4">
            <Textarea value={acknowledgementNotes} onChange={(event) => setAcknowledgementNotes(event.target.value)} placeholder="Name the responsible human response, immediate review, and expected next step" />
            <Button disabled={mutationPending || !["open", "snoozed", "escalated"].includes(alert.status)} onClick={submitAcknowledgement}>
              <ShieldAlert className="mr-2 h-4 w-4" /> Acknowledge Alert
            </Button>
          </TabsContent>
          <TabsContent value="snooze" className="space-y-3 rounded-lg border p-4">
            <Field label="Suppress until">
              <Input type="datetime-local" value={snoozeUntil} onChange={(event) => setSnoozeUntil(event.target.value)} />
            </Field>
            <Textarea value={snoozeReason} onChange={(event) => setSnoozeReason(event.target.value)} placeholder="Explain why the condition is temporarily accepted, what is being reviewed, and why the suppression end time is appropriate" />
            <Button variant="outline" disabled={mutationPending || !canManage || !["open", "acknowledged", "escalated"].includes(alert.status)} onClick={submitSnooze}>
              <TimerReset className="mr-2 h-4 w-4" /> Create Bounded Snooze
            </Button>
            {!canManage && <p className="text-xs text-muted-foreground">Management authority is required to create a suppression.</p>}
          </TabsContent>
          <TabsContent value="resolve" className="space-y-3 rounded-lg border p-4">
            <Textarea value={resolutionSummary} onChange={(event) => setResolutionSummary(event.target.value)} placeholder="Describe the corrective action, verification performed, and why the risk is closed" />
            <Input value={resolutionEvidence} onChange={(event) => setResolutionEvidence(event.target.value)} placeholder="Resolution evidence reference or controlled document URL" />
            <Button disabled={mutationPending || !active} onClick={submitResolution}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Resolve with Evidence
            </Button>
          </TabsContent>
          <TabsContent value="dismiss" className="space-y-3 rounded-lg border p-4">
            <Textarea value={dismissalReason} onChange={(event) => setDismissalReason(event.target.value)} placeholder="Explain why this alert is a false positive, duplicate context, or non-actionable condition" />
            <Button variant="destructive" disabled={mutationPending || !canManage || !active} onClick={submitDismissal}>
              <XCircle className="mr-2 h-4 w-4" /> Dismiss with Audit Reason
            </Button>
            {!canManage && <p className="text-xs text-muted-foreground">Management authority is required to dismiss an alert.</p>}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

const categories = ["compliance", "financial", "grant", "governance", "operational"];
const severityKeys = ["informational", "watch", "action_required", "high_risk", "critical"];
const alertStatuses = ["open", "acknowledged", "snoozed", "escalated", "resolved", "dismissed", "suppressed"];

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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function ThresholdValue({ label, value }: { label: string; value: number | null }) {
  return <div className="rounded border bg-muted/20 p-2"><div className="text-muted-foreground">{label}</div><div className="font-medium">{value ?? "Rule-specific"}</div></div>;
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-5 py-10 text-sm text-muted-foreground">{icon} {text}</div>;
}

function GateIcon({ status }: { status: string }) {
  if (status === "passed" || status === "waived") return <CheckCircle2 className="mt-0.5 h-4 w-4" />;
  if (status === "failed") return <XCircle className="mt-0.5 h-4 w-4 text-destructive" />;
  return <CircleDashed className="mt-0.5 h-4 w-4 text-muted-foreground" />;
}
