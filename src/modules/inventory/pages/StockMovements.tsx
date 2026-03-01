import { useState } from "react";
import { useStockMovements } from "@/hooks/useStockMovements";
import { useInventoryItems } from "@/hooks/useInventoryItems";
import { useNGOs } from "@/hooks/useNGOs";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search } from "lucide-react";
import { MOVEMENT_TYPES } from "../types";
import { format } from "date-fns";

const typeColors: Record<string, string> = {
  in: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  out: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  transfer: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  adjustment: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  return: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export default function StockMovements() {
  const { data: movements, isLoading, create } = useStockMovements();
  const { data: items } = useInventoryItems();
  const { data: ngos } = useNGOs();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ngo_id: "", item_id: "", movement_type: "in", quantity: 1, reference_number: "", notes: "" });

  const filtered = (movements ?? []).filter(m => {
    const matchSearch = (m as any).inventory_items?.name?.toLowerCase().includes(search.toLowerCase()) || (m.reference_number ?? "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || m.movement_type === typeFilter;
    return matchSearch && matchType;
  });

  const handleCreate = () => {
    if (!form.ngo_id || !form.item_id || !form.quantity) return;
    create.mutate({ ...form, quantity: Number(form.quantity) }, {
      onSuccess: () => { setOpen(false); setForm({ ngo_id: "", item_id: "", movement_type: "in", quantity: 1, reference_number: "", notes: "" }); },
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stock Movements</h1>
            <p className="text-muted-foreground">Track incoming, outgoing, and transfer movements</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Record Movement</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Stock Movement</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>NGO *</Label>
                  <Select value={form.ngo_id} onValueChange={v => setForm(p => ({ ...p, ngo_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select NGO" /></SelectTrigger>
                    <SelectContent>{ngos?.map(n => <SelectItem key={n.id} value={n.id}>{n.common_name || n.legal_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Item *</Label>
                  <Select value={form.item_id} onValueChange={v => setForm(p => ({ ...p, item_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>{items?.filter(i => !form.ngo_id || i.ngo_id === form.ngo_id).map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Type *</Label>
                    <Select value={form.movement_type} onValueChange={v => setForm(p => ({ ...p, movement_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MOVEMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Quantity *</Label>
                    <Input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: +e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Reference #</Label>
                  <Input value={form.reference_number} onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
                <Button onClick={handleCreate} disabled={create.isPending}>{create.isPending ? "Saving…" : "Record Movement"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by item or reference…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {MOVEMENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No movements found</TableCell></TableRow>
                ) : filtered.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{format(new Date(m.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                    <TableCell className="font-medium">{(m as any).inventory_items?.name ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeColors[m.movement_type] ?? ""}`}>
                        {m.movement_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{m.quantity}</TableCell>
                    <TableCell className="font-mono text-xs">{m.reference_number ?? "—"}</TableCell>
                    <TableCell className="text-xs">{(m as any).profiles?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{m.notes ?? "—"}</TableCell>
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
