import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBudgetCategories, BudgetCategory } from "@/hooks/useBudgetCategories";
import { useBudgets, Budget } from "@/hooks/useBudgets";
import { useActuals, Actual } from "@/hooks/useActuals";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, Save } from "lucide-react";

interface BudgetActualTableProps {
  ngoId: string;
  fiscalPeriodId: string;
  editable?: boolean;
  currency?: string;
}

interface RowData {
  category: BudgetCategory;
  budget: Budget | undefined;
  actual: Actual | undefined;
}

export function BudgetActualTable({ ngoId, fiscalPeriodId, editable = false, currency = "USD" }: BudgetActualTableProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: categories, isLoading: catLoading } = useBudgetCategories(ngoId);
  const { data: budgets, isLoading: budLoading, upsert: upsertBudget } = useBudgets(ngoId, fiscalPeriodId);
  const { data: actuals, isLoading: actLoading, upsert: upsertActual } = useActuals(ngoId, fiscalPeriodId);

  const [edits, setEdits] = useState<Record<string, { budgetAmount?: string; actualAmount?: string; notes?: string }>>({});

  const rows: RowData[] = useMemo(() => {
    if (!categories) return [];
    return categories.map((cat) => ({
      category: cat,
      budget: budgets?.find((b) => b.category_id === cat.id),
      actual: actuals?.find((a) => a.category_id === cat.id),
    }));
  }, [categories, budgets, actuals]);

  const fmt = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(val);

  const getEdit = (catId: string) => edits[catId] || {};

  const setEdit = (catId: string, field: string, value: string) => {
    setEdits((prev) => ({ ...prev, [catId]: { ...prev[catId], [field]: value } }));
  };

  const handleSaveRow = async (row: RowData) => {
    const edit = getEdit(row.category.id);
    try {
      if (edit.budgetAmount !== undefined || edit.notes !== undefined) {
        await upsertBudget.mutateAsync({
          id: row.budget?.id,
          ngo_id: ngoId,
          fiscal_period_id: fiscalPeriodId,
          category_id: row.category.id,
          amount: parseFloat(edit.budgetAmount ?? String(row.budget?.amount ?? 0)),
          notes: edit.notes ?? row.budget?.notes ?? null,
          created_by_user_id: row.budget?.created_by_user_id || user?.id || null,
        });
      }
      if (edit.actualAmount !== undefined) {
        await upsertActual.mutateAsync({
          id: row.actual?.id,
          ngo_id: ngoId,
          fiscal_period_id: fiscalPeriodId,
          category_id: row.category.id,
          amount: parseFloat(edit.actualAmount ?? String(row.actual?.amount ?? 0)),
          source: row.actual?.source || "manual_entry",
          supporting_document_url: row.actual?.supporting_document_url || null,
          created_by_user_id: row.actual?.created_by_user_id || user?.id || null,
        });
      }
      setEdits((prev) => {
        const next = { ...prev };
        delete next[row.category.id];
        return next;
      });
      toast({ title: "Saved" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error saving", description: err.message });
    }
  };

  const isLoading = catLoading || budLoading || actLoading;
  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  // Compute totals
  const totalBudgetIncome = rows.filter((r) => r.category.type === "income").reduce((sum, r) => sum + (r.budget?.amount || 0), 0);
  const totalBudgetExpense = rows.filter((r) => r.category.type === "expense").reduce((sum, r) => sum + (r.budget?.amount || 0), 0);
  const totalActualIncome = rows.filter((r) => r.category.type === "income").reduce((sum, r) => sum + (r.actual?.amount || 0), 0);
  const totalActualExpense = rows.filter((r) => r.category.type === "expense").reduce((sum, r) => sum + (r.actual?.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Code</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="text-right w-32">Budget</TableHead>
              <TableHead className="text-right w-32">Actual</TableHead>
              <TableHead className="text-right w-32">Variance</TableHead>
              <TableHead className="w-40">Notes</TableHead>
              {editable && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={editable ? 8 : 7} className="text-center text-muted-foreground py-8">No categories found. Add budget categories to get started.</TableCell></TableRow>
            ) : (
              rows.map((row) => {
                const edit = getEdit(row.category.id);
                const budgetAmt = edit.budgetAmount !== undefined ? parseFloat(edit.budgetAmount || "0") : (row.budget?.amount || 0);
                const actualAmt = edit.actualAmount !== undefined ? parseFloat(edit.actualAmount || "0") : (row.actual?.amount || 0);
                const variance = actualAmt - budgetAmt;
                const hasChanges = edit.budgetAmount !== undefined || edit.actualAmount !== undefined || edit.notes !== undefined;

                return (
                  <TableRow key={row.category.id}>
                    <TableCell className="font-mono text-xs">{row.category.code}</TableCell>
                    <TableCell className="font-medium">{row.category.name}</TableCell>
                    <TableCell><span className="capitalize text-xs text-muted-foreground">{row.category.type}</span></TableCell>
                    <TableCell className="text-right">
                      {editable ? (
                        <Input type="number" className="w-28 text-right h-8" value={edit.budgetAmount ?? String(row.budget?.amount ?? "")} onChange={(e) => setEdit(row.category.id, "budgetAmount", e.target.value)} placeholder="0" />
                      ) : fmt(row.budget?.amount || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      {editable ? (
                        <Input type="number" className="w-28 text-right h-8" value={edit.actualAmount ?? String(row.actual?.amount ?? "")} onChange={(e) => setEdit(row.category.id, "actualAmount", e.target.value)} placeholder="0" />
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          {fmt(row.actual?.amount || 0)}
                          {row.actual?.supporting_document_url && (
                            <a href={row.actual.supporting_document_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3 text-muted-foreground" /></a>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(variance)}
                    </TableCell>
                    <TableCell>
                      {editable ? (
                        <Input className="h-8 text-xs" value={edit.notes ?? (row.budget?.notes || "")} onChange={(e) => setEdit(row.category.id, "notes", e.target.value)} placeholder="Notes" />
                      ) : (
                        <span className="text-xs text-muted-foreground">{row.budget?.notes || "—"}</span>
                      )}
                    </TableCell>
                    {editable && (
                      <TableCell>
                        {hasChanges && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleSaveRow(row)}>
                            <Save className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {/* Totals summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm p-4 rounded-md border bg-muted/30">
        <div><p className="text-muted-foreground">Budget Income</p><p className="font-semibold">{fmt(totalBudgetIncome)}</p></div>
        <div><p className="text-muted-foreground">Actual Income</p><p className="font-semibold">{fmt(totalActualIncome)}</p></div>
        <div><p className="text-muted-foreground">Budget Expense</p><p className="font-semibold">{fmt(totalBudgetExpense)}</p></div>
        <div><p className="text-muted-foreground">Actual Expense</p><p className="font-semibold">{fmt(totalActualExpense)}</p></div>
      </div>
    </div>
  );
}
