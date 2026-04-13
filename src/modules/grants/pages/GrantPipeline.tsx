import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGrantApplications } from "@/hooks/useGrantApplications";
import { useNGOs } from "@/hooks/useNGOs";
import { useGrantOpportunities } from "@/hooks/useGrantOpportunities";
import { GRANT_STAGES } from "@/modules/grants/types";
import { GrantPipelineKanban } from "@/components/grants/GrantPipelineKanban";
import { GrantsByNGOView } from "@/components/grants/GrantsByNGOView";
import { GrantPortalsPanel } from "@/components/grants/GrantPortalsPanel";
import { GrantSeedButton } from "@/components/grants/GrantSeedButton";
import { Plus, Kanban, Building2, Globe } from "lucide-react";

export default function GrantPipeline() {
  const { data: applications, isLoading, create, updateStage } = useGrantApplications();
  const { data: ngos } = useNGOs();
  const { data: opportunities } = useGrantOpportunities();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", ngo_id: "", opportunity_id: "", amount_requested: "", notes: "" });

  const handleCreate = () => {
    if (!form.title || !form.ngo_id) return;
    create.mutate(
      {
        title: form.title,
        ngo_id: form.ngo_id,
        opportunity_id: form.opportunity_id || undefined,
        amount_requested: form.amount_requested ? Number(form.amount_requested) : undefined,
        notes: form.notes || undefined,
        stage: "prospect",
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setForm({ title: "", ngo_id: "", opportunity_id: "", amount_requested: "", notes: "" });
        },
      }
    );
  };

  const handleStageChange = useCallback(
    (id: string, stage: string) => {
      updateStage.mutate({ id, stage });
    },
    [updateStage]
  );

  const activeCount = applications?.filter((a) => !["closed", "declined"].includes(a.stage)).length ?? 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Grant Pipeline</h1>
            <p className="text-muted-foreground">
              Track grants from identification through award and reporting
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{activeCount} active</Badge>
            <GrantSeedButton ngos={ngos ?? []} existingCount={applications?.length ?? 0} />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  New Grant
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Track New Grant</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Grant / Funder Name</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. Rotary Foundation – Global Grants"
                    />
                  </div>
                  <div>
                    <Label>Assign to NGO</Label>
                    <Select value={form.ngo_id} onValueChange={(v) => setForm((f) => ({ ...f, ngo_id: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select NGO" />
                      </SelectTrigger>
                      <SelectContent>
                        {ngos?.map((n) => (
                          <SelectItem key={n.id} value={n.id}>
                            {n.common_name || n.legal_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {opportunities && opportunities.length > 0 && (
                    <div>
                      <Label>Link to Opportunity (optional)</Label>
                      <Select value={form.opportunity_id} onValueChange={(v) => setForm((f) => ({ ...f, opportunity_id: v }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select opportunity" />
                        </SelectTrigger>
                        <SelectContent>
                          {opportunities.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>Amount Requested</Label>
                    <Input
                      type="number"
                      value={form.amount_requested}
                      onChange={(e) => setForm((f) => ({ ...f, amount_requested: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Focus area, program alignment, etc."
                    />
                  </div>
                  <Button
                    onClick={handleCreate}
                    disabled={!form.title || !form.ngo_id || create.isPending}
                    className="w-full"
                  >
                    Add to Pipeline
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading pipeline...</p>
        ) : (
          <Tabs defaultValue="kanban" className="space-y-4">
            <TabsList>
              <TabsTrigger value="kanban" className="flex items-center gap-1.5">
                <Kanban className="h-3.5 w-3.5" />
                By Stage
              </TabsTrigger>
              <TabsTrigger value="ngo" className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                By NGO
              </TabsTrigger>
              <TabsTrigger value="portals" className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Search Portals
              </TabsTrigger>
            </TabsList>

            <TabsContent value="kanban">
              {applications && applications.length > 0 ? (
                <GrantPipelineKanban
                  applications={applications as any}
                  onStageChange={handleStageChange}
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No grants in the pipeline yet.</p>
                  <p className="text-sm mt-1">
                    Click "New Grant" to start tracking, or import from Trello.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ngo">
              <GrantsByNGOView
                applications={(applications as any) ?? []}
                ngos={(ngos as any) ?? []}
              />
            </TabsContent>

            <TabsContent value="portals">
              <GrantPortalsPanel />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}
