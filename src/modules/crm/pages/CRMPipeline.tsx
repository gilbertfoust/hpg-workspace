import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCRMDeals } from "@/hooks/useCRMDeals";
import { useCRMOrganizations } from "@/hooks/useCRMOrganizations";
import { DEAL_STAGES, DEAL_TYPES } from "@/modules/crm/types";
import { Plus, DollarSign, Building2, Calendar } from "lucide-react";
import { format } from "date-fns";

const STAGE_COLORS: Record<string, string> = {
  lead: "bg-muted text-muted-foreground",
  qualified: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  proposal: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  negotiation: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  committed: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  won: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  closed: "bg-muted text-muted-foreground",
};

export default function CRMPipeline() {
  const { data: deals, isLoading, create, updateStage } = useCRMDeals();
  const { data: orgs } = useCRMOrganizations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", deal_type: "donation", organization_id: "", amount: "", expected_close_date: "", notes: "" });

  const handleCreate = () => {
    if (!form.title) return;
    create.mutate(
      { title: form.title, deal_type: form.deal_type, organization_id: form.organization_id || undefined, amount: form.amount ? Number(form.amount) : undefined, expected_close_date: form.expected_close_date || undefined, notes: form.notes || undefined },
      { onSuccess: () => { setDialogOpen(false); setForm({ title: "", deal_type: "donation", organization_id: "", amount: "", expected_close_date: "", notes: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Deal Pipeline</h1>
            <p className="text-muted-foreground">Track donations, grants, partnerships, and contracts</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Deal</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Deal</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.deal_type} onValueChange={v => setForm(f => ({ ...f, deal_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DEAL_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
                </div>
                <div>
                  <Label>Organization</Label>
                  <Select value={form.organization_id} onValueChange={v => setForm(f => ({ ...f, organization_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger>
                    <SelectContent>{orgs?.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Expected Close Date</Label><Input type="date" value={form.expected_close_date} onChange={e => setForm(f => ({ ...f, expected_close_date: e.target.value }))} /></div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <Button onClick={handleCreate} disabled={!form.title || create.isPending} className="w-full">Create Deal</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading pipeline...</p>
        ) : (
          <div className="space-y-6">
            {DEAL_STAGES.map(stage => {
              const items = deals?.filter(d => d.stage === stage) ?? [];
              if (items.length === 0) return null;
              const stageTotal = items.reduce((s, d) => s + (d.amount ?? 0), 0);
              return (
                <div key={stage}>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Badge className={STAGE_COLORS[stage]}>{stage}</Badge>
                    <span className="text-muted-foreground">({items.length})</span>
                    {stageTotal > 0 && <span className="text-muted-foreground text-xs ml-auto">${stageTotal.toLocaleString()}</span>}
                  </h3>
                  <div className="grid gap-3">
                    {items.map(deal => (
                      <Card key={deal.id}>
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{deal.title}</p>
                              <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-xs">{deal.deal_type}</Badge>
                                {(deal as any).crm_organizations?.name && (
                                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{(deal as any).crm_organizations.name}</span>
                                )}
                                {deal.amount && (
                                  <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />${deal.amount.toLocaleString()}</span>
                                )}
                                {deal.expected_close_date && (
                                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(deal.expected_close_date), "MMM d, yyyy")}</span>
                                )}
                                {deal.probability != null && <span>{deal.probability}% probability</span>}
                              </div>
                            </div>
                            <Select value={deal.stage} onValueChange={v => updateStage.mutate({ id: deal.id, stage: v })}>
                              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{DEAL_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
            {(!deals || deals.length === 0) && (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No deals yet. Click "New Deal" to get started.</CardContent></Card>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
