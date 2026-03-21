import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAccounts, Account } from "@/hooks/useAccounts";
import { Plus, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TYPE_COLORS: Record<string, string> = {
  asset: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  liability: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  equity: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  income: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  expense: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const BS_SECTIONS = [
  { value: "current_asset", label: "Current Asset" },
  { value: "fixed_asset", label: "Fixed Asset" },
  { value: "other_asset", label: "Other Asset" },
  { value: "current_liability", label: "Current Liability" },
  { value: "long_term_liability", label: "Long-Term Liability" },
  { value: "equity", label: "Equity" },
];

const IS_SECTIONS = [
  { value: "revenue", label: "Revenue" },
  { value: "contra_revenue", label: "Contra Revenue" },
  { value: "cogs", label: "Cost of Goods Sold" },
  { value: "operating_expense", label: "Operating Expense" },
  { value: "other_income", label: "Other Income" },
  { value: "other_expense", label: "Other Expense" },
];

const CF_SECTIONS = [
  { value: "operating", label: "Operating" },
  { value: "investing", label: "Investing" },
  { value: "financing", label: "Financing" },
];

interface AccountForm {
  code: string;
  name: string;
  type: string;
  ngo_id: string | null;
  normal_balance: string;
  financial_statement_type: string;
  balance_sheet_section: string;
  income_statement_section: string;
  cash_flow_section: string;
  is_contra_account: boolean;
}

const defaultForm = (ngoId?: string): AccountForm => ({
  code: "", name: "", type: "expense", ngo_id: ngoId || null,
  normal_balance: "", financial_statement_type: "",
  balance_sheet_section: "", income_statement_section: "",
  cash_flow_section: "", is_contra_account: false,
});

interface AccountsTableProps {
  ngoId?: string;
}

export function AccountsTable({ ngoId }: AccountsTableProps) {
  const { data: accounts, isLoading, create, update } = useAccounts(ngoId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountForm>(defaultForm(ngoId));
  const { toast } = useToast();

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm(ngoId));
    setDialogOpen(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setForm({
      code: a.code, name: a.name, type: a.type, ngo_id: a.ngo_id,
      normal_balance: (a as any).normal_balance || "",
      financial_statement_type: (a as any).financial_statement_type || "",
      balance_sheet_section: (a as any).balance_sheet_section || "",
      income_statement_section: (a as any).income_statement_section || "",
      cash_flow_section: (a as any).cash_flow_section || "",
      is_contra_account: (a as any).is_contra_account || false,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const payload: any = {
      code: form.code, name: form.name, type: form.type,
      normal_balance: form.normal_balance || null,
      financial_statement_type: form.financial_statement_type || null,
      balance_sheet_section: form.balance_sheet_section || null,
      income_statement_section: form.income_statement_section || null,
      cash_flow_section: form.cash_flow_section || null,
      is_contra_account: form.is_contra_account,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...payload });
        toast({ title: "Account updated" });
      } else {
        await create.mutateAsync({ ...payload, ngo_id: form.ngo_id, parent_account_id: null, is_active: true });
        toast({ title: "Account created" });
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const showBSSection = form.type === "asset" || form.type === "liability" || form.type === "equity";
  const showISSection = form.type === "income" || form.type === "expense";

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Chart of Accounts</h2>
        <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Add Account</Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Normal Bal</TableHead>
              <TableHead>Statement Section</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : !accounts?.length ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No accounts yet.</TableCell></TableRow>
            ) : (
              accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-sm">{a.code}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell><Badge variant="secondary" className={TYPE_COLORS[a.type]}>{a.type}</Badge></TableCell>
                  <TableCell className="text-xs capitalize">{(a as any).normal_balance || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {(a as any).balance_sheet_section || (a as any).income_statement_section || "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Account" : "New Account"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="1000" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, balance_sheet_section: "", income_statement_section: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asset">Asset</SelectItem>
                    <SelectItem value="liability">Liability</SelectItem>
                    <SelectItem value="equity">Equity</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cash" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Normal Balance</Label>
                <Select value={form.normal_balance} onValueChange={(v) => setForm({ ...form, normal_balance: v })}>
                  <SelectTrigger><SelectValue placeholder="Auto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Statement Type</Label>
                <Select value={form.financial_statement_type} onValueChange={(v) => setForm({ ...form, financial_statement_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balance_sheet">Balance Sheet</SelectItem>
                    <SelectItem value="income_statement">Income Statement</SelectItem>
                    <SelectItem value="cash_flow_support">Cash Flow Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {showBSSection && (
              <div>
                <Label>Balance Sheet Section</Label>
                <Select value={form.balance_sheet_section} onValueChange={(v) => setForm({ ...form, balance_sheet_section: v })}>
                  <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                  <SelectContent>
                    {BS_SECTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showISSection && (
              <div>
                <Label>Income Statement Section</Label>
                <Select value={form.income_statement_section} onValueChange={(v) => setForm({ ...form, income_statement_section: v })}>
                  <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                  <SelectContent>
                    {IS_SECTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Cash Flow Section</Label>
              <Select value={form.cash_flow_section} onValueChange={(v) => setForm({ ...form, cash_flow_section: v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  {CF_SECTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_contra_account} onCheckedChange={(v) => setForm({ ...form, is_contra_account: v })} />
              <Label>Contra Account</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.code || !form.name}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
