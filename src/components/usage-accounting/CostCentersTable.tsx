import { useState } from "react";
import { useCostCenters, CostCenter } from "@/hooks/useCostCenters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";

const COST_CENTER_TYPES = ["ngo", "department", "program", "grant", "country_hub", "admin", "shared_service"];

const typeColors: Record<string, string> = {
  ngo: "bg-blue-100 text-blue-800",
  department: "bg-purple-100 text-purple-800",
  program: "bg-green-100 text-green-800",
  grant: "bg-amber-100 text-amber-800",
  country_hub: "bg-cyan-100 text-cyan-800",
  admin: "bg-gray-100 text-gray-800",
  shared_service: "bg-rose-100 text-rose-800",
};

export function CostCentersTable() {
  const { data: costCenters = [], isLoading, create } = useCostCenters();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", type: "department" as string, ngo_id: null as string | null, parent_cost_center_id: null as string | null, is_active: true });

  const handleCreate = () => {
    create.mutate(form, { onSuccess: () => { setOpen(false); setForm({ code: "", name: "", type: "department", ngo_id: null, parent_cost_center_id: null, is_active: true }); } });
  };

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Loading cost centers…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Cost Centers</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Cost Center</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Cost Center</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="CC-001" /></div>
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="IT Shared Services" /></div>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COST_CENTER_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Parent Cost Center (optional)</Label>
                <Select value={form.parent_cost_center_id || "none"} onValueChange={v => setForm(f => ({ ...f, parent_cost_center_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {costCenters.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.code} — {cc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={!form.code || !form.name || create.isPending} className="w-full">
                {create.isPending ? "Creating…" : "Create Cost Center"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Parent</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {costCenters.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No cost centers yet</TableCell></TableRow>
          ) : (
            costCenters.map(cc => {
              const parent = costCenters.find(p => p.id === cc.parent_cost_center_id);
              return (
                <TableRow key={cc.id}>
                  <TableCell className="font-mono text-sm">{cc.code}</TableCell>
                  <TableCell className="font-medium">{cc.name}</TableCell>
                  <TableCell><Badge variant="outline" className={typeColors[cc.type] || ""}>{cc.type.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{parent ? `${parent.code} — ${parent.name}` : "—"}</TableCell>
                  <TableCell><Badge variant={cc.is_active ? "default" : "secondary"}>{cc.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
