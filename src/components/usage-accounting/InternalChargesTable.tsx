import { useState } from "react";
import { useInternalCharges } from "@/hooks/useInternalCharges";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  approved: "bg-green-100 text-green-800",
  posted: "bg-purple-100 text-purple-800",
};

export function InternalChargesTable() {
  const { data: charges = [], isLoading, create, updateStatus } = useInternalCharges();
  const { data: costCenters = [] } = useCostCenters();
  const { data: periods = [] } = useFiscalPeriods();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    from_cost_center_id: "",
    to_cost_center_id: "",
    fiscal_period_id: "",
    description: "",
    amount: 0,
    status: "draft" as string,
  });

  const handleCreate = () => {
    create.mutate(form, { onSuccess: () => { setOpen(false); setForm(f => ({ ...f, from_cost_center_id: "", to_cost_center_id: "", description: "", amount: 0 })); } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Internal Charges / Chargebacks</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Charge</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Internal Charge</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Fiscal Period</Label>
                <Select value={form.fiscal_period_id} onValueChange={v => setForm(f => ({ ...f, fiscal_period_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                  <SelectContent>{periods.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>From Cost Center</Label>
                <Select value={form.from_cost_center_id} onValueChange={v => setForm(f => ({ ...f, from_cost_center_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Charging department" /></SelectTrigger>
                  <SelectContent>{costCenters.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.code} — {cc.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>To Cost Center</Label>
                <Select value={form.to_cost_center_id} onValueChange={v => setForm(f => ({ ...f, to_cost_center_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Charged department" /></SelectTrigger>
                  <SelectContent>{costCenters.filter(cc => cc.id !== form.from_cost_center_id).map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.code} — {cc.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Amount ($)</Label><Input type="number" min={0} step={0.01} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <Button onClick={handleCreate} disabled={!form.from_cost_center_id || !form.to_cost_center_id || !form.fiscal_period_id || form.amount <= 0 || create.isPending} className="w-full">
                {create.isPending ? "Creating…" : "Create Charge"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {charges.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No internal charges</TableCell></TableRow>
          ) : (
            charges.map(c => (
              <TableRow key={c.id}>
                <TableCell className="text-sm">{c.from_cc ? `${c.from_cc.code} — ${c.from_cc.name}` : "—"}</TableCell>
                <TableCell className="text-sm">{c.to_cc ? `${c.to_cc.code} — ${c.to_cc.name}` : "—"}</TableCell>
                <TableCell className="text-sm max-w-48 truncate">{c.description}</TableCell>
                <TableCell className="text-right font-mono font-medium">${Number(c.amount).toFixed(2)}</TableCell>
                <TableCell><Badge variant="outline" className={statusColors[c.status] || ""}>{c.status}</Badge></TableCell>
                <TableCell>
                  {c.status === "draft" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: c.id, status: "approved" })}>Approve</Button>
                  )}
                  {c.status === "approved" && (
                    <Button size="sm" onClick={() => updateStatus.mutate({ id: c.id, status: "posted" })}>Post</Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
