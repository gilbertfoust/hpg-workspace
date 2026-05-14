import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SupabaseNotConfiguredNotice } from "@/components/common/SupabaseNotConfiguredNotice";
import { isSupabaseNotConfiguredError } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNGOs, type NGO } from "@/hooks/useNGOs";
import { useCreateWorkItem, useWorkItems } from "@/hooks/useWorkItems";
import { buildAllAssistantPackets, buildAssistantPacket, type AssistantPacket } from "@/lib/hpgAssistant";
import { useApproveAssistantPacket, useAssistantPackets, useSaveAssistantPacket } from "@/hooks/useAssistantPackets";
import {
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileWarning,
  Mail,
  Route,
  Save,
  ShieldCheck,
  Sparkles,
  Stamp,
  Wand2,
} from "lucide-react";

function readinessVariant(packet: AssistantPacket): "default" | "secondary" | "destructive" | "outline" {
  if (packet.handoffReady && packet.riskFlags.every((risk) => risk.level !== "high")) return "default";
  if (packet.riskFlags.some((risk) => risk.level === "high")) return "destructive";
  if (packet.handoffReady) return "secondary";
  return "outline";
}

function toDatabasePriority(priority: AssistantPacket["departmentChecklist"][number]["priority"]) {
  if (priority === "low") return "Low";
  if (priority === "medium") return "Med";
  return "High";
}

function packetMarkdown(packet: AssistantPacket) {
  const missing = packet.documentsMissing.length
    ? packet.documentsMissing.map((gap) => `- ${gap.label} (${gap.ownerModule}): ${gap.reason}`).join("\n")
    : "- No major document gaps are currently flagged.";
  const checklist = packet.departmentChecklist.map((task) => `- ${task.department}: ${task.title} — ${task.description}`).join("\n");
  const risks = packet.riskFlags.length
    ? packet.riskFlags.map((risk) => `- ${risk.level.toUpperCase()} | ${risk.category}: ${risk.description} Recommended action: ${risk.recommendedAction}`).join("\n")
    : "- No major risk flags generated from the current workspace record.";
  const firstThirty = packet.firstThirtyDayActions.map((action, index) => `${index + 1}. ${action}`).join("\n");

  return `# HPG NGO Coordination Assistant Packet\n\n## Organization Snapshot\n\n**Organization:** ${packet.displayName}\n**Location:** ${packet.location}\n**Sponsorship Model:** ${packet.sponsorshipModel}\n**Current Status:** ${packet.currentStatus}\n**Handoff Ready:** ${packet.handoffReady ? "Yes" : "Not yet confirmed"}\n\n## Handoff Readiness\n\n${packet.readinessReasons.map((reason) => `- ${reason}`).join("\n")}\n\n## Missing Documents / Evidence\n\n${missing}\n\n## Department Checklist\n\n${checklist}\n\n## Risk Flags\n\n${risks}\n\n## Recommended First 30 Days\n\n${firstThirty}\n\n## NGO Coordinator Intro Email Draft\n\n**Subject:** ${packet.introEmail.subject}\n\n${packet.introEmail.body}\n\n## CEO / Cabinet Summary\n\n${packet.cabinetSummary}\n`;
}

