import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DevelopmentPipelineBoard } from "@/components/development/DevelopmentPipelineBoard";
import { DevelopmentOpportunityDrawer } from "@/components/development/DevelopmentOpportunityDrawer";
import { DevelopmentFundersOpportunities } from "@/components/development/DevelopmentFundersOpportunities";
import { useDevelopmentFunders } from "@/hooks/useDevelopmentFunders";
import { useDevelopmentOpportunities } from "@/hooks/useDevelopmentOpportunities";
import { useDevelopmentProposals } from "@/hooks/useDevelopmentProposals";
import { useNGOs } from "@/hooks/useNGOs";
import type { DevelopmentPipelineItem, DevelopmentPipelineStage } from "@/components/development/types";

const pipelineStages: DevelopmentPipelineStage[] = [
  "Identified",
  "Qualified",
  "Drafting",
  "Submitted",
  "Awarded",
  "Declined",
];

const normalizeStage = (value?: string | null): DevelopmentPipelineStage => {
  if (!value) return "Identified";
  const match = pipelineStages.find((stage) => stage.toLowerCase() === value.toLowerCase());
  return match || "Identified";
};

export default function DevelopmentDashboard() {
  const { data: funders } = useDevelopmentFunders();
  const { data: opportunities } = useDevelopmentOpportunities();
  const { data: proposals } = useDevelopmentProposals();
  const { data: ngos } = useNGOs();
  const [selectedItem, setSelectedItem] = useState<DevelopmentPipelineItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const funderMap = useMemo(() => {
    const map = new Map<string, string>();
    funders?.forEach((funder) => {
      map.set(funder.id, funder.name);
    });
    return map;
  }, [funders]);

  const ngoMap = useMemo(() => {
    const map = new Map<string, { name: string; bundle?: string | null }>();
    ngos?.forEach((ngo) => {
      map.set(ngo.id, {
        name: ngo.common_name || ngo.legal_name,
        bundle: ngo.bundle,
      });
    });
    return map;
  }, [ngos]);

  const pipelineItems = useMemo(() => {
    const items: DevelopmentPipelineItem[] = [];
    const linkedOpportunityIds = new Set<string>();

    proposals?.forEach((proposal) => {
      const opportunity = proposal.opportunity || null;
      if (proposal.grant_opportunity_id) {
        linkedOpportunityIds.add(proposal.grant_opportunity_id);
      }
      const ngoInfo = proposal.ngo_id ? ngoMap.get(proposal.ngo_id) : undefined;
      const funderName = opportunity?.funder_id ? funderMap.get(opportunity.funder_id) : undefined;

      items.push({
        id: proposal.id,
        title: proposal.title || opportunity?.name || "Untitled proposal",
        stage: normalizeStage(proposal.phase),
        funderName,
        amount: proposal.requested_amount,
        loiDue: opportunity?.loi_due || null,
        proposalDue: opportunity?.proposal_due || opportunity?.deadline || null,
        deadline: opportunity?.deadline || null,
        ngoName: ngoInfo?.name,
        ngoBundle: ngoInfo?.bundle,
        source: "proposal",
        proposal,
        opportunity: opportunity
          ? {
              ...opportunity,
              funder: opportunity.funder_id
                ? {
                    id: opportunity.funder_id,
                    name: funderMap.get(opportunity.funder_id) || "Funder",
                    type: null,
                  }
                : null,
            }
          : null,
      });
    });

    opportunities?.forEach((opportunity) => {
      if (linkedOpportunityIds.has(opportunity.id)) return;
      items.push({
        id: opportunity.id,
        title: opportunity.name,
        stage: normalizeStage(opportunity.status),
        funderName: opportunity.funder?.name || funderMap.get(opportunity.funder_id || "") || undefined,
        amount: opportunity.max_amount,
        loiDue: opportunity.loi_due,
        proposalDue: opportunity.proposal_due,
        deadline: opportunity.deadline,
        source: "opportunity",
        opportunity,
      });
    });

    return items;
  }, [funderMap, ngoMap, opportunities, proposals]);

  const kpis = useMemo(() => {
    const activeOpportunities =
      opportunities?.filter((opportunity) => {
        const status = opportunity.status?.toLowerCase() || "";
        return !["declined", "closed"].includes(status);
      }).length || 0;
    const draftingProposals = proposals?.filter((proposal) => proposal.phase === "Drafting").length || 0;

    const today = new Date();
    const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
    const quarterStart = new Date(today.getFullYear(), quarterStartMonth, 1);

    const submittedThisQuarter =
      proposals?.filter((proposal) => {
        if (!proposal.submitted_at) return false;
        return new Date(proposal.submitted_at) >= quarterStart;
      }).length || 0;

    const awarded = proposals?.filter((proposal) => proposal.phase === "Awarded").length || 0;
    const declined = proposals?.filter((proposal) => proposal.phase === "Declined").length || 0;

    return { activeOpportunities, draftingProposals, submittedThisQuarter, awarded, declined };
  }, [opportunities, proposals]);

  const openDrawer = (item: DevelopmentPipelineItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  return (
    <MainLayout
      title="Development"
      subtitle="Track grant opportunities, proposals, and fundraising work items."
      actions={<Badge variant="secondary">{pipelineItems.length} pipeline items</Badge>}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Active opportunities</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{kpis.activeOpportunities}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Drafting proposals</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{kpis.draftingProposals}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Submitted this quarter</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{kpis.submittedThisQuarter}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Awarded vs declined</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">
                {kpis.awarded}
                <span className="text-muted-foreground"> / </span>
                {kpis.declined}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pipeline" className="space-y-6">
          <TabsList className="bg-muted/30">
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="funders">Funders &amp; Opportunities</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline">
            <DevelopmentPipelineBoard items={pipelineItems} stages={pipelineStages} onSelect={openDrawer} />
          </TabsContent>

          <TabsContent value="funders">
            <DevelopmentFundersOpportunities />
          </TabsContent>
        </Tabs>
      </div>

      <DevelopmentOpportunityDrawer open={drawerOpen} onOpenChange={setDrawerOpen} item={selectedItem} />
    </MainLayout>
  );
}
