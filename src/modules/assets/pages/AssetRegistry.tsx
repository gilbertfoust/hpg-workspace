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
import { useAssets } from "@/hooks/useAssets";
import { useNGOs } from "@/hooks/useNGOs";
import { ASSET_CATEGORIES, ASSET_STATUSES, DEPRECIATION_METHODS } from "@/modules/assets/types";
import { Plus, Search, Package } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  in_storage: "bg-muted text-muted-foreground",
  maintenance: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  disposed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function AssetRegistry() {
  const [search, setSearch] = useState("");
  const { data: assets, isLoading, create, update } = useAssets();
  const { data: ngos } = useNGOs();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", ngo_id: "", category: "equipment", acquisition_date: "", acquisition_cost: "", salvage_value: "0", useful_life_months: "", depreciation_method: "straight_line", location: "", asset_tag: "", serial_number: "" });

  const filtered = assets?.filter(a =>
    `${a.name} ${a.category} ${a.asset_tag || ""} ${a.location || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = () => {
    if (!form.name || !form.ngo_id) return;
    create.mutate(
      { name: form.name, ngo_id: form.ngo_id, category: form.category, acquisition_date: form.acquisition_date || undefined, acquisition_cost: form.acquisition_cost ? Number(form.acquisition_cost) : undefined, salvage_value: form.salvage_value ? Number(form.salvage_value) : undefined, useful_life_months: form.useful_life_months ? Number(form.useful_life_months) : undefined, depreciation_method: form.depreciation_method, location: form.location || undefined, asset_tag: form.asset_tag || undefined, serial_number: form.serial_number || undefined },
      { onSuccess: () => { setDialogOpen(false); setForm({ name: "", ngo_id: "", category: "equipment", acquisition_date: "", acquisition_cost: "", salvage_value: "0", useful_life_months: "", depreciation_method: "straight_line", location: "", asset_tag: "", serial_number: "" }); } }
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Asset Registry</h1>
            <p className="text-muted-foreground">Complete inventory of organizational assets</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Asset</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>New Asset</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div>
                  <Label>NGO *</Label>
                  <Select value={form.ngo_id} onValueChange={v => setForm(f => ({ ...f, ngo_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                    <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ASSET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Depreciation Method</Label>
                    <Select value={form.depreciation_method} onValueChange={v => setForm(f => ({ ...f, depreciation_method: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{DEPRECIATION_METHODS.map(m => <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>Acquisition Cost</Label><Input type="number" value={form.acquisition_cost} onChange={e => setForm(f => ({ ...f, acquisition_cost: e.target.value }))} /></div>
                  <div><Label>Salvage Value</Label><Input type="number" value={form.salvage_value} onChange={e => setForm(f => ({ ...f, salvage_value: e.target.value }))} /></div>
                  <div><Label>Life (months)</Label><Input type="number" value={form.useful_life_months} onChange={e => setForm(f => ({ ...f, useful_life_months: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Acquisition Date</Label><Input type="date" value={form.acquisition_date} onChange={e => setForm(f => ({ ...f, acquisition_date: e.target.value }))} /></div>
                  <div><Label>Location</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Asset Tag</Label><Input value={form.asset_tag} onChange={e => setForm(f => ({ ...f, asset_tag: e.target.value }))} /></div>
                  <div><Label>Serial Number</Label><Input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} /></div>
                </div>
                <Button onClick={handleCreate} disabled={!form.name || !form.ngo_id || create.isPending} className="w-full">Add Asset</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>NGO</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : !filtered?.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No assets found</TableCell></TableRow>
                ) : filtered.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{a.name}</p>
                          {a.asset_tag && <p className="text-xs text-muted-foreground">{a.asset_tag}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{(a as any).ngos?.common_name || (a as any).ngos?.legal_name || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{a.category}</Badge></TableCell>
                    <TableCell className="text-sm">${Number(a.acquisition_cost).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{a.depreciation_method.replace(/_/g, " ")}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[a.status] ?? ""}>{a.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>
                      <Select value={a.status} onValueChange={v => update.mutate({ id: a.id, status: v })}>
                        <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{ASSET_STATUSES.map(st => <SelectItem key={st} value={st}>{st.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
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
