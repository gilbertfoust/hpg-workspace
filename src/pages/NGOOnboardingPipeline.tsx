import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNGOs, type NGO } from "@/hooks/useNGOs";
import { useWorkItems } from "@/hooks/useWorkItems";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";

const FSA_STAGES = [
  "G1 - Intake",
  "G1 - Documentation",
  "G2 - Compliance",
  "G2 - Program Review",
  "G2 - Finance Review",
  "G2 - General Counsel",
  "G2 - BOD Approval",
  "G3 - Contract Exec",
  "Activation Fee",
  "Confirmation & Activation",
  "Dept Onboarding",
  "Active",
] as const;

type FsaStage = typeof FSA_STAGES[number];

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

const STAGE_COLORS: Record<FsaStage, string> = {
  "G1 - Intake": "border-l-blue-400",
  "G1 - Documentation": "border-l-indigo-400",
  "G2 - Compliance": "border-l-violet-400",
  "G2 - Program Review": "border-l-purple-400",
  "G2 - Finance Review": "border-l-orange-400",
  "G2 - General Counsel": "border-l-fuchsia-400",
  "G2 - BOD Approval": "border-l-amber-400",
  "G3 - Contract Exec": "border-l-rose-400",
  "Activation Fee": "border-l-cyan-500",
  "Confirmation & Activation": "border-l-teal-500",
  "Dept Onboarding": "border-l-emerald-400",
  "Active": "border-l-green-500",
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
  const { data: workItems } = useWorkItems();
  const [launchNgo, setLaunchNgo] = useState<NGO | null>(null);
  const [launching, setLaunching] = useState(false);

  const stageForNgo = (ngo: NGO): FsaStage => {
    if (ngo.status === "active") return "Active";
    if (ngo.status !== "onboarding") return "G1 - Intake";

    const ngoItems = (workItems || []).filter((workItem) =>
      workItem.ngo_id === ngo.id && workItem.type === "NGO Onboarding"
    );
    const total = ngoItems.length;
    const done = ngoItems.filter((workItem) =>
      workItem.status === "complete" || workItem.status === "approved"
    ).length;

    if (total === 0) return "G1 - Intake";
    if (done < 2) return "G1 - Documentation";
    if (done < 3) return "G2 - Compliance";
    if (done < 4) return "G2 - Program Review";
    if (done < 5) return "G2 - Finance Review";
    if (done < 6) return "G2 - General Counsel";
    if (done < 7) return "G2 - BOD Approval";
    if (done < 8) return "G3 - Contract Exec";
    if (done < 9) return "Activation Fee";
    if (done < 10) return "Confirmation & Activation";
    return "Dept Onboarding";
  };

  const columns = useMemo(() => {
    const map = new Map<FsaStage, NGO[]>();
    FSA_STAGES.forEach((stage) => map.set(stage, []));
    (ngos || []).forEach((ngo) => {
      if (ngo.status === "closed" || ngo.status === "at_risk") return;
      map.get(stageForNgo(ngo))?.push(ngo);
    });
    return map;
  }, [ngos, workItems]);

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
        status: "not_started" as const,
        priority: item.title.includes("Activation Fee") || item.title.includes("Onboarding Fee")
          ? "high" as const
          : "medium" as const,
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
        {ngosLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-64" />)}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {FSA_STAGES.map((stage) => {
              const stageNgos = columns.get(stage) || [];
              return (
                <div key={stage} className="min-w-[210px] flex-shrink-0">
                  <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide">{stage}</h3>
                    <Badge variant="secondary" className="text-xs">{stageNgos.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {stageNgos.map((ngo) => (
                      <Card
                        key={ngo.id}
                        className={`cursor-pointer border-l-4 ${STAGE_COLORS[stage]} transition-colors hover:bg-accent/50`}
                        onClick={() => navigate(`/ngos/${ngo.id}`)}
                      >
                        <CardContent className="p-3">
                          <p className="text-sm font-medium">{ngo.common_name || ngo.legal_name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{ngo.country || "Country required"}</p>
                          <Badge variant="outline" className="mt-2 text-[10px]">
                            {isUsNgo(ngo) ? "U.S. fee route" : "International $100 route"}
                          </Badge>
                          {stage !== "Active" && stage !== "G1 - Intake" && (() => {
                            const ngoItems = (workItems || []).filter((workItem) =>
                              workItem.ngo_id === ngo.id && workItem.type === "NGO Onboarding"
                            );
                            const done = ngoItems.filter((workItem) =>
                              workItem.status === "complete" || workItem.status === "approved"
                            ).length;
                            return (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {done}/{ngoItems.length} tasks done
                              </p>
                            );
                          })()}
                        </CardContent>
                      </Card>
                    ))}
                    {stageNgos.length === 0 && (
                      <p className="py-8 text-center text-xs text-muted-foreground">No NGOs</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
