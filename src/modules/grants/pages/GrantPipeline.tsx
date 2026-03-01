import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useGrantApplications } from "@/hooks/useGrantApplications";
import { useNGOs } from "@/hooks/useNGOs";
import { GRANT_STAGES } from "@/modules/grants/types";
import { Plus, DollarSign, Building2, User } from "lucide-react";
import { format } from "date-fns";

const STAGE_COLORS: Record<string, string> = {
  prospect: "bg-muted text-muted-foreground",
  researching: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  writing: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  under_review: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  awarded: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  declined: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  reporting: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  closed: "bg-muted text-muted-foreground",
};

export default function GrantPipeline() {
  const { data: applications, isLoading, create, updateStage } = useGrantApplications();
  const { data: ngos } = useNGOs();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", ngo_id: "", amount_requested: "", notes: "" });

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
            <p className="text-muted-foreground">Track applications from prospect to close</p>
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
        ) : (
          <div className="space-y-6">
            {GRANT_STAGES.map(stage => {
              const items = applications?.filter(a => a.stage === stage) ?? [];
              if (items.length === 0) return null;
              return (
                <div key={stage}>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Badge className={STAGE_COLORS[stage]}>{stage.replace(/_/g, " ")}</Badge>
                    <span className="text-muted-foreground">({items.length})</span>
                  </h3>
                  <div className="grid gap-3">
                    {items.map(app => (
                      <Card key={app.id}>
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{app.title}</p>
                              <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                                {(app as any).ngos && (
                                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{(app as any).ngos.common_name || (app as any).ngos.legal_name}</span>
                                )}
                                {app.amount_requested && (
                                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${app.amount_requested.toLocaleString()}</span>
                                )}
                                {(app as any).profiles?.full_name && (
                                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{(app as any).profiles.full_name}</span>
                                )}
                              </div>
                            </div>
                            <Select value={app.stage} onValueChange={v => updateStage.mutate({ id: app.id, stage: v })}>
                              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {GRANT_STAGES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
            {(!applications || applications.length === 0) && (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No applications yet. Click "New Application" to get started.</CardContent></Card>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
