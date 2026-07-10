import { format } from "date-fns";
import { AlertTriangle, Bot, Mail, RefreshCw, Workflow } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AgentOSOperationsResult } from "@/hooks/useAgentOSOperations";

interface AgentOSOperationsPanelProps {
  data?: AgentOSOperationsResult;
  isLoading: boolean;
}

const titleCase = (value: string) =>
  value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (["failed", "blocked", "cancelled"].includes(status)) return "destructive";
  if (["pending_review", "processing", "running"].includes(status)) return "secondary";
  if (["completed", "sent", "approved"].includes(status)) return "default";
  return "outline";
};

export function AgentOSOperationsPanel({ data, isLoading }: AgentOSOperationsPanelProps) {
  if (isLoading) return <Skeleton className="h-72 w-full" />;

  if (data && !data.runtimeReady) {
    return (
      <Alert className="border-warning/40 bg-warning/5">
        <Workflow className="h-4 w-4" />
        <AlertTitle>Operational queues pending deployment</AlertTitle>
        <AlertDescription>{data.runtimeMessage}</AlertDescription>
      </Alert>
    );
  }

  const runs = data?.agentRuns || [];
  const communications = data?.communications || [];
  const trelloSync = data?.trelloSync || [];

  const failedRuns = runs.filter((item) => item.status === "failed").length;
  const pendingReview = communications.filter(
    (item) => item.requires_human_review && ["pending", "pending_review"].includes(item.status),
  ).length;
  const failedSync = trelloSync.filter((item) => ["failed", "blocked"].includes(item.status)).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Workflow className="h-5 w-5" /> Agent OS Operations Console
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Agent runs, controlled communications, human-review gates, and Trello synchronization activity.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={failedRuns ? "destructive" : "outline"}>{failedRuns} failed runs</Badge>
            <Badge variant={pendingReview ? "secondary" : "outline"}>{pendingReview} awaiting review</Badge>
            <Badge variant={failedSync ? "destructive" : "outline"}>{failedSync} sync failures</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="runs" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="runs"><Bot className="mr-2 h-4 w-4" />Agent Runs</TabsTrigger>
            <TabsTrigger value="communications"><Mail className="mr-2 h-4 w-4" />Communications</TabsTrigger>
            <TabsTrigger value="trello"><RefreshCw className="mr-2 h-4 w-4" />Trello Sync</TabsTrigger>
          </TabsList>

          <TabsContent value="runs">
            {runs.length === 0 ? (
              <EmptyState message="No agent runs have been recorded yet." />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Agent</TableHead><TableHead>Trigger</TableHead><TableHead>Status</TableHead><TableHead>Confidence</TableHead><TableHead>Action / Result</TableHead><TableHead>Started</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {runs.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell><div className="font-medium">{item.agent_name}</div><div className="text-xs text-muted-foreground">{item.agent_role || "Agent"}</div></TableCell>
                        <TableCell>{titleCase(item.trigger_type)}</TableCell>
                        <TableCell><Badge variant={statusVariant(item.status)}>{titleCase(item.status)}</Badge></TableCell>
                        <TableCell><Badge variant={item.confidence === "low" ? "destructive" : "outline"}>{titleCase(item.confidence)}</Badge></TableCell>
                        <TableCell className="max-w-[360px]"><p className="truncate">{item.error_detail || item.result_summary || item.action_attempted || "No summary recorded"}</p>{item.retry_count > 0 && <p className="text-xs text-muted-foreground">Retries: {item.retry_count}</p>}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{format(new Date(item.started_at), "MMM d, h:mm a")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="communications">
            {communications.length === 0 ? (
              <EmptyState message="No communications are currently queued." />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Recipient</TableHead><TableHead>Authority</TableHead><TableHead>Status</TableHead><TableHead>Subject</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {communications.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{titleCase(item.communication_type)}</TableCell>
                        <TableCell><div className="font-medium">{item.recipient_name || "Unspecified"}</div><div className="text-xs text-muted-foreground">{item.recipient_address || "No address"}</div></TableCell>
                        <TableCell><Badge variant={item.authority_level === "human_only" ? "destructive" : item.authority_level === "draft_for_review" ? "secondary" : "outline"}>{titleCase(item.authority_level)}</Badge></TableCell>
                        <TableCell><Badge variant={statusVariant(item.status)}>{titleCase(item.status)}</Badge></TableCell>
                        <TableCell className="max-w-[360px]"><p className="truncate">{item.error_message || item.subject || "No subject"}</p></TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{format(new Date(item.created_at), "MMM d, h:mm a")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="trello">
            {trelloSync.length === 0 ? (
              <EmptyState message="No Trello synchronization events are currently queued." />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Entity</TableHead><TableHead>Operation</TableHead><TableHead>Direction</TableHead><TableHead>Status</TableHead><TableHead>Attempts</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {trelloSync.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell><div className="font-medium">{titleCase(item.entity_type)}</div><div className="font-mono text-xs text-muted-foreground">{item.entity_id}</div></TableCell>
                        <TableCell>{titleCase(item.operation)}</TableCell>
                        <TableCell>{titleCase(item.direction)}</TableCell>
                        <TableCell><Badge variant={statusVariant(item.status)}>{titleCase(item.status)}</Badge>{item.error_message && <div className="mt-1 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3" />{item.error_message}</div>}</TableCell>
                        <TableCell>{item.attempts}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{format(new Date(item.created_at), "MMM d, h:mm a")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">{message}</div>;
}
