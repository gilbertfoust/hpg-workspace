import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAssetMaintenance } from "@/hooks/useAssetMaintenance";
import { useAssets } from "@/hooks/useAssets";
import { MAINTENANCE_TYPES, MAINTENANCE_STATUSES } from "@/modules/assets/types";
import { Plus, Wrench } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  canceled: "bg-muted text-muted-foreground",
};

export default function Maintenance() {
  const { data: records, isLoading, create, updateStatus } = useAssetMaintenance();
  const { data: assets } = useAssets();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ asset_id: "", description: "", maintenance_type: "preventive", scheduled_date: "", cost: "", notes: "" });

  const handleCreate = () => {
    if (!form.asset_id || !form.description) return;
    const asset = assets?.find(a => a.id === form.asset_id);
    if (!asset) return;
    create.mutate(
      { asset_id: form.asset_id, ngo_id: asset.ngo_id, description: form.description, maintenance_type: form.maintenance_type, scheduled_date: form.scheduled_date || undefined, cost: form.cost ? Number(form.cost) : undefined, notes: form.notes || undefined },
      { onSuccess: () => { setDialogOpen(false); setForm({ asset_id: "", description: "", maintenance_type: "preventive", scheduled_date: "", cost: "", notes: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Maintenance</h1>
            <p className="text-muted-foreground">Schedule and track asset maintenance</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />New Work Order</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Maintenance Work Order</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Asset *</Label>
                  <Select value={form.asset_id} onValueChange={v => setForm(f => ({ ...f, asset_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                    <SelectContent>{assets?.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Description *</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select value={form.maintenance_type} onValueChange={v => setForm(f => ({ ...f, maintenance_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MAINTENANCE_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Scheduled Date</Label><Input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} /></div>
                </div>
                <div><Label>Estimated Cost</Label><Input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} /></div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <Button onClick={handleCreate} disabled={!form.asset_id || !form.description || create.isPending} className="w-full">Create Work Order</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !records?.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No maintenance records</TableCell></TableRow>
                ) : records.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{(m as any).assets?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{m.description}</TableCell>
                    <TableCell><Badge variant="outline">{m.maintenance_type}</Badge></TableCell>
                    <TableCell className="text-sm">{m.scheduled_date ?? "—"}</TableCell>
                    <TableCell className="text-sm">{m.cost != null ? `$${Number(m.cost).toLocaleString()}` : "—"}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[m.status] ?? ""}>{m.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>
                      <Select value={m.status} onValueChange={v => updateStatus.mutate({ id: m.id, status: v, completed_date: v === "completed" ? new Date().toISOString().split("T")[0] : undefined })}>
                        <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{MAINTENANCE_STATUSES.map(st => <SelectItem key={st} value={st}>{st.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
