import { useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FileCheck2,
  GitBranch,
  Handshake,
  LockKeyhole,
  PlayCircle,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  Users,
  Workflow,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { isAdminRole, useUserRole } from "@/hooks/useUserRole";
import {
  usePhase3Sponsorship,
  useRecordPhase3GateReview,
  useRefreshPhase3ShadowCases,
  useRunPhase3Validation,
  type Phase3HumanGate,
} from "@/hooks/usePhase3Sponsorship";

const titleCase = (value: string | null | undefined) =>
  (value || "Not recorded").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusVariant = (status: string | null | undefined): "default" | "secondary" | "destructive" | "outline" => {
  if (["failed", "blocked", "high", "elevated", "paused"].includes(status || "")) return "destructive";
  if (["pending", "waiting_human", "pending_review", "moderate", "validating", "ready_for_human_review"].includes(status || "")) return "secondary";
  if (["passed", "validated", "active", "pilot", "low", "completed", "shadow"].includes(status || "")) return "default";
  return "outline";
};

const formatDate = (value: string | null | undefined, dateOnly = false) => {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, dateOnly ? "MMM d, yyyy" : "MMM d, yyyy h:mm a");
};

export function Phase3SponsorshipPanel() {
  const { toast } = useToast();
  const { data: userRole } = useUserRole();
  const phase3 = usePhase3Sponsorship();
  const refreshShadow = useRefreshPhase3ShadowCases();
  const runValidation = useRunPhase3Validation();
  const recordGate = useRecordPhase3GateReview();
  const [search, setSearch] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [evidenceReferences, setEvidenceReferences] = useState<Record<string, string>>({});

  const isAdmin = isAdminRole(userRole?.role);

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return phase3.data?.cases || [];
    return (phase3.data?.cases || []).filter((item) =>
      [
        item.common_name,
        item.legal_name,
        item.country,
        item.profile_reference,
        item.hpg_profile_number,
        item.source_stage_name,
        item.control_stage_name,
        item.assigned_agent_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [phase3.data?.cases, search]);

  if (phase3.isLoading) return <Skeleton className="h-[680px] w-full" />;

  if (phase3.error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Phase 3 could not be loaded</AlertTitle>
        <AlertDescription>
          {phase3.error instanceof Error ? phase3.error.message : "The sponsorship orchestration runtime is unavailable."}
        </AlertDescription>
      </Alert>
    );
  }

  if (phase3.data && !phase3.data.runtimeReady) {
    return (
      <Alert>
        <Workflow className="h-4 w-4" />
        <AlertTitle>Phase 3 runtime pending</AlertTitle>
        <AlertDescription>{phase3.data.runtimeMessage}</AlertDescription>
      </Alert>
    );
  }

  const data = phase3.data;
  const dashboard = data?.dashboard;
  if (!dashboard) return null;

  const runControlledAction = async (
    action: typeof refreshShadow | typeof runValidation,
    successTitle: string,
  ) => {
    try {
      const result = await action.mutateAsync();
      toast({ title: successTitle, description: JSON.stringify(result) });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Controlled action failed",
        description: error instanceof Error ? error.message : "The Phase 3 action could not be completed.",
      });
    }
  };

  const submitGateReview = async (
    gate: Phase3HumanGate,
    status: "passed" | "failed" | "waived",
  ) => {
    const notes = reviewNotes[gate.gate_key]?.trim() || "";
    const evidenceReference = evidenceReferences[gate.gate_key]?.trim() || "";
    if (notes.length < 10 || !evidenceReference) {
      toast({
        variant: "destructive",
        title: "Evidence and review notes required",
        description: "Provide an evidence reference and at least ten characters of review notes before recording a decision.",
      });
      return;
    }

    try {
      const result = await recordGate.mutateAsync({
        gateKey: gate.gate_key,
        status,
        notes,
        evidenceReference,
      });
      toast({ title: `${gate.gate_title} recorded`, description: JSON.stringify(result) });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Gate review not recorded",
        description: error instanceof Error ? error.message : "The current user may not be authorized for this gate.",
      });
    }
  };

  const mutationPending = refreshShadow.isPending || runValidation.isPending || recordGate.isPending;

  return (
    <Card id="phase-3">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Handshake className="h-5 w-5" /> Phase 3 — Fiscal Sponsorship Orchestration
            </CardTitle>
            <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
              One governed pathway from Development intake through Program, Finance, General Counsel, executive and Board review,
              agreement controls, activation, and NGO Coordination handoff.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={statusVariant(dashboard.workflow_status)}>{titleCase(dashboard.workflow_status)}</Badge>
              <Badge variant="outline">Version {dashboard.workflow_version}</Badge>
              <Badge variant="outline">{dashboard.stage_count} control stages</Badge>
              <Badge variant="outline">{dashboard.operating_mode.replace(/_/g, " ")}</Badge>
              <Badge variant="destructive" className="gap-1">
                <LockKeyhole className="h-3 w-3" /> External actions disabled
              </Badge>
            </div>
          </div>

          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={mutationPending}
                onClick={() => runControlledAction(refreshShadow, "Sponsorship shadow registry refreshed")}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Refresh Shadow Cases
              </Button>
              <Button
                size="sm"
                disabled={mutationPending}
                onClick={() => runControlledAction(runValidation, "Phase 3 validation completed")}
              >
                <PlayCircle className="mr-2 h-4 w-4" /> Run Eight-Scenario Suite
              </Button>
            </div>
          )}
        </div>

        <Alert className="border-warning/40 bg-warning/5">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Shadow and dry-run boundary</AlertTitle>
          <AlertDescription>
            The portfolio is mapped from the authoritative FSA workflow, but this layer cannot advance a live NGO, send correspondence,
            approve sponsorship, alter an agreement, verify a payment, sign a document, issue a confirmation letter, or complete activation.
          </AlertDescription>
        </Alert>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Metric label="Portfolio mapped" value={dashboard.shadow_assignment_count} />
          <Metric label="Required scenarios" value={`${dashboard.latest_passed_scenario_count || 0}/${dashboard.required_scenario_count}`} />
          <Metric label="Assertions" value={dashboard.latest_assertion_count || 0} />
          <Metric label="Stage runs" value={dashboard.latest_stage_run_count} />
          <Metric label="Handoffs" value={dashboard.latest_handoff_count} />
          <Metric label="Gates passed" value={`${dashboard.passed_gate_count}/${dashboard.required_gate_count}`} />
          <Metric label="Human gates" value={dashboard.human_gates_pending} />
          <Metric label="External effects" value={dashboard.latest_external_side_effect_count || 0} />
        </div>

        <Tabs defaultValue="pipeline" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="scenarios">Validation</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="governance">Governance</TabsTrigger>
            <TabsTrigger value="handoffs">Handoffs</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Control Stage</TableHead>
                    <TableHead>Agent Owner</TableHead>
                    <TableHead>Human Authority</TableHead>
                    <TableHead>Decision Class</TableHead>
                    <TableHead>Portfolio</TableHead>
                    <TableHead>Latest Runs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.stages || []).map((stage) => (
                    <TableRow key={stage.stage_key}>
                      <TableCell className="font-mono text-xs">{stage.stage_order}</TableCell>
                      <TableCell>
                        <div className="font-medium">{stage.stage_name}</div>
                        <div className="text-xs text-muted-foreground">{stage.department_name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{stage.owner_agent_name}</div>
                        <div className="text-xs text-muted-foreground">Reports to {stage.supervisor_agent_name || "executive authority"}</div>
                      </TableCell>
                      <TableCell className="max-w-[260px] text-sm">{stage.human_authority_role}</TableCell>
                      <TableCell><Badge variant="outline">{titleCase(stage.decision_class)}</Badge></TableCell>
                      <TableCell>{stage.shadow_assignment_count}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="default">{stage.latest_validated_run_count} validated</Badge>
                          {stage.latest_held_run_count > 0 && <Badge variant="secondary">{stage.latest_held_run_count} held</Badge>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="scenarios">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scenario</TableHead>
                    <TableHead>Expected Stop</TableHead>
                    <TableHead>Assertions</TableHead>
                    <TableHead>Stage Runs</TableHead>
                    <TableHead>Handoffs</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.scenarios || []).map((scenario) => (
                    <TableRow key={scenario.scenario_key}>
                      <TableCell>
                        <div className="font-medium">{scenario.title}</div>
                        <div className="text-xs text-muted-foreground">{titleCase(scenario.scenario_type)}</div>
                      </TableCell>
                      <TableCell>
                        <div>{scenario.expected_stop_stage_name}</div>
                        {scenario.expected_human_gate && <Badge variant="secondary" className="mt-1">Human gate</Badge>}
                      </TableCell>
                      <TableCell>{scenario.passed_assertion_count}/{scenario.assertion_count}</TableCell>
                      <TableCell>{scenario.stage_run_count}</TableCell>
                      <TableCell>{scenario.handoff_count}</TableCell>
                      <TableCell>
                        <Badge variant={scenario.passed ? "default" : "destructive"}>
                          {scenario.passed ? "Passed" : "Failed"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-4 w-4" /> {dashboard.latest_validation_summary || "No validation summary recorded."}
              </div>
              <div className="text-muted-foreground">Completed {formatDate(dashboard.latest_validation_completed_at)}</div>
            </div>
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-3">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search NGO, country, stage, reference, or agent" className="pl-9" />
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NGO</TableHead>
                    <TableHead>Authoritative FSA Stage</TableHead>
                    <TableHead>Control Stage</TableHead>
                    <TableHead>Assigned Agent</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Evidence</TableHead>
                    <TableHead>Next Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCases.map((item) => (
                    <TableRow key={item.source_profile_id}>
                      <TableCell>
                        <div className="font-medium">{item.common_name || item.legal_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[item.city, item.state_province, item.country].filter(Boolean).join(", ") || "Location not recorded"}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-muted-foreground">{item.profile_reference}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.source_stage_name}</Badge>
                        <div className="mt-1 text-xs text-muted-foreground">Revision {item.source_revision}</div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{item.control_stage_name}</Badge></TableCell>
                      <TableCell>
                        <div className="font-medium">{item.assigned_agent_name}</div>
                        <div className="text-xs text-muted-foreground">{item.assigned_agent_title}</div>
                      </TableCell>
                      <TableCell><Badge variant={statusVariant(item.risk_level)}>{titleCase(item.risk_level)}</Badge></TableCell>
                      <TableCell>
                        {item.evidence_reconstruction_required ? (
                          <Badge variant="secondary">Reconstruction required</Badge>
                        ) : (
                          <Badge variant="outline">Current record</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[380px]">
                        <p className="line-clamp-2">{item.next_action || "No next action recorded"}</p>
                        {item.due_at && <p className="mt-1 text-xs text-muted-foreground">Due {formatDate(item.due_at)}</p>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="governance">
            <div className="grid gap-4 xl:grid-cols-2">
              {(data?.gates || []).map((gate) => (
                <div key={gate.gate_key} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-medium">
                        {gate.gate_status === "passed" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : gate.gate_status === "failed" ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <CircleDashed className="h-4 w-4" />
                        )}
                        {gate.gate_title}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{gate.gate_description}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Required reviewer: {gate.required_reviewer_role || "Authorized HPG reviewer"}</p>
                    </div>
                    <Badge variant={statusVariant(gate.gate_status)}>{titleCase(gate.gate_status)}</Badge>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Input
                      value={evidenceReferences[gate.gate_key] || ""}
                      onChange={(event) => setEvidenceReferences((current) => ({ ...current, [gate.gate_key]: event.target.value }))}
                      placeholder="Evidence URL or document reference"
                    />
                    <Textarea
                      value={reviewNotes[gate.gate_key] || ""}
                      onChange={(event) => setReviewNotes((current) => ({ ...current, [gate.gate_key]: event.target.value }))}
                      placeholder="Review findings and decision rationale"
                      className="min-h-[76px]"
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-muted-foreground">
                      Work item: {gate.work_item_status || "Not linked"} · Due {formatDate(gate.work_item_due_date, true)}
                    </div>
                    {gate.gate_status === "pending" && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={mutationPending} onClick={() => submitGateReview(gate, "failed")}>Fail</Button>
                        {isAdmin && <Button size="sm" variant="outline" disabled={mutationPending} onClick={() => submitGateReview(gate, "waived")}>Waive</Button>}
                        <Button size="sm" disabled={mutationPending} onClick={() => submitGateReview(gate, "passed")}>Pass</Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="handoffs">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scenario</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead></TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Agents</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Packet Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.handoffs || []).map((handoff) => (
                    <TableRow key={handoff.id}>
                      <TableCell className="font-medium">{titleCase(handoff.scenario_key.replace("phase3-", ""))}</TableCell>
                      <TableCell>{handoff.from_stage_name}</TableCell>
                      <TableCell><Route className="h-4 w-4 text-muted-foreground" /></TableCell>
                      <TableCell>{handoff.to_stage_name}</TableCell>
                      <TableCell>
                        <div className="text-sm">{handoff.from_agent_name}</div>
                        <div className="text-xs text-muted-foreground">to {handoff.to_agent_name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(handoff.status)}>{titleCase(handoff.status)}</Badge>
                        {handoff.acceptance_required && <div className="mt-1 text-xs text-muted-foreground">Acceptance required</div>}
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">{handoff.packet_sha256.slice(0, 12)}…</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid gap-3 md:grid-cols-3">
          <FooterFact icon={<Workflow className="h-4 w-4" />} label="Authoritative source" value={dashboard.authoritative_source} />
          <FooterFact icon={<GitBranch className="h-4 w-4" />} label="Fingerprint unchanged" value={dashboard.latest_authoritative_unchanged ? "Verified" : "Not verified"} />
          <FooterFact icon={<Users className="h-4 w-4" />} label="Human decisions pending" value={String(dashboard.human_gates_pending)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function FooterFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
      {icon}
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