export default function HPGAssistantPhase2() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: ngos, isLoading: ngosLoading, error: ngosError } = useNGOs();
  const { data: workItems, isLoading: workItemsLoading, error: workItemsError } = useWorkItems();
  const [selectedNgoId, setSelectedNgoId] = useState<string>("");
  const savePacket = useSaveAssistantPacket();
  const approvePacket = useApproveAssistantPacket();
  const createWorkItem = useCreateWorkItem();

  const supabaseNotConfigured = isSupabaseNotConfiguredError(ngosError) || isSupabaseNotConfiguredError(workItemsError);
  const packets = useMemo(() => buildAllAssistantPackets(ngos || [], workItems || []), [ngos, workItems]);
  const selectedNgo = useMemo(() => (ngos || []).find((ngo) => ngo.id === selectedNgoId) || null, [ngos, selectedNgoId]);
  const selectedPacket = useMemo(() => {
    if (selectedNgo) return buildAssistantPacket(selectedNgo, workItems || []);
    return packets[0] || null;
  }, [selectedNgo, workItems, packets]);

  const effectiveNgoId = selectedPacket?.ngoId || null;
  const { data: savedPackets = [], error: savedPacketsError } = useAssistantPackets(effectiveNgoId);
  const latestSavedPacket = savedPackets[0];

  const readyCount = packets.filter((packet) => packet.handoffReady).length;
  const highRiskCount = packets.filter((packet) => packet.riskFlags.some((risk) => risk.level === "high")).length;
  const totalGaps = packets.reduce((sum, packet) => sum + packet.documentsMissing.length, 0);

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: `${label} copied`, description: "The generated text is ready to paste into email, notes, or Cabinet materials." });
  };

  const handleSavePacket = async () => {
    if (!selectedPacket) return;
    try {
      await savePacket.mutateAsync(selectedPacket);
      toast({ title: "Assistant packet saved", description: "The generated packet is now recorded for review and approval." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Packet not saved", description: error.message || "Apply the Phase 2 Supabase migration before saving packets." });
    }
  };

  const handleApproveLatest = async () => {
    if (!latestSavedPacket || !selectedPacket) return;
    try {
      await approvePacket.mutateAsync({ packetId: latestSavedPacket.id, ngoId: selectedPacket.ngoId });
      toast({ title: "Packet approved", description: "The latest saved packet is approved for internal use." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Approval not recorded", description: error.message || "Approval requires the Phase 2 Supabase migration." });
    }
  };

  const handleCreateDraftWorkItems = async () => {
    if (!selectedPacket) return;
    if (!user?.id) {
      toast({ variant: "destructive", title: "Sign in required", description: "The workspace needs your user ID before it can create draft work items." });
      return;
    }

    try {
      for (const task of selectedPacket.departmentChecklist) {
        await createWorkItem.mutateAsync({
          title: `[Assistant Draft] ${task.title} — ${selectedPacket.displayName}`,
          description: `${task.description}\n\nGenerated by HPG Assistant from the NGO Coordination packet. Review before moving out of draft status.`,
          module: task.module,
          ngo_id: selectedPacket.ngoId,
          type: "Assistant Recommendation",
          status: "Draft",
          priority: toDatabasePriority(task.priority),
          created_by_user_id: user.id,
          evidence_required: false,
          external_visible: false,
        } as any);
      }
      toast({ title: "Draft work items created", description: `${selectedPacket.departmentChecklist.length} department draft tasks were created for review.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Draft work items not created", description: error.message || "Review work item permissions and schema." });
    }
  };

  if (supabaseNotConfigured) {
    return (
      <MainLayout title="HPG Assistant" subtitle="AI-ready coordination layer for NGO onboarding and executive summaries">
        <SupabaseNotConfiguredNotice />
      </MainLayout>
    );
  }

  const loading = ngosLoading || workItemsLoading;

  return (
    <MainLayout title="HPG Assistant" subtitle="Save, approve, and operationalize NGO Coordination packets">
      <div className="space-y-6">
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle>Phase 2: controlled workflow actions</AlertTitle>
          <AlertDescription>
            The Assistant can now save packets, record approval, and create draft work items after human action. It still does not send emails, approve NGOs, publish claims, or change financial records.
          </AlertDescription>
        </Alert>

        {savedPacketsError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Assistant packet tables are not active yet</AlertTitle>
            <AlertDescription>
              Packet generation will still work. Saving and approvals require applying the Phase 2 Supabase migration: <code>20260513203000_add_assistant_packets.sql</code>.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" /> NGOs analyzed</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{loading ? "—" : packets.length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Handoff ready</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{loading ? "—" : readyCount}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileWarning className="h-4 w-4" /> Document gaps</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{loading ? "—" : totalGaps}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> High risk</CardTitle></CardHeader><CardContent><p className="text-3xl font-semibold">{loading ? "—" : highRiskCount}</p></CardContent></Card>
        </div>

        {loading ? (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]"><Skeleton className="h-[520px]" /><Skeleton className="h-[520px]" /></div>
        ) : packets.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No NGO records are available yet.</CardContent></Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <Card className="h-fit">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" /> Packet Queue</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Select value={selectedNgoId || selectedPacket?.ngoId || ""} onValueChange={setSelectedNgoId}>
                  <SelectTrigger><SelectValue placeholder="Select an NGO" /></SelectTrigger>
                  <SelectContent>{(ngos || []).map((ngo: NGO) => <SelectItem key={ngo.id} value={ngo.id}>{ngo.common_name || ngo.legal_name}</SelectItem>)}</SelectContent>
                </Select>
                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                  {packets.map((packet) => (
                    <button key={packet.ngoId} className="w-full text-left rounded-lg border p-3 hover:bg-muted/60 transition-colors" onClick={() => setSelectedNgoId(packet.ngoId)}>
                      <div className="flex items-start justify-between gap-2"><div><p className="font-medium text-sm">{packet.displayName}</p><p className="text-xs text-muted-foreground">{packet.location}</p></div><Badge variant={readinessVariant(packet)}>{packet.handoffReady ? "Ready" : "Blocked"}</Badge></div>
                      <div className="mt-2 flex flex-wrap gap-1"><Badge variant="outline" className="text-[10px]">{packet.documentsMissing.length} gaps</Badge><Badge variant="outline" className="text-[10px]">{packet.riskFlags.length} risks</Badge><Badge variant="outline" className="text-[10px]">{packet.sponsorshipModel}</Badge></div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedPacket && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div><CardTitle className="text-xl">{selectedPacket.displayName}</CardTitle><p className="text-sm text-muted-foreground">{selectedPacket.location} • {selectedPacket.sponsorshipModel} • {selectedPacket.currentStatus}</p></div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={readinessVariant(selectedPacket)}>{selectedPacket.handoffReady ? "Handoff ready" : "Needs confirmation"}</Badge>
                        <Button size="sm" variant="outline" onClick={() => handleCopy(packetMarkdown(selectedPacket), "Assistant packet")}><Copy className="h-4 w-4 mr-2" /> Copy</Button>
                        <Button size="sm" onClick={handleSavePacket} disabled={savePacket.isPending}><Save className="h-4 w-4 mr-2" /> Save Packet</Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="workflow">
                      <TabsList className="flex flex-wrap h-auto justify-start">
                        <TabsTrigger value="workflow">Workflow</TabsTrigger><TabsTrigger value="documents">Documents</TabsTrigger><TabsTrigger value="departments">Departments</TabsTrigger><TabsTrigger value="email">Email Draft</TabsTrigger><TabsTrigger value="cabinet">Cabinet</TabsTrigger><TabsTrigger value="mcp">MCP</TabsTrigger>
                      </TabsList>

                      <TabsContent value="workflow" className="space-y-4 pt-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Saved packets</p><p className="text-2xl font-semibold">{savedPackets.length}</p></CardContent></Card>
                          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Latest status</p><p className="text-2xl font-semibold capitalize">{latestSavedPacket?.status || "Unsaved"}</p></CardContent></Card>
                          <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Department drafts</p><p className="text-2xl font-semibold">{selectedPacket.departmentChecklist.length}</p></CardContent></Card>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={handleApproveLatest} disabled={!latestSavedPacket || approvePacket.isPending}><Stamp className="h-4 w-4 mr-2" /> Approve Latest Saved Packet</Button>
                          <Button variant="outline" onClick={handleCreateDraftWorkItems} disabled={createWorkItem.isPending}><Wand2 className="h-4 w-4 mr-2" /> Create Draft Work Items</Button>
                        </div>
                        <div className="space-y-2">{selectedPacket.readinessReasons.map((reason) => <div key={reason} className="rounded-md border p-3 text-sm">{reason}</div>)}</div>
                      </TabsContent>

                      <TabsContent value="documents" className="space-y-3 pt-4">
                        {selectedPacket.documentsMissing.length === 0 ? <Alert><CheckCircle2 className="h-4 w-4" /><AlertTitle>No major document gaps flagged</AlertTitle><AlertDescription>The current workspace record does not show major document gaps.</AlertDescription></Alert> : selectedPacket.documentsMissing.map((gap) => <Card key={`${gap.source}-${gap.label}`}><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{gap.label}</p><p className="text-sm text-muted-foreground">{gap.reason}</p></div><Badge variant="outline">{gap.ownerModule}</Badge></div></CardContent></Card>)}
                      </TabsContent>

                      <TabsContent value="departments" className="space-y-3 pt-4">
                        {selectedPacket.departmentChecklist.map((task) => <Card key={`${task.department}-${task.title}`}><CardContent className="p-4"><div className="flex items-start gap-3"><Route className="h-4 w-4 mt-1 text-muted-foreground" /><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{task.department}</p><Badge variant="outline">{task.priority}</Badge></div><p className="text-sm font-medium mt-1">{task.title}</p><p className="text-sm text-muted-foreground">{task.description}</p></div></div></CardContent></Card>)}
                      </TabsContent>

                      <TabsContent value="email" className="space-y-3 pt-4">
                        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{selectedPacket.introEmail.subject}</p><p className="text-xs text-muted-foreground">Draft only. Review before sending.</p></div><Button size="sm" variant="outline" onClick={() => handleCopy(`Subject: ${selectedPacket.introEmail.subject}\n\n${selectedPacket.introEmail.body}`, "Email draft")}><Mail className="h-4 w-4 mr-2" /> Copy Email</Button></div>
                        <Textarea className="min-h-[360px] font-mono text-sm" value={selectedPacket.introEmail.body} readOnly />
                      </TabsContent>

                      <TabsContent value="cabinet" className="space-y-3 pt-4">
                        <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => handleCopy(selectedPacket.cabinetSummary, "Cabinet summary")}><Copy className="h-4 w-4 mr-2" /> Copy Summary</Button></div>
                        <Card><CardContent className="p-4 text-sm leading-7">{selectedPacket.cabinetSummary}</CardContent></Card>
                        <div className="space-y-2">{selectedPacket.firstThirtyDayActions.map((action, index) => <div key={action} className="flex gap-3 rounded-md border p-3 text-sm"><Badge variant="secondary">{index + 1}</Badge><span>{action}</span></div>)}</div>
                      </TabsContent>

                      <TabsContent value="mcp" className="space-y-4 pt-4">
                        <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Future ChatGPT connector path</AlertTitle><AlertDescription>This page uses the same packet-generation logic that can later be exposed through a private MCP tool called <code>{selectedPacket.mcpContext.toolName}</code>.</AlertDescription></Alert>
                        <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> MCP Readiness Notes</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p><strong>Recommended tool:</strong> {selectedPacket.mcpContext.toolName}</p><p><strong>Next connector action:</strong> {selectedPacket.mcpContext.recommendedNextConnectorAction}</p><p><strong>Safe to automate writes:</strong> {selectedPacket.mcpContext.safeToAutomate ? "Yes" : "No — human approval required first"}</p></CardContent></Card>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
