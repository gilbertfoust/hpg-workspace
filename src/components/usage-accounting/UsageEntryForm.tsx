import { useState } from "react";
import { useUsageEntries } from "@/hooks/useUsageEntries";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useUsageSources } from "@/hooks/useUsageSources";
import { useFiscalPeriods } from "@/hooks/useFiscalPeriods";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const UNIT_TYPES = ["hours", "units", "licenses", "miles", "days", "amount", "other"];

interface UsageEntryFormProps {
  defaultNgoId?: string;
  defaultFiscalPeriodId?: string;
}

export function UsageEntryForm({ defaultNgoId, defaultFiscalPeriodId }: UsageEntryFormProps) {
  const { user } = useAuth();
  const { data: costCenters = [] } = useCostCenters();
  const { data: sources = [] } = useUsageSources();
  const { data: periods = [] } = useFiscalPeriods();
  const { create } = useUsageEntries();
  const [open, setOpen] = useState(false);

  const [form, setForm] = useState({
    ngo_id: defaultNgoId || null as string | null,
    fiscal_period_id: defaultFiscalPeriodId || "",
    cost_center_id: "",
    usage_source_id: "",
    quantity: 0,
    unit_type: "hours",
    unit_cost: 0,
    total_cost: 0,
    usage_date: new Date().toISOString().split("T")[0],
    description: "",
    source_reference_type: null as string | null,
    source_reference_id: null as string | null,
    submitted_by_user_id: user?.id || null,
    status: "draft" as string,
  });

  const updateCalc = (qty: number, unitCost: number) => {
    setForm(f => ({ ...f, quantity: qty, unit_cost: unitCost, total_cost: qty * unitCost }));
  };

  const handleCreate = () => {
    create.mutate(form, {
      onSuccess: () => {
        setOpen(false);
        setForm(f => ({ ...f, cost_center_id: "", usage_source_id: "", quantity: 0, unit_cost: 0, total_cost: 0, description: "" }));
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Log Usage</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Log Usage Entry</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fiscal Period</Label>
              <Select value={form.fiscal_period_id} onValueChange={v => setForm(f => ({ ...f, fiscal_period_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                <SelectContent>{periods.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Usage Date</Label>
              <Input type="date" value={form.usage_date} onChange={e => setForm(f => ({ ...f, usage_date: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Cost Center</Label>
            <Select value={form.cost_center_id} onValueChange={v => setForm(f => ({ ...f, cost_center_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select cost center" /></SelectTrigger>
              <SelectContent>{costCenters.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.code} — {cc.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Usage Source</Label>
            <Select value={form.usage_source_id} onValueChange={v => setForm(f => ({ ...f, usage_source_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>{sources.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.type})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Quantity</Label>
              <Input type="number" min={0} value={form.quantity} onChange={e => updateCalc(Number(e.target.value), form.unit_cost)} />
            </div>
            <div>
              <Label>Unit Type</Label>
              <Select value={form.unit_type} onValueChange={v => setForm(f => ({ ...f, unit_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNIT_TYPES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unit Cost ($)</Label>
              <Input type="number" min={0} step={0.01} value={form.unit_cost} onChange={e => updateCalc(form.quantity, Number(e.target.value))} />
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            Total: <span className="font-semibold text-foreground">${form.total_cost.toFixed(2)}</span>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe this usage entry…" />
          </div>
          <Button onClick={handleCreate} disabled={!form.fiscal_period_id || !form.cost_center_id || !form.usage_source_id || create.isPending} className="w-full">
            {create.isPending ? "Saving…" : "Log Usage Entry"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
