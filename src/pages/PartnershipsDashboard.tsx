import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PartnershipsPipelineBoard } from "@/components/partnerships/PartnershipsPipelineBoard";
import { PartnershipRecordDrawer } from "@/components/partnerships/PartnershipRecordDrawer";
import { usePartnershipsPartners } from "@/hooks/usePartnershipsPartners";
import { usePartnershipsPipeline } from "@/hooks/usePartnershipsPipeline";
import { useNGOs } from "@/hooks/useNGOs";
import type { PartnershipPipelineItem, PartnershipPipelineStage } from "@/components/partnerships/types";

const pipelineStages: PartnershipPipelineStage[] = [
  "Prospect",
  "Discovery",
  "Negotiation",
  "MOU Drafting",
  "Active",
  "Dormant",
];

const normalizeStage = (value?: string | null): PartnershipPipelineStage => {
  if (!value) return "Prospect";
  const match = pipelineStages.find((stage) => stage.toLowerCase() === value.toLowerCase());
  return match || "Prospect";
};

export default function PartnershipsDashboard() {
  const { data: partners } = usePartnershipsPartners();
  const { data: pipelineRecords } = usePartnershipsPipeline();
  const { data: ngos } = useNGOs();
  const [selectedItem, setSelectedItem] = useState<PartnershipPipelineItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const ngoMap = useMemo(() => {
    const map = new Map<string, { name: string; bundle?: string | null }>();
    ngos?.forEach((ngo) => {
      map.set(ngo.id, { name: ngo.common_name || ngo.legal_name, bundle: ngo.bundle });
    });
    return map;
  }, [ngos]);

  const pipelineItems = useMemo(() => {
    return (
      pipelineRecords?.map((record) => ({
        id: record.id,
        stage: normalizeStage(record.stage),
        partnerName: record.partner?.name || "Unnamed partner",
        partnerType: record.partner?.type || null,
        region: record.partner?.region || null,
        status: record.partner?.status || null,
        primaryContact: record.partner?.primary_contact || null,
        ngoName: record.ngo_id ? ngoMap.get(record.ngo_id)?.name : null,
        ngoBundle: record.ngo_id ? ngoMap.get(record.ngo_id)?.bundle : null,
        notes: record.notes,
        keyCommitments: record.key_commitments,
        record,
      })) || []
    );
  }, [ngoMap, pipelineRecords]);

  const openDrawer = (item: PartnershipPipelineItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  return (
    <MainLayout
      title="Partnership Development"
      subtitle="Track strategic partner pipelines, follow-ups, and MOU work items."
      actions={<Badge variant="secondary">{pipelineItems.length} active records</Badge>}
    >
      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <Card>
            <CardHeader>
              <CardTitle>Partnership pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <PartnershipsPipelineBoard items={pipelineItems} stages={pipelineStages} onSelect={openDrawer} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="partners">
          <Card>
            <CardHeader>
              <CardTitle>Partners</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Primary contact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partners && partners.length > 0 ? (
                    partners.map((partner) => (
                      <TableRow key={partner.id}>
                        <TableCell className="font-medium">{partner.name}</TableCell>
                        <TableCell>{partner.type || "—"}</TableCell>
                        <TableCell>{partner.region || "—"}</TableCell>
                        <TableCell>{partner.status || "—"}</TableCell>
                        <TableCell>{partner.primary_contact || "—"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                        No partners yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PartnershipRecordDrawer open={drawerOpen} onOpenChange={setDrawerOpen} item={selectedItem} />
    </MainLayout>
  );
}
