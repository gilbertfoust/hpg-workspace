import { format } from "date-fns";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  FileCheck2,
  LockKeyhole,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  useNiaPilot,
  useRefreshNiaCases,
  useRunNiaCaseQueue,
  useRunNiaScenarioSuite,
  type NiaPilotCase,
} from "@/hooks/useNiaPilot";

const titleCase = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (["failed", "blocked", "high", "elevated"].includes(status)) return "destructive";
  if (["pending", "pending_review", "moderate", "insufficient_information", "running"].includes(status)) return "secondary";
  if (["passed", "validated", "active", "pilot", "low", "completed"].includes(status)) return "default";
  return "outline";
};

const formatDate = (value: string | null) => (value ? format(new Date(value), "MMM d, yyyy h:mm a") : "Not recorded");

export function NiaPilotPanel() {
  const { toast } = useToast();
  const pilot = useNiaPilot();
  const refreshCases = useRefreshNiaCases();
  const runQueue = useRunNiaCaseQueue();
  const runSuite = useRunNiaScenarioSuite();

  if (pilot.isLoading) return <Skeleton className="h-[520px] w-full" />;

  if (pilot.error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Nia pilot could not be loaded</AlertTitle>
        <AlertDescription>{pilot.error instanceof Error ? pilot.error.message : "The controlled pilot is unavailable."}</AlertDescription>
      </Alert>
    );
  }

  if (pilot.data && !pilot.data.runtimeReady) {
    return (
      <Alert>
        <Workflow className="h-4 w-4" />
        <AlertTitle>Phase 2 runtime pending</AlertTitle>
        <AlertDescription>{pilot.data.runtimeMessage}</AlertDescription>
      </Alert>
    );
  }

  const data = pilot.data;
  const dashboard = data?.dashboard;
  if (!dashboard) return null;

  const runAction = async (
    action: typeof refreshCases | typeof runQueue | typeof runSuite,
    successTitle: string,
  ) => {
    try {
      const result = await action.mutateAsync();
      toast({ title: successTitle, description: JSON.stringify(result) });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Controlled action failed",
        description: error instanceof Error ? error.message : "The Agent OS action could not be completed.",
      });
    }
  };

  const mutationPending = refreshCases.isPending || runQueue.isPending || runSuite.isPending;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Bot className="h-5 w-5" /> Nia Okafor — Controlled Phase 2 Pilot
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {dashboard.title} · reports to {dashboard.supervisor_agent_name || dashboard.reports_to_agent_key}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={statusVariant(dashboard.pilot_status)}>{titleCase(dashboard.pilot_status)}</Badge>
              <Badge variant="outline">Manifest {dashboard.current_manifest_version}</Badge>
              <Badge variant="outline">{dashboard.enabled_trigger_count} controlled triggers</Badge>
              <Badge variant="destructive" className="gap-1">
                <LockKeyhole className="h-3 w-3" /> External actions disabled
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={mutationPending}
              onClick={() => runAction(refreshCases, "Controlled case registry refreshed")}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Refresh Cases
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={mutationPending}
              onClick={() => runAction(runQueue, "Nia case queue evaluated")}
            >
              <PlayCircle className="mr-2 h-4 w-4" /> Run Case Queue
            </Button>
            <Button size="sm" disabled={mutationPending} onClick={() => runAction(runSuite, "Nia QA suite completed")}>
              <ClipboardCheck className="mr-2 h-4 w-4" /> Run QA Suite
            </Button>
          </div>
        </div>

        <Alert className="border-warning/40 bg-warning/5">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Human-supervised pilot boundary</AlertTitle>
          <AlertDescription>
            Nia may classify cases, record evidence, and prepare internal review requests. Gmail delivery, Slack posting,
            Trello writes, financial actions, legal conclusions, signatures, NGO approval, and activation remain blocked.
          </AlertDescription>
        </Alert>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="Controlled cases" value={dashboard.case_count} />
          <Metric label="Pilot runs" value={dashboard.pilot_run_count} />
          <Metric label="Required QA" value={`${dashboard.required_scenario_passed}/${dashboard.required_scenario_total}`} />
          <Metric label="Pending reviews" value={dashboard.pending_review_count} />
          <Metric label="Audit events" value={dashboard.audit_event_count} />
          <Metric label="Gates passed" value={`${dashboard.passed_gate_count}/${dashboard.passed_gate_count + dashboard.pending_gate_count}`} />
        </div>

        <Tabs defaultValue="cases" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-4">
            <TabsTrigger value="cases">Cases</TabsTrigger>
            <TabsTrigger value="qa">QA Scenarios</TabsTrigger>
            <TabsTrigger value="gates">Activation Gates</TabsTrigger>
            <TabsTrigger value="reviews">Human Review</TabsTrigger>
          </TabsList>

          <TabsContent value="cases">
            <CaseTable cases={data?.cases || []} />
          </TabsContent>

          <TabsContent value="qa">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scenario</TableHead>
                    <TableHead>Source Case</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Actual</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Executed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.scenarios || []).map((scenario) => (
                    <TableRow key={scenario.scenario_key}>
                      <TableCell>
                        <div className="font-medium">{scenario.title}</div>
                        <div className="text-xs text-muted-foreground">{scenario.is_required ? "Required" : "Additional control"}</div>
                      </TableCell>
                      <TableCell>{scenario.source_ngo_common_name}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(scenario.expected_risk_level)}>{titleCase(scenario.expected_risk_level)}</Badge>
                      </TableCell>
                      <TableCell>
                        {scenario.result?.actual_risk_level ? (
                          <Badge variant={statusVariant(scenario.result.actual_risk_level)}>{titleCase(scenario.result.actual_risk_level)}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not run</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={scenario.result?.passed ? "default" : scenario.result ? "destructive" : "outline"}>
                          {scenario.result?.passed ? "Passed" : scenario.result ? "Failed" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {scenario.result ? formatDate(scenario.result.executed_at) : "Not run"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="gates">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(data?.gates || []).map((gate) => (
                <div key={gate.gate_key} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-medium">
                      {gate.gate_status === "passed" ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <CircleDashed className="h-4 w-4" />
                      )}
                      {titleCase(gate.gate_key)}
                    </div>
                    <Badge variant={statusVariant(gate.gate_status)}>{titleCase(gate.gate_status)}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{gate.notes || "No note recorded."}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{gate.recorded_at ? `Recorded ${formatDate(gate.recorded_at)}` : "Awaiting authorized evidence"}</p>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="reviews">
            {(data?.reviews || []).length === 0 ? (
              <div className="rounded-lg border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
                No Nia review requests are currently pending.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reviewer</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead>Recommendation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.reviews || []).map((review) => (
                      <TableRow key={review.id}>
                        <TableCell className="font-medium">{review.reviewer_role}</TableCell>
                        <TableCell className="max-w-[340px]">{review.question}</TableCell>
                        <TableCell className="max-w-[420px] text-sm text-muted-foreground">{review.recommendation || "No recommendation recorded"}</TableCell>
                        <TableCell><Badge variant="secondary">{titleCase(review.status)}</Badge></TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(review.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4" />
            Configuration: {titleCase(dashboard.configuration_sync_status)} · accountable role: {dashboard.accountable_human_role}
          </div>
          <div className="text-muted-foreground">
            Last queue run: {formatDate(dashboard.last_case_queue_run_at)} · Last QA: {formatDate(dashboard.last_suite_at)}
          </div>
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

function CaseTable({ cases }: { cases: NiaPilotCase[] }) {
  if (cases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
        No Program coordination profiles are currently registered in the pilot queue.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>NGO</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Risk</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead>Next Action</TableHead>
            <TableHead>Review</TableHead>
            <TableHead>Last Run</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-xs font-medium">{item.reference_number}</TableCell>
              <TableCell>
                <div className="font-medium">{item.organization_name || "Unidentified NGO"}</div>
                <div className="text-xs text-muted-foreground">{item.applicant_country || "Country not recorded"}</div>
              </TableCell>
              <TableCell><Badge variant="outline">{titleCase(item.workflow_stage)}</Badge></TableCell>
              <TableCell><Badge variant={statusVariant(item.risk_level)}>{titleCase(item.risk_level)}</Badge></TableCell>
              <TableCell><Badge variant={item.match_confidence === "low" ? "destructive" : "outline"}>{titleCase(item.match_confidence)}</Badge></TableCell>
              <TableCell className="max-w-[360px]">
                <p className="line-clamp-2">{item.next_action || item.unmatched_reason || "No next action recorded"}</p>
                {item.due_at && <p className="mt-1 text-xs text-muted-foreground">Due {formatDate(item.due_at)}</p>}
              </TableCell>
              <TableCell>
                <Badge variant={item.pending_review_count > 0 ? "secondary" : "outline"}>
                  {item.pending_review_count > 0 ? `${item.pending_review_count} pending` : "Not required"}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(item.latest_run_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
