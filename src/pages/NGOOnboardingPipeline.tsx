import { useState, useMemo, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNGOs, type NGO } from "@/hooks/useNGOs";
import { DnDKanbanBoard, type KanbanColumn } from "@/components/common/DnDKanbanBoard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";

type FsaBoardProfile = {
  id: string;
  ngo_id: string;
  current_stage_key: string;
};

type FsaBoardStage = {
  stage_key: string;
  stage_name: string;
  stage_order: number;
  display_group_key: string;
  display_group_name: string;
  display_group_order: number;
  responsible_role: string;
  canonical_gate: boolean;
  terminal_stage: boolean;
};

type FsaBoardCard = {
  ngo: NGO;
  profile?: FsaBoardProfile;
  stage?: FsaBoardStage;
};

const workflowErrorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "An unexpected error occurred.";
};

type OnboardingWorkItem = {
  title: string;
  module:
    | "ngo_coordination"
    | "legal"
    | "program"
    | "finance"
    | "administration"
    | "it"
    | "hr"
    | "communications"
    | "development"
    | "operations";
  description: string;
  checklist: { label: string; checked: boolean }[];
};

const checked = (label: string) => ({ label, checked: false });

const BASE_ONBOARDING_WORK_ITEMS: OnboardingWorkItem[] = [
  {
    title: "G1 - Application Meeting Intake",
    module: "ngo_coordination",
    description: "Complete initial application intake, acknowledge receipt, collect availability, and prepare the human interview decision.",
    checklist: [
      checked("Log intake source and date received"),
      checked("Create or confirm the Development Drive case folder"),
      checked("Record the permanent HPG NGO profile number"),
      checked("Create or link the Trello case card"),
      checked("Send the automated acknowledgment email"),
      checked("Application received and completeness review started"),
      checked("Create pre-due-diligence report"),
      checked("Request applicant availability without confirming a meeting"),
      checked("Human approves the interview time"),
      checked("Meeting held and notes linked"),
      checked("Proceed, pause, or decline decision recorded neutrally"),
    ],
  },
  {
    title: "G1 - Documentation Intake",
    module: "ngo_coordination",
    description: "Send the applicable documentation checklist and collect the minimum required records.",
    checklist: [
      checked("Send documentation request pack and record deadline"),
      checked("Registration or formation documents received"),
      checked("Tax or charitable-status documentation received when applicable"),
      checked("Governance documents and board roster received"),
      checked("Leadership identification and contact details received"),
      checked("Business or strategic plan received"),
      checked("Project outline and mission/vision received"),
      checked("Projected budget received"),
      checked("Banking documentation received when applicable"),
      checked("Safeguarding and required policies received"),
      checked("Minimum documents complete and missing items listed with due dates"),
    ],
  },
  {
    title: "G2 - Compliance Review",
    module: "legal",
    description: "Complete compliance, background, sanctions, governance, and conflict-of-interest analysis.",
    checklist: [
      checked("Mission and charitable-purpose alignment reviewed"),
      checked("Background checks completed"),
      checked("Sanctions and watchlist screening completed"),
      checked("Country and registration requirements reviewed"),
      checked("Conflict-of-interest analysis completed"),
      checked("Risk rating and clarification questions documented"),
    ],
  },
  {
    title: "G2 - Program Department Review",
    module: "program",
    description: "Complete program fit, capacity, feasibility, safeguarding, and implementation review.",
    checklist: [
      checked("Program fit review completed and memo linked"),
      checked("Implementation capacity assessed"),
      checked("Safeguarding and beneficiary risks assessed"),
      checked("Deliverables and reporting expectations identified"),
      checked("Program recommendation posted"),
    ],
  },
  {
    title: "G2 - Finance Review",
    module: "finance",
    description: "Review the proposed budget, financial structure, controls, banking consistency, and sustainability before approval.",
    checklist: [
      checked("Budget reviewed for completeness and reasonableness"),
      checked("Financial structure and controls assessed"),
      checked("Banking information checked for consistency"),
      checked("Restricted-fund and reporting implications identified"),
      checked("Financial recommendation posted"),
    ],
  },
  {
    title: "G2 - General Counsel Review",
    module: "legal",
    description: "Complete legal eligibility, fiscal sponsorship suitability, agreement language, and compliance review.",
    checklist: [
      checked("Eligibility checks completed"),
      checked("Legal and compliance analysis completed"),
      checked("Decision, conditions, and recommendations posted"),
      checked("Agreement language prepared"),
      checked("General Counsel approval recorded"),
    ],
  },
  {
    title: "G2 - Board of Directors Review When Triggered",
    module: "administration",
    description: "Prepare and record Board review only when the partnership, risk, policy, or infrastructure trigger requires it.",
    checklist: [
      checked("Board trigger evaluated"),
      checked("If not required, exemption rationale recorded"),
      checked("If required, intake overview and decision packet prepared"),
      checked("Board notification or agenda placement completed"),
      checked("Vote or formal outcome recorded when applicable"),
    ],
  },
  {
    title: "G3 - Contract Execution",
    module: "legal",
    description: "Send the General Counsel-approved agreement for authorized signatures and confirm execution before any fee form is sent.",
    checklist: [
      checked("Final agreement approved by General Counsel"),
      checked("Agreement sent to NGO for signature"),
      checked("NGO signature received"),
      checked("Gilbert Foust or the Chief Development Officer signed"),
      checked("Fully executed agreement stored in Drive"),
      checked("Development Executive Secretary confirmed agreement execution"),
    ],
  },
];

