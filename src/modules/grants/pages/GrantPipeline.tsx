import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useGrantApplications } from "@/hooks/useGrantApplications";
import { useNGOs } from "@/hooks/useNGOs";
import { GRANT_STAGES } from "@/modules/grants/types";
import { Plus, DollarSign, Building2, User } from "lucide-react";
import { DnDKanbanBoard, KanbanColumn } from "@/components/common/DnDKanbanBoard";
import { useMemo } from "react";

const STAGE_BORDER_COLORS: Record<string, string> = {
  prospect: "border-l-muted-foreground",
  researching: "border-l-blue-400",
  writing: "border-l-indigo-400",
  submitted: "border-l-yellow-400",
  under_review: "border-l-orange-400",
  awarded: "border-l-green-400",
  declined: "border-l-red-400",
  reporting: "border-l-purple-400",
  closed: "border-l-muted-foreground",
};

export default function GrantPipeline() {
  const { data: applications, isLoading, create, updateStage } = useGrantApplications();
  const { data: ngos } = useNGOs();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", ngo_id: "", amount_requested: "", notes: "" });

  const columns: KanbanColumn<any>[] = useMemo(() => {
    return GRANT_STAGES.map((stage) => ({
      id: stage,
      label: stage.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      colorClass: STAGE_BORDER_COLORS[stage],
      items: applications?.filter((a) => a.stage === stage) ?? [],
    }));
  }, [applications]);

  const handleDrop = (appId: string, targetStage: string) => {
    updateStage.mutate({ id: appId, stage: targetStage });
  };

  const handleCreate = () => {
    if (!form.title || !form.ngo_id) return;
    create.mutate(
      { title: form.title, ngo_id: form.ngo_id, amount_requested: form.amount_requested ? Number(form.amount_requested) : undefined, notes: form.notes || undefined },
      { onSuccess: () => { setDialogOpen(false); setForm({ title: "", ngo_id: "", amount_requested: "", notes: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Grant Pipeline</h1>
            <p className="text-muted-foreground">Drag cards between columns to update stage</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Application</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Grant Application</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Title</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div>
                  <Label>NGO</Label>
                  <Select value={form.ngo_id} onValueChange={v => setForm(f => ({ ...f, ngo_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                    <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Amount Requested</Label><Input type="number" value={form.amount_requested} onChange={e => setForm(f => ({ ...f, amount_requested: e.target.value }))} /></div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <Button onClick={handleCreate} disabled={!form.title || !form.ngo_id || create.isPending} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading pipeline...</p>
        ) : (!applications || applications.length === 0) ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No applications yet. Click "New Application" to get started.</CardContent></Card>
        ) : (
          <ScrollArea className="w-full">
            <DnDKanbanBoard
              columns={columns}
              getItemId={(app) => app.id}
              onDrop={handleDrop}
              columnWidth={220}
              renderCard={(app, columnId) => (
                <Card className={`border-l-4 ${STAGE_BORDER_COLORS[columnId] || ""} cursor-grab hover:bg-accent/50 transition-colors`}>
                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate">{app.title}</p>
                    <div className="flex flex-col gap-1 mt-1 text-xs text-muted-foreground">
                      {app.ngos && (
                        <span className="flex items-center gap-1 truncate"><Building2 className="h-3 w-3 flex-shrink-0" />{app.ngos.common_name || app.ngos.legal_name}</span>
                      )}
                      {app.amount_requested && (
                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3 flex-shrink-0" />${app.amount_requested.toLocaleString()}</span>
                      )}
                      {app.profiles?.full_name && (
                        <span className="flex items-center gap-1 truncate"><User className="h-3 w-3 flex-shrink-0" />{app.profiles.full_name}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            />
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>
    </MainLayout>
  );
}
