import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Activity, Bot, CheckCircle2, ExternalLink, Search, ShieldCheck, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  usePhase6Command,
  useUpdatePhase6Assignment,
  type Phase6Assignment,
} from "@/hooks/usePhase6Command";

interface DepartmentAgentWorkspacePanelProps {
  moduleKey: string;
  compact?: boolean;
}

const titleCase = (value: string | null | undefined) =>
  (value || "Not recorded").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const badgeVariant = (value: string | null | undefined): "default" | "secondary" | "destructive" | "outline" => {
  if (["critical", "high_risk", "blocked", "declined", "failed", "overdue"].includes(value || "")) return "destructive";
  if (["action_required", "watch", "queued", "acknowledged", "in_progress"].includes(value || "")) return "secondary";
  if (["healthy", "completed", "passed", "active"].includes(value || "")) return "default";
  return "outline";
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : format(parsed, "MMM d, yyyy h:mm a");
};

export function DepartmentAgentWorkspacePanel({ moduleKey, compact = false }: DepartmentAgentWorkspacePanelProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const phase6 = usePhase6Command();
  const updateAssignment = useUpdatePhase6Assignment();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState("acknowledged");
  const [reviewNotes, setReviewNotes] = useState("");

  const department = useMemo(
    () => phase6.data?.departments.find((entry) => entry.module_key === moduleKey) || null,
    [phase6.data?.departments, moduleKey],
  );

  const assignments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (phase6.data?.assignments || []).filter((assignment) => {
      if (assignment.module_key !== moduleKey) return false;
      if (statusFilter === "active" && ["completed", "withdrawn", "superseded"].includes(assignment.assignment_status)) return false;
      if (statusFilter !== "all" && statusFilter !== "active" && assignment.assignment_status !== statusFilter) return false;
      if (!query) return true;
      return [
        assignment.work_title,
        assignment.work_description,
        assignment.assigned_agent_name,
        assignment.assigned_human_name,
        assignment.source_owner_name,
        assignment.ngo_common_name,
        assignment.ngo_legal_name,
        assignment.hpg_reference_number,
        assignment.work_status,
        assignment.work_priority,
        assignment.workflow_stage,
        assignment.next_action,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [phase6.data?.assignments, moduleKey, search, statusFilter]);

  const selectedAssignment = useMemo(
    () => assignments.find((entry) => entry.assignment_id === selectedAssignmentId) || null,
    [assignments, selectedAssignmentId],
  );

  if (phase6.isLoading) return <Skeleton className="h-[420px] w-full" />;
  if (phase6.error || !phase6.data?.runtimeReady || !department) return null;

  const submitReview = async () => {
    if (!selectedAssignment || reviewNotes.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Review notes required",
        description: "Select an assignment and provide at least ten characters describing the human-led response.",
      });
      return;
    }
    try {
      const result = await updateAssignment.mutateAsync({
        assignmentId: selectedAssignment.assignment_id,
        status: reviewStatus,
        notes: reviewNotes.trim(),
      });
      toast({ title: "Agent assignment reviewed", description: JSON.stringify(result) });
      setReviewNotes("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Assignment review failed",
        description: error instanceof Error ? error.message : "The governed assignment action could not be completed.",
      });
    }
  };

  return (
    <Card id="agent-work" className="border-primary/20">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5" /> {department.display_name} Agent Workspace
            </CardTitle>
            <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
              {department.lead_agent_name || department.lead_agent_key} maintains the governed lead-agent queue for this module,
              while source work, approvals, communications, and execution remain under human authority.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={badgeVariant(department.health_status)}>{titleCase(department.health_status)}</Badge>
              <Badge variant="outline">Lead: {department.lead_agent_name || department.lead_agent_key}</Badge>
              <Badge variant="outline">Route: {department.routing_agent_name || department.routing_agent_key || "Not assigned"}</Badge>
              <Badge variant="outline">{department.active_board_count || 0} native boards</Badge>
              <Badge variant="outline">{department.agent_count || 0} configured agents</Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/agent-os")}>
            <ExternalLink className="mr-2 h-4 w-4" /> Executive Command
          </Button>
        </div>
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Agent assignment is advisory, not execution</AlertTitle>
          <AlertDescription>
            This queue identifies which Agent OS role should analyze, organize, or escalate a work item. It does not reassign the
            human owner, close the source item, send a message, approve a record, or perform the underlying work.
          </AlertDescription>
        </Alert>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Metric label="Open work" value={department.open_work_count || 0} />
          <Metric label="Overdue" value={department.overdue_work_count || 0} />
          <Metric label="Due in 7 days" value={department.due_seven_days_count || 0} />
          <Metric label="Unowned" value={department.unowned_work_count || 0} />
          <Metric label="Blocked" value={department.blocked_work_count || 0} />
          <Metric label="Active alerts" value={department.active_alert_count || 0} />
          <Metric label="Capacity" value={`${Math.round(department.capacity_score || 0)}%`} />
          <Metric label="Risk" value={`${Math.round(department.risk_score || 0)}%`} />
        </div>

        {!compact && (
          <div className="grid gap-3 md:grid-cols-3">
            <Detail label="Executive summary" value={department.executive_summary || "No current summary."} />
            <Detail label="Accountable human authority" value={department.accountable_human_role} />
            <Detail
              label="Monitoring state"
              value={`${titleCase(department.trend_direction)} trend · ${Math.round(department.decision_pressure_score || 0)}% decision pressure · ${formatDate(department.as_of)}`}
            />
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search work, NGO, owner, stage, reference, or next action"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active assignments</SelectItem>
              <SelectItem value="all">All assignments</SelectItem>
              <SelectItem value="queued">Queued</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Work item</TableHead>
                <TableHead>Agent and human owner</TableHead>
                <TableHead>Assignment</TableHead>
                <TableHead>Priority and risk</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead className="text-right">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.slice(0, compact ? 12 : 100).map((assignment) => (
                <TableRow key={assignment.assignment_id} className={selectedAssignmentId === assignment.assignment_id ? "bg-muted/40" : undefined}>
                  <TableCell className="max-w-[390px]">
                    <div className="font-medium">{assignment.work_title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{assignment.work_description || assignment.next_action || "No additional description."}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {assignment.ngo_common_name || assignment.ngo_legal_name || assignment.hpg_reference_number || titleCase(assignment.work_type)}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    <div className="text-sm font-medium">{assignment.assigned_agent_name || assignment.assigned_agent_key}</div>
                    <div className="text-xs text-muted-foreground">Human: {assignment.assigned_human_name || assignment.source_owner_name || "Not assigned"}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant(assignment.assignment_status)}>{titleCase(assignment.assignment_status)}</Badge>
                    <div className="mt-1 text-xs text-muted-foreground">Source: {titleCase(assignment.work_status)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">Priority {Math.round(assignment.priority_score)}</div>
                    <div className="text-xs text-muted-foreground">Risk {Math.round(assignment.risk_score)} · {titleCase(assignment.work_priority)}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDate(assignment.work_due_date || assignment.source_due_date)}</TableCell>
                  <TableCell>
                    <div className="text-xs">{assignment.evidence_required ? `Required · ${titleCase(assignment.evidence_status)}` : "Not required"}</div>
                    <div className="mt-1 max-w-[140px] truncate font-mono text-[10px] text-muted-foreground">{assignment.source_snapshot_sha256}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedAssignmentId(assignment.assignment_id)}>Open</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {assignments.length === 0 && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-sm text-muted-foreground">
            <CheckCircle2 className="h-5 w-5" /> No assignments match the current filters.
          </div>
        )}

        {selectedAssignment && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-base">Review assignment — {selectedAssignment.work_title}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-3">
                <Detail label="Agent rationale" value={selectedAssignment.assignment_reason} />
                <Detail label="Next source action" value={selectedAssignment.next_action || "No next action recorded on the source work item."} />
                <div className="rounded-lg border bg-muted/10 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Source snapshot</div>
                  <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(selectedAssignment.source_snapshot, null, 2)}</pre>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border p-4">
                <div className="space-y-2">
                  <Label>Governed assignment status</Label>
                  <Select value={reviewStatus} onValueChange={setReviewStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acknowledged">Acknowledged</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                      <SelectItem value="queued">Return to queue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Human review notes</Label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    placeholder="Record who is reviewing the work, what the agent should analyze, and what remains under human authority"
                  />
                </div>
                <Button disabled={updateAssignment.isPending} onClick={submitReview}>
                  <Users className="mr-2 h-4 w-4" /> Record Assignment Review
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> {assignments.length} assignment{assignments.length === 1 ? "" : "s"} in the current view
          </div>
          <div className="text-muted-foreground">Last command snapshot: {formatDate(department.as_of)}</div>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/10 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
