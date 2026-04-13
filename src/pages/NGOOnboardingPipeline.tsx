import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNGOs, type NGO } from "@/hooks/useNGOs";
import { useWorkItems } from "@/hooks/useWorkItems";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Plus, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ONBOARDING_STAGES = [
  "Inquiry",
  "Application",
  "Program Review",
  "Legal Review",
  "Approval",
  "Agreement",
  "Dept Onboarding",
  "Active",
] as const;

type OnboardingStage = typeof ONBOARDING_STAGES[number];

const STAGE_COLORS: Record<string, string> = {
  Inquiry: "border-l-blue-400",
  Application: "border-l-indigo-400",
  "Program Review": "border-l-violet-400",
  "Legal Review": "border-l-purple-400",
  Approval: "border-l-amber-400",
  Agreement: "border-l-orange-400",
  "Dept Onboarding": "border-l-emerald-400",
  Active: "border-l-green-500",
};

// Work items auto-generated when onboarding is kicked off
const ONBOARDING_WORK_ITEMS = [
  { title: "Program Review & Research", module: "program" as const, description: "Review NGO application, mission alignment, and program viability." },
  { title: "Legal Document Review", module: "legal" as const, description: "Review incorporation docs, bylaws, tax-exempt status, and governance." },
  { title: "Internal Approval & Board Notification", module: "administration" as const, description: "Obtain internal approval and notify the board of new NGO sponsorship." },
  { title: "Fiscal Sponsorship Agreement", module: "legal" as const, description: "Draft, review, and execute the fiscal sponsorship agreement via e-sign." },
  { title: "IT Setup: Email, Workspace, Credentials", module: "it" as const, description: "Create email accounts, workspace access, and system credentials." },
  { title: "Finance Setup: COA, Budget, Bank", module: "finance" as const, description: "Set up chart of accounts, initial budget, and bank account details." },
  { title: "HR Onboarding: Staff Registration", module: "hr" as const, description: "Register NGO staff profiles and assign onboarding checklists." },
  { title: "Marketing & Comms Setup", module: "communications" as const, description: "Set up branding assets, website listing, and social media presence." },
  { title: "Development Intro & Fundraising Plan", module: "development" as const, description: "Introduce NGO to development team and outline initial fundraising strategy." },
  { title: "Operations & Monitoring Plan", module: "operations" as const, description: "Establish operational procedures, reporting cadence, and monitoring plan." },
];

export default function NGOOnboardingPipeline() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: ngos, isLoading: ngosLoading } = useNGOs();
  const { data: workItems } = useWorkItems();
  const [launchNgo, setLaunchNgo] = useState<NGO | null>(null);
  const [launching, setLaunching] = useState(false);

  // Derive stage from NGO status
  const stageForNgo = (ngo: NGO): OnboardingStage => {
    switch (ngo.status) {
      case "prospect": return "Inquiry";
      case "onboarding": {
        // Check work items to determine sub-stage
        const ngoItems = (workItems || []).filter((w) => w.ngo_id === ngo.id && w.type === "NGO Onboarding");
        const total = ngoItems.length;
        const done = ngoItems.filter((w) => w.status === "complete" || w.status === "approved").length;
        if (total === 0) return "Application";
        if (done < 3) return "Program Review";
        if (done < 5) return "Legal Review";
        if (done < 7) return "Agreement";
        return "Dept Onboarding";
      }
      case "active": return "Active";
      default: return "Inquiry";
    }
  };

  const columns = useMemo(() => {
    const map = new Map<OnboardingStage, NGO[]>();
    ONBOARDING_STAGES.forEach((s) => map.set(s, []));
    (ngos || []).forEach((ngo) => {
      if (ngo.status === "closed" || ngo.status === "at_risk") return;
      const stage = stageForNgo(ngo);
      map.get(stage)?.push(ngo);
    });
    return map;
  }, [ngos, workItems]);

  const handleLaunchOnboarding = async () => {
    if (!launchNgo || !user) return;
    setLaunching(true);
    try {
      // Create work items for each department
      const items = ONBOARDING_WORK_ITEMS.map((item) => ({
        title: `${item.title} — ${launchNgo.common_name || launchNgo.legal_name}`,
        description: item.description,
        module: item.module,
        ngo_id: launchNgo.id,
        type: "NGO Onboarding",
        status: "not_started" as const,
        priority: "medium" as const,
        owner_user_id: user.id,
      }));

      const { error } = await supabase.from("work_items").insert(items);
      if (error) throw error;

      // Update NGO status to onboarding
      await supabase.from("ngos").update({ status: "onboarding" }).eq("id", launchNgo.id);

      toast({ title: "Onboarding launched", description: `${ONBOARDING_WORK_ITEMS.length} work items created across departments.` });
      qc.invalidateQueries({ queryKey: ["work-items"] });
      qc.invalidateQueries({ queryKey: ["ngos"] });
      setLaunchNgo(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <MainLayout title="NGO Onboarding Pipeline" subtitle="Track NGOs through the onboarding lifecycle">
      <div className="space-y-6">
        {/* Pipeline Board */}
        {ngosLoading ? (
          <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-64" />)}</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {ONBOARDING_STAGES.map((stage) => {
              const items = columns.get(stage) || [];
              return (
                <div key={stage} className="min-w-[220px] flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold">{stage}</h3>
                    <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {items.map((ngo) => (
                      <Card
                        key={ngo.id}
                        className={`border-l-4 ${STAGE_COLORS[stage] || ""} cursor-pointer hover:bg-accent/50 transition-colors`}
                        onClick={() => navigate(`/ngos/${ngo.id}`)}
                      >
                        <CardContent className="p-3">
                          <p className="text-sm font-medium">{ngo.common_name || ngo.legal_name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{ngo.country || "No location"}</p>
                          {stage !== "Active" && stage !== "Inquiry" && (
                            <div className="mt-2">
                              {(() => {
                                const ngoItems = (workItems || []).filter((w) => w.ngo_id === ngo.id && w.type === "NGO Onboarding");
                                const done = ngoItems.filter((w) => w.status === "complete" || w.status === "approved").length;
                                return (
                                  <p className="text-xs text-muted-foreground">{done}/{ngoItems.length} tasks done</p>
                                );
                              })()}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {items.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-8">No NGOs</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Launch Onboarding */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="w-4 h-4" />
              Launch NGO Onboarding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Select a prospect NGO to kick off the 10-step cross-departmental onboarding workflow. 
              This will create work items for Program, Legal, IT, Finance, HR, Communications, Development, and Operations.
            </p>
            <div className="flex gap-3 items-end">
              <div className="flex-1 max-w-sm">
                <Select
                  value={launchNgo?.id || ""}
                  onValueChange={(id) => {
                    const ngo = (ngos || []).find((n) => n.id === id);
                    setLaunchNgo(ngo || null);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select NGO..." /></SelectTrigger>
                  <SelectContent>
                    {(ngos || [])
                      .filter((n) => n.status === "prospect")
                      .map((n) => (
                        <SelectItem key={n.id} value={n.id}>
                          {n.common_name || n.legal_name}
                        </SelectItem>
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
