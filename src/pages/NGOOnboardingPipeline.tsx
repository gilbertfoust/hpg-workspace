import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useNGOs, type NGO } from "@/hooks/useNGOs";
import { useWorkItems } from "@/hooks/useWorkItems";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DnDKanbanBoard, KanbanColumn } from "@/components/common/DnDKanbanBoard";

const FSA_STAGES = [
  "G1 - Intake", "G1 - Documentation", "G2 - Compliance", "G2 - Program Review",
  "G2 - General Counsel", "G2 - BOD Approval", "G2 - Finance", "G3 - Contract Exec",
  "Dept Onboarding", "Active",
] as const;

type FsaStage = typeof FSA_STAGES[number];

const STAGE_COLORS: Record<string, string> = {
  "G1 - Intake": "border-l-blue-400", "G1 - Documentation": "border-l-indigo-400",
  "G2 - Compliance": "border-l-violet-400", "G2 - Program Review": "border-l-purple-400",
  "G2 - General Counsel": "border-l-fuchsia-400", "G2 - BOD Approval": "border-l-amber-400",
  "G2 - Finance": "border-l-orange-400", "G3 - Contract Exec": "border-l-rose-400",
  "Dept Onboarding": "border-l-emerald-400", "Active": "border-l-green-500",
};

const ONBOARDING_WORK_ITEMS = [
  { title: "G1 - Application Meeting Intake", module: "ngo_coordination" as const, description: "Complete initial application intake meeting, send acknowledgement, schedule and hold intro meeting.", checklist: [
    { label: "Log intake: source (email/form/referral) + date received", checked: false },
    { label: "Create/confirm Drive folder link is on the card", checked: false },
    { label: "Complete Roles block (names): EAO (pre-sign), IDF, GC, Program Lead, Finance Lead, Dev Lead", checked: false },
    { label: "Send acknowledgement email (template) + record date sent", checked: false },
    { label: "Application Received", checked: false },
    { label: "Create Pre-Due Diligence Report", checked: false },
    { label: "Request availability / send scheduling link + track response", checked: false },
    { label: "Schedule meeting + calendar invite sent + meeting link pasted to card", checked: false },
    { label: "Agenda/pre-reads link added to card", checked: false },
    { label: "Meeting held: notes link posted + summary decision (proceed / pause / decline)", checked: false },
    { label: "If pause/decline: move to correct list + record reason (neutral)", checked: false },
  ]},
  { title: "G1 - Documentation Intake", module: "ngo_coordination" as const, description: "Send documentation request pack and collect minimum required documents.", checklist: [
    { label: "Send documentation request pack + deadline date recorded", checked: false },
    { label: "EIN received", checked: false }, { label: "State AOI received", checked: false },
    { label: "501(c)(3) letter / status documentation received", checked: false },
    { label: "Annual State AR received", checked: false }, { label: "Prior registrations (if any) received", checked: false },
    { label: "Operating Agreement received", checked: false }, { label: "Business plan received", checked: false },
    { label: "Project outline received", checked: false }, { label: "Mission/Vision received", checked: false },
    { label: "Projected budget received", checked: false }, { label: "Board roster + relationship context received", checked: false },
    { label: "Gate 1: minimum docs received + missing items listed with due dates", checked: false },
  ]},
  { title: "G2 - Compliance Review", module: "legal" as const, description: "Complete compliance checks including background, sanctions, and conflict of interest analysis.", checklist: [
    { label: "Mission alignment", checked: false }, { label: "Background checks", checked: false },
    { label: "Sanctions screening", checked: false }, { label: "National Alignment Research / Federal Backlists", checked: false },
    { label: "Conflict of Interest Analysis", checked: false },
  ]},
  { title: "G2 - Program Department Pre-Signature Reviews", module: "program" as const, description: "Complete program fit review and internal approval meeting.", checklist: [
    { label: "Program fit review completed + memo linked", checked: false },
    { label: "Internal approval meeting completed + outcome logged", checked: false },
  ]},
  { title: "G2 - General Counsel Review", module: "legal" as const, description: "Complete eligibility checks, post decision/notes, and develop contract.", checklist: [
    { label: "Eligibility Checks completed", checked: false }, { label: "Decision / Notes / Recommendations Posted", checked: false },
    { label: "Contract Development", checked: false }, { label: "(If Project Acquisition Development — click here)", checked: false },
  ]},
  { title: "G2 - Board of Directors Approval", module: "administration" as const, description: "Prepare intake overview, notify board, and log approval.", checklist: [
    { label: "Intake overview prepared", checked: false }, { label: "Board notification sent", checked: false },
    { label: "Soft approval logged (date + location)", checked: false }, { label: "Vote outcome recorded (if formal vote is used)", checked: false },
  ]},
  { title: "G2 - Finance Processing", module: "finance" as const, description: "Confirm fees, process payment, and release contract for signing.", checklist: [
    { label: "Fee amount confirmed (or waiver attached)", checked: false }, { label: "Billing contact verified", checked: false },
    { label: "Send link for onboarding fee", checked: false }, { label: "Payment received/cleared OR waiver/deferral logged", checked: false },
    { label: "Invoice recorded (invoice #, date)", checked: false }, { label: "Confirm Receipt/confirmation sent to NGO", checked: false },
    { label: "Finance 'Release Contract' confirmation posted", checked: false },
  ]},
  { title: "G3 - Contract Execution", module: "legal" as const, description: "Send contract for signing and confirm execution.", checklist: [
    { label: "Send contract to NGO for signing", checked: false }, { label: "Signed Contract Received by NGO", checked: false },
    { label: "Signature added to card", checked: false }, { label: "Contact confirmed completed by Development ES", checked: false },
  ]},
  { title: "IT Setup: Email, Workspace, Credentials", module: "it" as const, description: "Create email accounts, workspace access, and system credentials for the NGO.", checklist: [] },
  { title: "Finance Setup: COA, Budget, Bank", module: "finance" as const, description: "Set up chart of accounts, initial budget, and bank account details.", checklist: [] },
  { title: "HR Onboarding: Staff Registration", module: "hr" as const, description: "Register NGO staff profiles and assign onboarding checklists.", checklist: [] },
  { title: "Marketing & Comms Setup", module: "communications" as const, description: "Set up branding assets, website listing, and social media presence.", checklist: [] },
  { title: "Development Intro & Fundraising Plan", module: "development" as const, description: "Introduce NGO to development team and outline initial fundraising strategy.", checklist: [] },
  { title: "Operations & Monitoring Plan", module: "operations" as const, description: "Establish operational procedures, reporting cadence, and monitoring plan.", checklist: [] },
];

