import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useMakeAutomations,
  useMakeAutomationLogs,
  useCreateMakeAutomation,
  useUpdateMakeAutomation,
  useDeleteMakeAutomation,
  useTriggerMakeAutomation,
  type MakeAutomation,
} from "@/hooks/useMakeAutomations";
import {
  Zap, Plus, Play, Trash2, Settings, Activity, Copy, ExternalLink,
  CheckCircle, XCircle, Clock, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const TRIGGER_EVENTS = [
  { value: "esign.completed", label: "E-Signature Completed" },
  { value: "esign.requested", label: "E-Signature Requested" },
  { value: "document.uploaded", label: "Document Uploaded" },
  { value: "document.approved", label: "Document Approved" },
  { value: "work_item.created", label: "Work Item Created" },
  { value: "work_item.completed", label: "Work Item Completed" },
  { value: "form.submitted", label: "Form Submitted" },
  { value: "ngo.created", label: "NGO Created" },
  { value: "transaction.created", label: "Transaction Created" },
  { value: "intake.approved", label: "Intake Approved" },
  { value: "custom.webhook", label: "Custom Webhook" },
  { value: "manual.trigger", label: "Manual Trigger" },
];

const AUTOMATION_TYPES = [
  { value: "outbound", label: "Outbound (App → Make)" },
  { value: "inbound", label: "Inbound (Make → App)" },
  { value: "bidirectional", label: "Bidirectional" },
];

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "success": return <CheckCircle className="w-4 h-4 text-primary" />;
    case "error": return <XCircle className="w-4 h-4 text-destructive" />;
    case "pending": return <Clock className="w-4 h-4 text-accent-foreground" />;
    default: return <AlertTriangle className="w-4 h-4 text-muted-foreground" />;
  }
}