const DEPARTMENT_ONBOARDING_WORK_ITEMS: OnboardingWorkItem[] = [
  {
    title: "IT Setup: Email, Workspace, Credentials",
    module: "it",
    description: "Create approved accounts, workspace access, and system credentials for the NGO.",
    checklist: [],
  },
  {
    title: "Finance Setup: COA, Budget, Bank",
    module: "finance",
    description: "Set up the chart of accounts, opening budget, banking workflow, and financial reporting requirements.",
    checklist: [],
  },
  {
    title: "HR Onboarding: Staff Registration",
    module: "hr",
    description: "Register approved NGO staff profiles and assign onboarding requirements.",
    checklist: [],
  },
  {
    title: "Marketing & Communications Setup",
    module: "communications",
    description: "Set up approved branding assets, listings, messaging, and communications support.",
    checklist: [],
  },
  {
    title: "Development Introduction & Fundraising Plan",
    module: "development",
    description: "Introduce the NGO to Development and outline the initial fundraising and donor-readiness plan.",
    checklist: [],
  },
  {
    title: "Operations & Monitoring Plan",
    module: "operations",
    description: "Establish operational procedures, reporting cadence, monitoring, and escalation expectations.",
    checklist: [],
  },
];

const normalizeCountry = (country: string | null | undefined) =>
  (country || "").toLowerCase().replace(/[^a-z]/g, "");

const isUsNgo = (ngo: NGO) =>
  ["us", "usa", "unitedstates", "unitedstatesofamerica"].includes(normalizeCountry(ngo.country));

const activationFeeWorkItemFor = (ngo: NGO): OnboardingWorkItem => {
  if (isUsNgo(ngo)) {
    return {
      title: "G3 - U.S. NGO Onboarding Fee",
      module: "finance",
      description: "After the agreement is fully signed, send and verify the existing U.S. NGO onboarding fee form. Do not use the international $100 form.",
      checklist: [
        checked("Jurisdiction confirmed as U.S. domestic"),
        checked("Fully executed agreement confirmed before fee form release"),
        checked("Existing U.S. NGO onboarding fee form sent"),
        checked("International NGO $100 form was not sent"),
        checked("Billing contact verified"),
        checked("Payment received and cleared, or authorized waiver/deferral recorded"),
        checked("Payment or transaction reference recorded"),
        checked("Finance verification posted"),
      ],
    };
  }

  return {
    title: "G3 - International NGO Activation Fee — $100 USD",
    module: "finance",
    description: "After the agreement is fully signed, send the dedicated International NGO Activation Fee Form and verify the fixed $100 USD payment. Do not send the U.S. onboarding fee form.",
    checklist: [
      checked("Jurisdiction confirmed as international / non-U.S."),
      checked("Fully executed agreement confirmed before form release"),
      checked("International NGO Activation Fee Form — $100 USD sent"),
      checked("U.S. NGO onboarding fee form was not sent"),
      checked("Billing contact verified"),
      checked("Exactly $100 USD received and cleared"),
      checked("Payment or transaction reference recorded"),
      checked("Finance verification posted"),
    ],
  };
};

const confirmationAndActivationWorkItem: OnboardingWorkItem = {
  title: "G3 - Confirmation, Activation & NGO Coordination Handoff",
  module: "ngo_coordination",
  description: "Issue the confirmation letter only after Finance verifies the applicable fee, then activate the profile and transfer the relationship to NGO Coordination.",
  checklist: [
    checked("Finance verification confirmed"),
    checked("Confirmation letter generated and issued"),
    checked("NGO profile activated by the Development Executive Secretary"),
    checked("Master profile and Drive record transferred to NGO Coordination"),
    checked("Department onboarding work items created"),
    checked("NGO Coordinator assigned"),
    checked("Onboarding packet and reporting calendar sent"),
  ],
};

const buildOnboardingWorkItems = (ngo: NGO) => [
  ...BASE_ONBOARDING_WORK_ITEMS,
  activationFeeWorkItemFor(ngo),
  confirmationAndActivationWorkItem,
  ...DEPARTMENT_ONBOARDING_WORK_ITEMS,
];

