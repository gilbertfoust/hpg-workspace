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
import type { FinanceAccount } from "@/types/financeAccounting";
import type { FinanceBankAccount, FinanceBankAccountInput } from "@/types/financeAccounting";

interface FinanceBankAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankAccount?: FinanceBankAccount | null;
  ngoId: string;
  entityName: string;
  ledgerAccounts: FinanceAccount[];
  onSave: (input: FinanceBankAccountInput) => Promise<void>;
  isSaving?: boolean;
}

export function FinanceBankAccountDialog({
  open,
  onOpenChange,
  bankAccount,
  ngoId,
  entityName,
  ledgerAccounts,
  onSave,
  isSaving,
}: FinanceBankAccountDialogProps) {
  const [accountName, setAccountName] = useState("");
  const [accountKind, setAccountKind] = useState<FinanceBankAccountInput["account_kind"]>("bank");
  const [institutionName, setInstitutionName] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [linkedAccountId, setLinkedAccountId] = useState("none");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [openingBalanceDate, setOpeningBalanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (bankAccount) {
      setAccountKind(bankAccount.account_kind);
      setAccountName(bankAccount.account_name);
      setInstitutionName(bankAccount.institution_name || "");
      setLastFour(bankAccount.last_four || "");
      setLinkedAccountId(bankAccount.linked_finance_account_id);
      setOpeningBalance(String(bankAccount.opening_balance));
      setOpeningBalanceDate(bankAccount.opening_balance_date);
      setIsActive(bankAccount.is_active);
    } else {
      setAccountKind("bank");
      setAccountName("");
      setInstitutionName("");
      setLastFour("");
      setLinkedAccountId(ledgerAccounts.find((account) => account.account_type === "asset")?.id ?? "none");
      setOpeningBalance("0");
      setOpeningBalanceDate(new Date().toISOString().slice(0, 10));
      setIsActive(true);
    }
  }, [open, bankAccount, ledgerAccounts]);

  const eligibleAccounts = ledgerAccounts.filter((account) => (
    accountKind === "credit_card" ? account.account_type === "liability" : account.account_type === "asset"
  ));

  const handleSubmit = async () => {
    if (linkedAccountId === "none") return;
    await onSave({
      ngo_id: ngoId,
      account_kind: accountKind,
      account_name: accountName.trim(),
      institution_name: institutionName.trim() || null,
      last_four: lastFour.trim() || null,
      linked_finance_account_id: linkedAccountId,
      opening_balance: Number(openingBalance) || 0,
      opening_balance_date: openingBalanceDate,
      is_active: isActive,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{bankAccount ? "Edit bank account" : "Add bank account"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entity</Label>
              <Input value={entityName} readOnly className="bg-muted/40" />
            </div>
            <div className="space-y-2">
              <Label>Account type</Label>
              <Select value={accountKind} onValueChange={(value) => {
                const kind = value as FinanceBankAccountInput["account_kind"];
                setAccountKind(kind);
                const next = ledgerAccounts.find((account) => kind === "credit_card" ? account.account_type === "liability" : account.account_type === "asset");
                setLinkedAccountId(next?.id ?? "none");
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank account</SelectItem>
                  <SelectItem value="credit_card">Credit card</SelectItem>
                  <SelectItem value="cash">Cash account</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bank-name">Account name *</Label>
            <Input
              id="bank-name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="HPG Operating Checking"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="institution">Institution</Label>
              <Input
                id="institution"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="Bank name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last-four">Last four</Label>
              <Input
                id="last-four"
                value={lastFour}
                onChange={(e) => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="1234"
                maxLength={4}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Linked GL {accountKind === "credit_card" ? "liability" : "cash"} account *</Label>
            <Select value={linkedAccountId} onValueChange={setLinkedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select chart of accounts cash/bank account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Select account</SelectItem>
                {eligibleAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.code} — {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Ledger balance is calculated from posted journal lines on this GL account plus opening balance.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="opening-balance">Opening balance</Label>
              <Input
                id="opening-balance"
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="opening-date">Opening balance date</Label>
              <Input
                id="opening-date"
                type="date"
                value={openingBalanceDate}
                onChange={(e) => setOpeningBalanceDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Inactive accounts are hidden from payment workflows.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!accountName.trim() || linkedAccountId === "none" || isSaving}
          >
            {bankAccount ? "Save changes" : "Create bank account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