export default function AutomationsDashboard() {
  const { data: automations, isLoading } = useMakeAutomations();
  const createMutation = useCreateMakeAutomation();
  const updateMutation = useUpdateMakeAutomation();
  const deleteMutation = useDeleteMakeAutomation();
  const triggerMutation = useTriggerMakeAutomation();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<MakeAutomation | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", automation_type: "outbound",
    trigger_event: "manual.trigger", webhook_url: "", webhook_secret: "",
  });

  const resetForm = () => {
    setForm({ name: "", description: "", automation_type: "outbound", trigger_event: "manual.trigger", webhook_url: "", webhook_secret: "" });
  };

  const handleCreate = () => {
    createMutation.mutate(form, { onSuccess: () => { setShowCreate(false); resetForm(); } });
  };

  const webhookInboundUrl = selectedAutomation
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/receive-make-webhook?automation_id=${selectedAutomation.id}${selectedAutomation.webhook_secret ? `&secret=${selectedAutomation.webhook_secret}` : ""}`
    : "";

  const activeCount = automations?.filter(a => a.is_active).length ?? 0;
  const totalTriggers = automations?.reduce((s, a) => s + a.trigger_count, 0) ?? 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Automations</h1>
            <p className="text-muted-foreground">Manage Make.com workflow automations</p>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}><Plus className="w-4 h-4 mr-2" />New Automation</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create Automation</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="E.g. Notify Slack on signature" /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What this automation does..." /></div>
                <div><Label>Type</Label>
                  <Select value={form.automation_type} onValueChange={v => setForm(f => ({ ...f, automation_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AUTOMATION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Trigger Event</Label>
                  <Select value={form.trigger_event} onValueChange={v => setForm(f => ({ ...f, trigger_event: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TRIGGER_EVENTS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {(form.automation_type === "outbound" || form.automation_type === "bidirectional") && (
                  <div><Label>Make.com Webhook URL</Label><Input value={form.webhook_url} onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))} placeholder="https://hook.us1.make.com/..." /></div>
                )}
                {(form.automation_type === "inbound" || form.automation_type === "bidirectional") && (
                  <div><Label>Webhook Secret (optional)</Label><Input value={form.webhook_secret} onChange={e => setForm(f => ({ ...f, webhook_secret: e.target.value }))} placeholder="Shared secret for validation" /></div>
                )}
                <Button onClick={handleCreate} disabled={!form.name || createMutation.isPending} className="w-full">
                  {createMutation.isPending ? "Creating..." : "Create Automation"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2"><CardDescription>Total Automations</CardDescription><CardTitle className="text-3xl">{automations?.length ?? 0}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Active</CardDescription><CardTitle className="text-3xl text-primary">{activeCount}</CardTitle></CardHeader></Card>
          <Card><CardHeader className="pb-2"><CardDescription>Total Triggers</CardDescription><CardTitle className="text-3xl">{totalTriggers}</CardTitle></CardHeader></Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="automations">
          <TabsList>
            <TabsTrigger value="automations"><Zap className="w-4 h-4 mr-1" />Automations</TabsTrigger>
            <TabsTrigger value="logs"><Activity className="w-4 h-4 mr-1" />Activity Log</TabsTrigger>
          </TabsList>

          <TabsContent value="automations">
            {isLoading ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Loading automations...</CardContent></Card>
            ) : !automations?.length ? (
              <Card><CardContent className="py-12 text-center">
                <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No automations yet</h3>
                <p className="text-muted-foreground mb-4">Create your first Make.com automation to get started.</p>
                <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />Create Automation</Button>
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {automations.map(a => (
                  <Card key={a.id} className={!a.is_active ? "opacity-60" : ""}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary" />
                            {a.name}
                          </CardTitle>
                          <CardDescription>{a.description || "No description"}</CardDescription>
                        </div>
                        <Switch
                          checked={a.is_active}
                          onCheckedChange={checked => updateMutation.mutate({ id: a.id, is_active: checked })}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="outline">{AUTOMATION_TYPES.find(t => t.value === a.automation_type)?.label}</Badge>
                        <Badge variant="secondary">{TRIGGER_EVENTS.find(t => t.value === a.trigger_event)?.label ?? a.trigger_event}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        {a.last_triggered_at ? `Last triggered: ${format(new Date(a.last_triggered_at), "MMM d, yyyy h:mm a")}` : "Never triggered"} · {a.trigger_count} runs
                      </div>
                      <div className="flex gap-2">
                        {(a.automation_type === "outbound" || a.automation_type === "bidirectional") && a.webhook_url && (
                          <Button size="sm" variant="default" disabled={triggerMutation.isPending}
                            onClick={() => triggerMutation.mutate({ automationId: a.id })}>
                            <Play className="w-3 h-3 mr-1" />Test
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setSelectedAutomation(a)}>
                          <Settings className="w-3 h-3 mr-1" />Details
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={() => { if (confirm("Delete this automation?")) deleteMutation.mutate(a.id); }}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs">
            <AutomationLogsView automations={automations} />
          </TabsContent>
        </Tabs>

        {/* Detail Dialog */}
        <Dialog open={!!selectedAutomation} onOpenChange={open => { if (!open) setSelectedAutomation(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{selectedAutomation?.name} — Details</DialogTitle></DialogHeader>
            {selectedAutomation && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Type:</span> <Badge variant="outline">{selectedAutomation.automation_type}</Badge></div>
                  <div><span className="text-muted-foreground">Event:</span> <Badge variant="secondary">{selectedAutomation.trigger_event}</Badge></div>
                  <div><span className="text-muted-foreground">Active:</span> {selectedAutomation.is_active ? "Yes" : "No"}</div>
                  <div><span className="text-muted-foreground">Runs:</span> {selectedAutomation.trigger_count}</div>
                </div>

                {selectedAutomation.webhook_url && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Outbound Webhook URL</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input value={selectedAutomation.webhook_url} readOnly className="text-xs font-mono" />
                      <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(selectedAutomation.webhook_url!); toast({ title: "Copied!" }); }}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}

                {(selectedAutomation.automation_type === "inbound" || selectedAutomation.automation_type === "bidirectional") && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Inbound Webhook URL (for Make.com HTTP module)</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input value={webhookInboundUrl} readOnly className="text-xs font-mono" />
                      <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(webhookInboundUrl); toast({ title: "Copied!" }); }}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}

                <AutomationLogsTable automationId={selectedAutomation.id} />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

function AutomationLogsView({ automations }: { automations?: MakeAutomation[] }) {
  const [selected, setSelected] = useState<string | undefined>(automations?.[0]?.id);
  const { data: logs, isLoading } = useMakeAutomationLogs(selected);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-4">
          <Label>Filter by automation:</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Select automation" /></SelectTrigger>
            <SelectContent>
              {automations?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!selected ? <p className="text-muted-foreground text-sm">Select an automation to view logs.</p> :
          isLoading ? <p className="text-muted-foreground text-sm">Loading...</p> :
          <LogsTable logs={logs} />
        }
      </CardContent>
    </Card>
  );
}

function AutomationLogsTable({ automationId }: { automationId: string }) {
  const { data: logs, isLoading } = useMakeAutomationLogs(automationId);
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading logs...</p>;
  return <LogsTable logs={logs} />;
}

function LogsTable({ logs }: { logs?: { id: string; status: string; created_at: string; error_message: string | null; request_payload: Record<string, unknown> | null }[] }) {
  if (!logs?.length) return <p className="text-sm text-muted-foreground py-4 text-center">No logs yet.</p>;
  return (
    <ScrollArea className="max-h-64">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Status</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map(log => (
            <TableRow key={log.id}>
              <TableCell><StatusIcon status={log.status} /></TableCell>
              <TableCell className="text-xs">{format(new Date(log.created_at), "MMM d, h:mm:ss a")}</TableCell>
              <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                {log.error_message || (log.request_payload ? JSON.stringify(log.request_payload).slice(0, 80) : "—")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
