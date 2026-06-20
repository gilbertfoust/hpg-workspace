import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Landmark } from "lucide-react";
import { FinanceBankAccountDialog } from "@/components/finance/accounting/FinanceBankAccountDialog";
import { useFinanceAccounts } from "@/hooks/useFinanceAccounts";
import {
  useCreateFinanceBankAccount,
  useDeactivateFinanceBankAccount,
  useFinanceBankAccounts,
  useUpdateFinanceBankAccount,
} from "@/hooks/useFinanceBankAccounts";
import type { FinanceBankAccount, FinanceBankAccountInput } from "@/types/financeAccounting";

const formatMoney = (value: number) =>
  value.toLocaleString(undefined, { style: "currency", currency: "USD" });

const FinanceBankAccountsPage = () => {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceBankAccount | null>(null);

  const { data: bankAccounts = [], isLoading, error } = useFinanceBankAccounts({ includeInactive });
  const { data: glAccounts = [] } = useFinanceAccounts();

  const cashGlAccounts = useMemo(
    () =>
      glAccounts.filter(
        (account) =>
          account.account_type === "asset" &&
          (account.account_subtype === "cash" || account.code.startsWith("10"))
      ),
    [glAccounts]
  );

  const createBankAccount = useCreateFinanceBankAccount();
  const updateBankAccount = useUpdateFinanceBankAccount();
  const deactivateBankAccount = useDeactivateFinanceBankAccount();

  const openCreate = () => {
    setEditingAccount(null);
    setDialogOpen(true);
  };

  const openEdit = (account: FinanceBankAccount) => {
    setEditingAccount(account);
    setDialogOpen(true);
  };

  const handleSave = async (input: FinanceBankAccountInput) => {
    if (editingAccount) {
      await updateBankAccount.mutateAsync({ id: editingAccount.id, ...input });
    } else {
      await createBankAccount.mutateAsync(input);
    }
  };

  const isSaving = createBankAccount.isPending || updateBankAccount.isPending;

  return (
    <MainLayout
      title="Bank Accounts"
      subtitle="Cash and bank register — manual entry only (no Plaid connection yet)"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Landmark className="h-4 w-4" />
                HPG Bank & Cash Accounts
              </CardTitle>
              <CardDescription>
                Link operational bank accounts to GL cash accounts. Current ledger balance reflects opening balance
                plus all posted journal activity on the linked account.
              </CardDescription>
            </div>
            <Button onClick={openCreate} disabled={cashGlAccounts.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Add bank account
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {cashGlAccounts.length === 0 && (
              <p className="text-sm text-amber-600 rounded-md border border-amber-200 bg-amber-50 p-3">
                Add a Cash / Bank asset account in Chart of Accounts before creating bank accounts.
              </p>
            )}

            <div className="flex items-center gap-2">
              <Switch id="include-inactive-banks" checked={includeInactive} onCheckedChange={setIncludeInactive} />
              <Label htmlFor="include-inactive-banks">Show inactive bank accounts</Label>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive py-6 text-center">
                {(error as Error).message.includes("does not exist")
                  ? "Bank account tables are not applied yet. Run the Phase 34 migration locally."
                  : (error as Error).message}
              </p>
            ) : bankAccounts.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No bank accounts configured. Add accounts manually — no live banking connection yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3">Account name</th>
                      <th className="p-3">Institution</th>
                      <th className="p-3">Last 4</th>
                      <th className="p-3">Linked GL</th>
                      <th className="p-3">Opening</th>
                      <th className="p-3">Ledger balance</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankAccounts.map((account) => (
                      <tr key={account.id} className="border-b hover:bg-muted/40">
                        <td className="p-3 font-medium">{account.account_name}</td>
                        <td className="p-3 text-muted-foreground">{account.institution_name || "—"}</td>
                        <td className="p-3 font-mono">{account.last_four ? `••••${account.last_four}` : "—"}</td>
                        <td className="p-3">
                          {account.linked_account
                            ? `${account.linked_account.code} — ${account.linked_account.name}`
                            : "—"}
                        </td>
                        <td className="p-3">{formatMoney(Number(account.opening_balance))}</td>
                        <td className="p-3 font-medium">{formatMoney(account.ledger_balance ?? 0)}</td>
                        <td className="p-3">
                          <Badge variant={account.is_active ? "default" : "secondary"}>
                            {account.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(account)}>
                            Edit
                          </Button>
                          {account.is_active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => deactivateBankAccount.mutate(account.id)}
                              disabled={deactivateBankAccount.isPending}
                            >
                              Deactivate
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FinanceBankAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        bankAccount={editingAccount}
        cashGlAccounts={cashGlAccounts.length > 0 ? cashGlAccounts : glAccounts.filter((a) => a.account_type === "asset")}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </MainLayout>
  );
};

export default FinanceBankAccountsPage;