// Manual stage override mapping for NGOs
const STAGE_STATUS_MAP: Record<FsaStage, string> = {
  "G1 - Intake": "onboarding", "G1 - Documentation": "onboarding",
  "G2 - Compliance": "onboarding", "G2 - Program Review": "onboarding",
  "G2 - General Counsel": "onboarding", "G2 - BOD Approval": "onboarding",
  "G2 - Finance": "onboarding", "G3 - Contract Exec": "onboarding",
  "Dept Onboarding": "onboarding", "Active": "active",
};

export default function NGOOnboardingPipeline() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: ngos, isLoading: ngosLoading } = useNGOs();
  const { data: workItems } = useWorkItems();
  const [launchNgo, setLaunchNgo] = useState<NGO | null>(null);
  const [launching, setLaunching] = useState(false);

  const stageForNgo = (ngo: NGO): FsaStage => {
    if (ngo.status === "active") return "Active";
    if (ngo.status !== "onboarding") return "G1 - Intake";
    const ngoItems = (workItems || []).filter((w) => w.ngo_id === ngo.id && w.type === "NGO Onboarding");
    const total = ngoItems.length;
    const done = ngoItems.filter((w) => w.status === "complete" || w.status === "approved").length;
    if (total === 0) return "G1 - Intake";
    if (done < 2) return "G1 - Documentation";
    if (done < 3) return "G2 - Compliance";
    if (done < 4) return "G2 - Program Review";
    if (done < 5) return "G2 - General Counsel";
    if (done < 6) return "G2 - BOD Approval";
    if (done < 7) return "G2 - Finance";
    if (done < 8) return "G3 - Contract Exec";
    return "Dept Onboarding";
  };

  const columns: KanbanColumn<NGO>[] = useMemo(() => {
    return FSA_STAGES.map((stage) => {
      const items = (ngos || []).filter((ngo) => {
        if (ngo.status === "closed" || ngo.status === "at_risk") return false;
        return stageForNgo(ngo) === stage;
      });
      return { id: stage, label: stage, colorClass: STAGE_COLORS[stage], items };
    });
  }, [ngos, workItems]);

  const handleDrop = async (ngoId: string, targetStage: string) => {
    const newStatus = STAGE_STATUS_MAP[targetStage as FsaStage] || "onboarding";
    try {
      await supabase!.from("ngos").update({ status: newStatus }).eq("id", ngoId);
      qc.invalidateQueries({ queryKey: ["ngos"] });
      toast({ title: "NGO moved", description: `Moved to ${targetStage}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const handleLaunchOnboarding = async () => {
    if (!launchNgo || !user) return;
    setLaunching(true);
    try {
      const items = ONBOARDING_WORK_ITEMS.map((item) => ({
        title: `${item.title} — ${launchNgo.common_name || launchNgo.legal_name}`,
        description: item.description, module: item.module, ngo_id: launchNgo.id,
        type: "NGO Onboarding", status: "not_started" as const, priority: "medium" as const,
        owner_user_id: user.id, checklist_json: item.checklist.length > 0 ? item.checklist : null,
      }));
      const { error } = await supabase!.from("work_items").insert(items as any);
      if (error) throw error;
      await supabase!.from("ngos").update({ status: "onboarding" }).eq("id", launchNgo.id);
      toast({ title: "Onboarding launched", description: `${ONBOARDING_WORK_ITEMS.length} work items created with FSA gate checklists.` });
      qc.invalidateQueries({ queryKey: ["work-items"] });
      qc.invalidateQueries({ queryKey: ["ngos"] });
      setLaunchNgo(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally { setLaunching(false); }
  };

  return (
    <MainLayout title="NGO Onboarding Pipeline" subtitle="Drag NGO cards between gates to update stage">
      <div className="space-y-6">
        {ngosLoading ? (
          <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64" />)}</div>
        ) : (
          <ScrollArea className="w-full">
            <DnDKanbanBoard
              columns={columns}
              getItemId={(ngo) => ngo.id}
              onDrop={handleDrop}
              renderCard={(ngo, columnId) => (
                <Card
                  className={`border-l-4 ${STAGE_COLORS[columnId] || ""} cursor-grab hover:bg-accent/50 transition-colors`}
                  onClick={() => navigate(`/ngos/${ngo.id}`)}
                >
                  <CardContent className="p-3">
                    <p className="text-sm font-medium">{ngo.common_name || ngo.legal_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{ngo.country || "No location"}</p>
                    {columnId !== "Active" && columnId !== "G1 - Intake" && (() => {
                      const ngoItems = (workItems || []).filter((w) => w.ngo_id === ngo.id && w.type === "NGO Onboarding");
                      const done = ngoItems.filter((w) => w.status === "complete" || w.status === "approved").length;
                      return <p className="text-xs text-muted-foreground mt-2">{done}/{ngoItems.length} tasks done</p>;
                    })()}
                  </CardContent>
                </Card>
              )}
            />
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Rocket className="w-4 h-4" /> Launch FSA Onboarding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Select a prospect NGO to launch the full FSA gate-based onboarding workflow.
              This creates {ONBOARDING_WORK_ITEMS.length} work items across Gates 1-3 plus departmental setup.
            </p>
            <div className="flex gap-3 items-end">
              <div className="flex-1 max-w-sm">
                <Select value={launchNgo?.id || ""} onValueChange={(id) => setLaunchNgo((ngos || []).find((n) => n.id === id) || null)}>
                  <SelectTrigger><SelectValue placeholder="Select NGO..." /></SelectTrigger>
                  <SelectContent>
                    {(ngos || []).filter((n) => n.status === "prospect").map((n) => (
                      <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleLaunchOnboarding} disabled={!launchNgo || launching}>
                {launching ? "Launching..." : "Launch Onboarding"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