export default function NGOOnboardingPipeline() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: ngos, isLoading: ngosLoading } = useNGOs();
  const [launchNgo, setLaunchNgo] = useState<NGO | null>(null);
  const [launching, setLaunching] = useState(false);

  const movingRef = useRef(false);
  const [movingNgoId, setMovingNgoId] = useState<string | null>(null);
  const {
    data: workflow,
    isLoading: workflowLoading,
    error: workflowError,
    refetch: refetchWorkflow,
  } = useQuery({
    queryKey: ["partnership-fsa-board", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!supabase) throw new Error("The workspace connection is unavailable.");
      const [profilesResult, stagesResult] = await Promise.all([
        supabase.from("partnership_fsa_profiles" as never)
          .select("id,ngo_id,current_stage_key"),
        supabase.from("partnership_fsa_stages" as never)
          .select("stage_key,stage_name,stage_order,display_group_key,display_group_name,display_group_order,responsible_role,canonical_gate,terminal_stage")
          .order("stage_order"),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (stagesResult.error) throw stagesResult.error;
      const stages = (stagesResult.data || []) as unknown as FsaBoardStage[];
      if (!stages.length) throw new Error("Onboarding stages could not be loaded. Please contact IT.");
      return {
        profiles: (profilesResult.data || []) as unknown as FsaBoardProfile[],
        stages,
      };
    },
  });

  const { columns, cardsByNgoId } = useMemo(() => {
    const groups = new Map<string, KanbanColumn<FsaBoardCard>>();
    const cardsByNgoId = new Map<string, FsaBoardCard>();
    const profilesByNgo = new Map((workflow?.profiles || []).map(profile => [profile.ngo_id, profile]));
    const stagesByKey = new Map((workflow?.stages || []).map(stage => [stage.stage_key, stage]));
    [...(workflow?.stages || [])]
      .sort((a, b) => a.display_group_order - b.display_group_order || a.stage_order - b.stage_order)
      .forEach(stage => {
        if (!groups.has(stage.display_group_key)) {
          groups.set(stage.display_group_key, {
            id: stage.display_group_key,
            label: stage.display_group_name,
            items: [],
          });
        }
      });
    const unlinked: FsaBoardCard[] = [];
    (ngos || []).forEach(ngo => {
      if (ngo.status === "closed" || ngo.status === "at_risk") return;
      const profile = profilesByNgo.get(ngo.id);
      const stage = profile ? stagesByKey.get(profile.current_stage_key) : undefined;
      const card = { ngo, profile, stage };
      cardsByNgoId.set(ngo.id, card);
      const group = stage ? groups.get(stage.display_group_key) : undefined;
      if (group) group.items.push(card);
      else unlinked.push(card);
    });
    if (unlinked.length) {
      groups.set("workflow-review", { id: "workflow-review", label: "Needs workflow review", items: unlinked });
    }
    return { columns: [...groups.values()], cardsByNgoId };
  }, [ngos, workflow]);

  const advanceCard = async (ngoId: string, targetGroupKey?: string) => {
    if (movingRef.current || !supabase) return;
    const card = cardsByNgoId.get(ngoId);
    if (!card?.profile || !card.stage || targetGroupKey === "workflow-review") {
      toast({
        variant: "destructive",
        title: "Workflow review required",
        description: "This NGO needs its onboarding workflow linked before its card can move.",
      });
      return;
    }
    movingRef.current = true;
    setMovingNgoId(ngoId);
    try {
      const result = targetGroupKey
        ? await supabase.rpc("move_partnership_fsa_profile_to_group" as never, {
            p_profile_id: card.profile.id,
            p_target_group_key: targetGroupKey,
            p_reason: "Staff moved the NGO card on the onboarding board",
          } as never)
        : await supabase.rpc("advance_partnership_fsa_profile" as never, {
            p_profile_id: card.profile.id,
            p_reason: "Staff advanced the NGO's current onboarding step",
          } as never);
      if (result.error) throw result.error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["partnership-fsa-board"] }),
        qc.invalidateQueries({ queryKey: ["work-items"] }),
        qc.invalidateQueries({ queryKey: ["ngos"] }),
      ]);
      toast({ title: "Onboarding stage updated", description: "The saved workflow is now shown on the board." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Card could not move",
        description: workflowErrorMessage(error),
      });
    } finally {
      movingRef.current = false;
      setMovingNgoId(null);
    }
  };

  const handleLaunchOnboarding = async () => {
    if (!launchNgo || !user || !supabase) return;
    setLaunching(true);

    try {
      if (!launchNgo.country?.trim()) {
        throw new Error("Country is required before the onboarding and activation-fee route can be created.");
      }

      const onboardingWorkItems = buildOnboardingWorkItems(launchNgo);
      const items = onboardingWorkItems.map((item) => ({
        title: `${item.title} — ${launchNgo.common_name || launchNgo.legal_name}`,
        description: item.description,
        module: item.module,
        ngo_id: launchNgo.id,
        type: "NGO Onboarding",
        status: "Not Started" as const,
        priority: item.title.includes("Activation Fee") || item.title.includes("Onboarding Fee")
          ? "High" as const
          : "Med" as const,
        owner_user_id: user.id,
        checklist_json: item.checklist.length > 0 ? item.checklist : null,
      }));

      const { error } = await supabase.from("work_items").insert(items as never);
      if (error) throw error;

      const { error: ngoError } = await supabase
        .from("ngos")
        .update({ status: "onboarding" } as never)
        .eq("id", launchNgo.id);
      if (ngoError) throw ngoError;

      const feeRoute = isUsNgo(launchNgo)
        ? "the existing U.S. NGO onboarding fee form"
        : "the International NGO Activation Fee Form for $100 USD";

      toast({
        title: "Onboarding launched",
        description: `${onboardingWorkItems.length} work items created. This NGO is routed to ${feeRoute} after agreement signature.`,
      });
      qc.invalidateQueries({ queryKey: ["work-items"] });
      qc.invalidateQueries({ queryKey: ["ngos"] });
      setLaunchNgo(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to launch onboarding",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setLaunching(false);
    }
  };

  const selectedFeeRoute = launchNgo
    ? isUsNgo(launchNgo)
      ? "U.S. NGO onboarding fee form"
      : "International NGO activation form — $100 USD"
    : null;

  return (
    <MainLayout
      title="NGO Onboarding Pipeline"
      subtitle="Agreement → jurisdiction-specific fee → Finance verification → confirmation → activation → NGO Coordination"
    >
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Drag a card to its next workflow column, or use Advance step for the next stage within a column.
          Required checklists and approvals must be complete before a move can be saved.
        </p>
        {ngosLoading || workflowLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-64" />)}
          </div>
        ) : workflowError ? (
          <Card>
            <CardContent className="space-y-3 p-4">
              <p className="text-sm text-destructive">{workflowErrorMessage(workflowError)}</p>
              <Button variant="outline" onClick={() => void refetchWorkflow()}>Retry</Button>
            </CardContent>
          </Card>
        ) : (
          <DnDKanbanBoard
            columns={columns}
            getItemId={card => card.ngo.id}
            onDrop={(ngoId, groupKey) => void advanceCard(ngoId, groupKey)}
            columnWidth={250}
            renderCard={({ ngo, profile, stage }) => (
              <Card
                className="cursor-pointer border-l-4 border-l-primary/60 transition-colors hover:bg-accent/50"
                onClick={() => navigate(`/ngos/${ngo.id}`)}
              >
                <CardContent className="p-3">
                  <p className="text-sm font-medium">{ngo.common_name || ngo.legal_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{ngo.country || "Country required"}</p>
                  <Badge variant="outline" className="mt-2 text-[10px]">
                    {isUsNgo(ngo) ? "U.S. fee route" : "International $100 route"}
                  </Badge>
                  {stage ? (
                    <>
                      <p className="mt-2 text-xs font-medium">{stage.stage_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Responsible: {stage.responsible_role}</p>
                      {stage.canonical_gate && stage.stage_key !== "confirmation_letter_issued" ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Update the required approval, signed document, or payment record to advance this stage.
                        </p>
                      ) : !stage.terminal_stage && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full"
                          disabled={!!movingNgoId}
                          onClick={event => {
                            event.stopPropagation();
                            void advanceCard(ngo.id);
                          }}
                        >
                          {movingNgoId === ngo.id ? "Saving..." : "Advance step"}
                        </Button>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {profile ? "The saved workflow stage needs review." : "No onboarding workflow is linked."}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket className="h-4 w-4" />
              Launch FSA Onboarding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Select a prospect NGO to create the full cross-department workflow. The country controls which fee form is used after the agreement is signed.
            </p>
            <div className="flex items-end gap-3">
              <div className="max-w-sm flex-1">
                <Select
                  value={launchNgo?.id || ""}
                  onValueChange={(id) => {
                    const ngo = (ngos || []).find((candidate) => candidate.id === id);
                    setLaunchNgo(ngo || null);
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Select NGO..." /></SelectTrigger>
                  <SelectContent>
                    {(ngos || [])
                      .filter((ngo) => ngo.status === "prospect")
                      .map((ngo) => (
                        <SelectItem key={ngo.id} value={ngo.id}>
                          {ngo.common_name || ngo.legal_name} — {ngo.country || "country required"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedFeeRoute && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Fee route: <span className="font-medium text-foreground">{selectedFeeRoute}</span>
                  </p>
                )}
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
