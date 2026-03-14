import { useState } from "react";
import { useAllocationRules } from "@/hooks/useAllocationRules";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useAccounts } from "@/hooks/useAccounts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountSelector } from "@/components/finance/AccountSelector";
import { Plus } from "lucide-react";

const BASIS_TYPES = ["hours", "headcount", "units", "flat_percent", "transaction_count", "revenue_share", "square_footage", "custom"];
const TARGET_SCOPES = ["ngo", "program", "grant", "department", "country_hub"];

export function AllocationRuleBuilder() {
  const { data: rules = [], isLoading, create } = useAllocationRules();
  const { data: costCenters = [] } = useCostCenters();
  const { data: accounts = [] } = useAccounts();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    basis_type: "hours",
    source_cost_center_id: null as string | null,
    target_scope_type: "ngo",
    rule_config_json: {} as Record<string, any>,
    offset_account_id: null as string | null,
    expense_account_id: null as string | null,
    effective_start_date: new Date().toISOString().split("T")[0],
    effective_end_date: null as string | null,
    is_active: true,
  });

  const handleCreate = () => {
    create.mutate(form, {
      onSuccess: () => { setOpen(false); setForm(f => ({ ...f, name: "", source_cost_center_id: null })); },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Allocation Rules</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Rule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Allocation Rule</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Rule Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="IT Cost Allocation" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Basis Type</Label>
                  <Select value={form.basis_type} onValueChange={v => setForm(f => ({ ...f, basis_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{BASIS_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Target Scope</Label>
                  <Select value={form.target_scope_type} onValueChange={v => setForm(f => ({ ...f, target_scope_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TARGET_SCOPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Source Cost Center</Label>
                <Select value={form.source_cost_center_id || "none"} onValueChange={v => setForm(f => ({ ...f, source_cost_center_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (all)</SelectItem>
                    {costCenters.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.code} — {cc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expense Account (debit)</Label>
                <AccountSelector accounts={accounts} value={form.expense_account_id || undefined} onValueChange={v => setForm(f => ({ ...f, expense_account_id: v }))} placeholder="Select expense account" />
              </div>
              <div>
                <Label>Offset Account (credit)</Label>
                <AccountSelector accounts={accounts} value={form.offset_account_id || undefined} onValueChange={v => setForm(f => ({ ...f, offset_account_id: v }))} placeholder="Select offset account" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Start Date</Label><Input type="date" value={form.effective_start_date} onChange={e => setForm(f => ({ ...f, effective_start_date: e.target.value }))} /></div>
                <div><Label>End Date (opt)</Label><Input type="date" value={form.effective_end_date || ""} onChange={e => setForm(f => ({ ...f, effective_end_date: e.target.value || null }))} /></div>
              </div>
              <Button onClick={handleCreate} disabled={!form.name || create.isPending} className="w-full">
                {create.isPending ? "Creating…" : "Create Rule"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Basis</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Target Scope</TableHead>
            <TableHead>Effective</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No allocation rules</TableCell></TableRow>
          ) : (
            rules.map(r => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell><Badge variant="outline">{r.basis_type.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell className="text-sm">{r.cost_centers ? `${r.cost_centers.code} — ${r.cost_centers.name}` : "All"}</TableCell>
                <TableCell><Badge variant="secondary">{r.target_scope_type}</Badge></TableCell>
                <TableCell className="text-sm">{r.effective_start_date}{r.effective_end_date ? ` → ${r.effective_end_date}` : " → ongoing"}</TableCell>
                <TableCell><Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge></TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
