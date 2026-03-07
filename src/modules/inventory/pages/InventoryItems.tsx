import { useState } from "react";
import { useInventoryItems } from "@/hooks/useInventoryItems";
import { useNGOs } from "@/hooks/useNGOs";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { INVENTORY_CATEGORIES } from "../types";

export default function InventoryItems() {
  const { data: items, isLoading, create } = useInventoryItems();
  const { data: ngos } = useNGOs();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", ngo_id: "", category: "general", sku: "", unit_of_measure: "each", quantity_on_hand: 0, reorder_point: 0, unit_cost: 0, location: "" });

  const filtered = (items ?? []).filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || (i.sku ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || i.category === catFilter;
    return matchSearch && matchCat;
  });

  const handleCreate = () => {
    if (!form.name || !form.ngo_id) return;
    create.mutate({ ...form, quantity_on_hand: Number(form.quantity_on_hand), reorder_point: Number(form.reorder_point), unit_cost: Number(form.unit_cost) }, {
      onSuccess: () => { setOpen(false); setForm({ name: "", ngo_id: "", category: "general", sku: "", unit_of_measure: "each", quantity_on_hand: 0, reorder_point: 0, unit_cost: 0, location: "" }); },
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory Items</h1>
            <p className="text-muted-foreground">Catalog of all tracked items</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Item</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Inventory Item</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>NGO *</Label>
                  <Select value={form.ngo_id} onValueChange={v => setForm(p => ({ ...p, ngo_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                    <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{INVENTORY_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>SKU</Label>
                    <Input value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>Qty on Hand</Label>
                    <Input type="number" value={form.quantity_on_hand} onChange={e => setForm(p => ({ ...p, quantity_on_hand: +e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Reorder Point</Label>
                    <Input type="number" value={form.reorder_point} onChange={e => setForm(p => ({ ...p, reorder_point: +e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Unit Cost</Label>
                    <Input type="number" step="0.01" value={form.unit_cost} onChange={e => setForm(p => ({ ...p, unit_cost: +e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Location</Label>
                  <Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
                </div>
                <Button onClick={handleCreate} disabled={create.isPending}>{create.isPending ? "Saving…" : "Create Item"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search items…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {INVENTORY_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Reorder Pt</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>NGO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No items found</TableCell></TableRow>
                ) : filtered.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="font-mono text-xs">{item.sku ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{item.category.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={item.reorder_point && item.quantity_on_hand <= item.reorder_point ? "text-destructive font-bold" : ""}>
                        {item.quantity_on_hand}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{item.reorder_point ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">${item.unit_cost.toFixed(2)}</TableCell>
                    <TableCell>{item.location ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{(item as any).ngos?.common_name || (item as any).ngos?.legal_name || "—"}</TableCell>
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
