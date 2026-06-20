import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, BookOpen, Sparkles } from "lucide-react";
import { FinanceAccountDialog } from "@/components/finance/accounting/FinanceAccountDialog";
import {
  useCreateFinanceAccount,
  useDeactivateFinanceAccount,
  useFinanceAccountUsage,
  useFinanceAccounts,
  useSeedStarterFinanceAccounts,
  useUpdateFinanceAccount,
} from "@/hooks/useFinanceAccounts";
import type { FinanceAccount, FinanceAccountInput } from "@/types/financeAccounting";
import { FINANCE_ACCOUNT_TYPE_LABELS } from "@/types/financeAccounting";

const FinanceChartOfAccountsPage = () => {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinanceAccount | null>(null);

  const { data: accounts = [], isLoading, error } = useFinanceAccounts({ includeInactive });
  const accountIds = useMemo(() => accounts.map((account) => account.id), [accounts]);
  const { data: postedAccountIds } = useFinanceAccountUsage(accountIds);

  const createAccount = useCreateFinanceAccount();
  const updateAccount = useUpdateFinanceAccount();
  const deactivateAccount = useDeactivateFinanceAccount();
  const seedStarter = useSeedStarterFinanceAccounts();

  const parentNameById = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((account) => map.set(account.id, `${account.code} — ${account.name}`));
    return map;
  }, [accounts]);

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })),
    [accounts]
  );

  const openCreate = () => {
    setEditingAccount(null);
    setDialogOpen(true);
  };

  const openEdit = (account: FinanceAccount) => {
    setEditingAccount(account);
    setDialogOpen(true);
  };

  const handleSave = async (input: FinanceAccountInput) => {
    if (editingAccount) {
      await updateAccount.mutateAsync({ id: editingAccount.id, ...input });
    } else {
      await createAccount.mutateAsync(input);
    }
  };

  const handleDeactivate = async (account: FinanceAccount) => {
    if (postedAccountIds?.has(account.id)) {
      await deactivateAccount.mutateAsync(account.id);
      return;
    }
    await deactivateAccount.mutateAsync(account.id);
  };

  const isSaving = createAccount.isPending || updateAccount.isPending;

  return (
    <MainLayout
      title="Chart of Accounts"
      subtitle="HPG internal nonprofit ledger — double-entry accounting foundation"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4" />
                Accounting Chart of Accounts
              </CardTitle>
              <CardDescription>
                Organization-wide COA for fiscal sponsorship, fund restrictions, and QuickBooks-style workflows.
                Legacy NGO-scoped accounts remain under Financial Hub → Accounts (COA).
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => seedStarter.mutate()} disabled={seedStarter.isPending || accounts.length > 0}>
                {seedStarter.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Load starter chart (demo)
              </Button>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add account
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Switch id="include-inactive" checked={includeInactive} onCheckedChange={setIncludeInactive} />
              <Label htmlFor="include-inactive">Show inactive accounts</Label>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive py-6 text-center">
                {(error as Error).message.includes("does not exist")
                  ? "Finance accounting tables are not applied yet. Run the Phase 31 migration locally before using this page."
                  : (error as Error).message}
              </p>
            ) : sortedAccounts.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No accounts yet. Add accounts manually or load the labeled starter nonprofit chart (demo seed only).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3">Code</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Subtype</th>
                      <th className="p-3">Parent</th>
                      <th className="p-3">Normal</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedAccounts.map((account) => {
                      const hasPostedActivity = postedAccountIds?.has(account.id);
                      return (
                        <tr key={account.id} className="border-b hover:bg-muted/40">
                          <td className="p-3 font-mono">{account.code}</td>
                          <td className="p-3 font-medium">{account.name}</td>
                          <td className="p-3">{FINANCE_ACCOUNT_TYPE_LABELS[account.account_type]}</td>
                          <td className="p-3 text-muted-foreground">{account.account_subtype || "—"}</td>
                          <td className="p-3 text-muted-foreground">
                            {account.parent_account_id ? parentNameById.get(account.parent_account_id) || "—" : "—"}
                          </td>
                          <td className="p-3 capitalize">{account.normal_balance}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1">
                              <Badge variant={account.is_active ? "default" : "secondary"}>
                                {account.is_active ? "Active" : "Inactive"}
                              </Badge>
                              {hasPostedActivity && (
                                <Badge variant="outline">Posted activity</Badge>
                              )}
                            </div>
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
                                onClick={() => handleDeactivate(account)}
                                disabled={deactivateAccount.isPending}
                              >
                                Deactivate
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <FinanceAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editingAccount}
        parentOptions={accounts}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </MainLayout>
  );
};

export default FinanceChartOfAccountsPage;
