import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAssetDepreciation } from "@/hooks/useAssetDepreciation";
import { useAssets } from "@/hooks/useAssets";
import { Plus, TrendingDown } from "lucide-react";
import { format } from "date-fns";

export default function Depreciation() {
  const { data: records, isLoading, create } = useAssetDepreciation();
  const { data: assets } = useAssets({ status: "active" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ asset_id: "", period_label: "", period_date: "", depreciation_amount: "", accumulated_depreciation: "", book_value: "" });

  const selectedAsset = assets?.find(a => a.id === form.asset_id);

  const handleCreate = () => {
    if (!form.asset_id || !form.period_label || !form.period_date || !form.depreciation_amount) return;
    const asset = assets?.find(a => a.id === form.asset_id);
    if (!asset) return;
    create.mutate(
      { asset_id: form.asset_id, ngo_id: asset.ngo_id, period_label: form.period_label, period_date: form.period_date, depreciation_amount: Number(form.depreciation_amount), accumulated_depreciation: Number(form.accumulated_depreciation) || 0, book_value: Number(form.book_value) || 0 },
      { onSuccess: () => { setDialogOpen(false); setForm({ asset_id: "", period_label: "", period_date: "", depreciation_amount: "", accumulated_depreciation: "", book_value: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Depreciation</h1>
            <p className="text-muted-foreground">Calculate and record asset depreciation</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Record Depreciation</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Depreciation Entry</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Asset *</Label>
                  <Select value={form.asset_id} onValueChange={v => setForm(f => ({ ...f, asset_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                    <SelectContent>{assets?.map(a => <SelectItem key={a.id} value={a.id}>{a.name} (${Number(a.acquisition_cost).toLocaleString()})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Period Label *</Label><Input placeholder="e.g. Q1 2026" value={form.period_label} onChange={e => setForm(f => ({ ...f, period_label: e.target.value }))} /></div>
                  <div><Label>Period Date *</Label><Input type="date" value={form.period_date} onChange={e => setForm(f => ({ ...f, period_date: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>Depreciation Amt *</Label><Input type="number" value={form.depreciation_amount} onChange={e => setForm(f => ({ ...f, depreciation_amount: e.target.value }))} /></div>
                  <div><Label>Accumulated</Label><Input type="number" value={form.accumulated_depreciation} onChange={e => setForm(f => ({ ...f, accumulated_depreciation: e.target.value }))} /></div>
                  <div><Label>Book Value</Label><Input type="number" value={form.book_value} onChange={e => setForm(f => ({ ...f, book_value: e.target.value }))} /></div>
                </div>
                <Button onClick={handleCreate} disabled={!form.asset_id || !form.period_label || !form.period_date || !form.depreciation_amount || create.isPending} className="w-full">Record Entry</Button>
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
                  <TableHead>Period</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Depreciation</TableHead>
                  <TableHead>Accumulated</TableHead>
                  <TableHead>Book Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !records?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No depreciation records</TableCell></TableRow>
                ) : records.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{(r as any).assets?.name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{r.period_label}</Badge></TableCell>
                    <TableCell className="text-sm">{format(new Date(r.period_date), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-sm text-destructive">-${Number(r.depreciation_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">${Number(r.accumulated_depreciation).toLocaleString()}</TableCell>
                    <TableCell className="text-sm font-medium">${Number(r.book_value).toLocaleString()}</TableCell>
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
