import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type {
  FinanceAccount,
  FinanceAccountInput,
  FinanceAccountType,
  FinanceEntityScope,
  FinanceExpenseFunctionalClass,
  FinanceRevenueRestrictionClass,
} from "@/types/financeAccounting";
import {
  FINANCE_ACCOUNT_TYPE_LABELS,
  FINANCE_ENTITY_SCOPE_LABELS,
  FINANCE_FUNCTIONAL_LABELS,
  FINANCE_RESTRICTION_LABELS,
  defaultNormalBalanceForType,
} from "@/types/financeAccounting";

interface FinanceAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: FinanceAccount | null;
  parentOptions: FinanceAccount[];
  onSave: (input: FinanceAccountInput) => Promise<void>;
  isSaving?: boolean;
}

export function FinanceAccountDialog({
  open,
  onOpenChange,
  account,
  parentOptions,
  onSave,
  isSaving,
}: FinanceAccountDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<FinanceAccountType>("asset");
  const [accountSubtype, setAccountSubtype] = useState("");
  const [parentAccountId, setParentAccountId] = useState<string>("none");
  const [normalBalance, setNormalBalance] = useState<"debit" | "credit">("debit");
  const [isActive, setIsActive] = useState(true);
  const [isCashAccount, setIsCashAccount] = useState(false);
  const [entityScope, setEntityScope] = useState<FinanceEntityScope>("hpg_operating");
  const [revenueRestriction, setRevenueRestriction] = useState<string>("none");
  const [expenseFunctional, setExpenseFunctional] = useState<string>("none");
  const [form990Line, setForm990Line] = useState("");
  const [statementLine, setStatementLine] = useState("");

  useEffect(() => {
    if (!open) return;
    if (account) {
      setCode(account.code);
      setName(account.name);
      setAccountType(account.account_type);
      setAccountSubtype(account.account_subtype || "");
      setParentAccountId(account.parent_account_id || "none");
      setNormalBalance(account.normal_balance);
      setIsActive(account.is_active);
      setIsCashAccount(account.is_cash_account ?? false);
      setEntityScope(account.entity_scope ?? "hpg_operating");
      setRevenueRestriction(account.revenue_restriction_class ?? "none");
      setExpenseFunctional(account.expense_functional_class ?? "none");
      setForm990Line(account.form_990_line ?? "");
      setStatementLine(account.financial_statement_line ?? "");
    } else {
      setCode("");
      setName("");
      setAccountType("asset");
      setAccountSubtype("");
      setParentAccountId("none");
      setNormalBalance("debit");
      setIsActive(true);
      setIsCashAccount(false);
      setEntityScope("hpg_operating");
      setRevenueRestriction("none");
      setExpenseFunctional("none");
      setForm990Line("");
      setStatementLine("");
    }
  }, [open, account]);

  const handleTypeChange = (type: FinanceAccountType) => {
    setAccountType(type);
    if (!account) {
      setNormalBalance(defaultNormalBalanceForType(type));
    }
  };

  const handleSubmit = async () => {
    await onSave({
      code: code.trim(),
      name: name.trim(),
      account_type: accountType,
      account_subtype: accountSubtype.trim() || null,
      parent_account_id: parentAccountId === "none" ? null : parentAccountId,
      normal_balance: normalBalance,
      is_active: isActive,
      is_cash_account: isCashAccount,
      entity_scope: entityScope,
      revenue_restriction_class: revenueRestriction === "none" ? null : (revenueRestriction as FinanceRevenueRestrictionClass),
      expense_functional_class: expenseFunctional === "none" ? null : (expenseFunctional as FinanceExpenseFunctionalClass),
      form_990_line: form990Line.trim() || null,
      financial_statement_line: statementLine.trim() || null,
    });
    onOpenChange(false);
  };

  const eligibleParents = parentOptions.filter((option) => option.id !== account?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{account ? "Edit account" : "Add account"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account-code">Code *</Label>
              <Input id="account-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="1000" />
            </div>
            <div className="space-y-2">
              <Label>Account type *</Label>
              <Select value={accountType} onValueChange={(v) => handleTypeChange(v as FinanceAccountType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FINANCE_ACCOUNT_TYPE_LABELS) as FinanceAccountType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {FINANCE_ACCOUNT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-name">Name *</Label>
            <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account-subtype">Subtype</Label>
              <Input id="account-subtype" value={accountSubtype} onChange={(e) => setAccountSubtype(e.target.value)} placeholder="cash, payable, grants..." />
            </div>
            <div className="space-y-2">
              <Label>Normal balance</Label>
              <Select value={normalBalance} onValueChange={(v) => setNormalBalance(v as "debit" | "credit")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Debit</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Parent account</Label>
            <Select value={parentAccountId} onValueChange={setParentAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="None (top level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (top level)</SelectItem>
                {eligibleParents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.code} — {parent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entity scope</Label>
              <Select value={entityScope} onValueChange={(v) => setEntityScope(v as FinanceEntityScope)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(FINANCE_ENTITY_SCOPE_LABELS) as FinanceEntityScope[]).map((s) => (
                    <SelectItem key={s} value={s}>{FINANCE_ENTITY_SCOPE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Financial statement line</Label>
              <Input value={statementLine} onChange={(e) => setStatementLine(e.target.value)} placeholder="net_assets_without_donor_restrictions" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Revenue restriction</Label>
              <Select value={revenueRestriction} onValueChange={setRevenueRestriction}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(Object.keys(FINANCE_RESTRICTION_LABELS) as FinanceRevenueRestrictionClass[]).map((r) => (
                    <SelectItem key={r} value={r}>{FINANCE_RESTRICTION_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Expense functional class</Label>
              <Select value={expenseFunctional} onValueChange={setExpenseFunctional}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(Object.keys(FINANCE_FUNCTIONAL_LABELS) as FinanceExpenseFunctionalClass[]).map((f) => (
                    <SelectItem key={f} value={f}>{FINANCE_FUNCTIONAL_LABELS[f]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Form 990 line</Label>
              <Input value={form990Line} onChange={(e) => setForm990Line(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Cash account</p>
                <p className="text-xs text-muted-foreground">Used for statement of cash flows.</p>
              </div>
              <Switch checked={isCashAccount} onCheckedChange={setIsCashAccount} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Inactive accounts are hidden from new journal lines.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!code.trim() || !name.trim() || isSaving}>
            {account ? "Save changes" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
