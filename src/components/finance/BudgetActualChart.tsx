import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBudgetCategories } from "@/hooks/useBudgetCategories";
import { useBudgets } from "@/hooks/useBudgets";
import { useActuals } from "@/hooks/useActuals";
import { Loader2 } from "lucide-react";

interface BudgetActualChartProps {
  ngoId: string;
  fiscalPeriodId: string;
  currency?: string;
}

export function BudgetActualChart({ ngoId, fiscalPeriodId, currency = "USD" }: BudgetActualChartProps) {
  const { data: categories, isLoading: catLoading } = useBudgetCategories(ngoId);
  const { data: budgets, isLoading: budLoading } = useBudgets(ngoId, fiscalPeriodId);
  const { data: actuals, isLoading: actLoading } = useActuals(ngoId, fiscalPeriodId);

  const fmt = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(val);

  const { summaryData, categoryData } = useMemo(() => {
    if (!categories) return { summaryData: [], categoryData: [] };

    let budgetIncome = 0, actualIncome = 0, budgetExpense = 0, actualExpense = 0;
    const catRows: { name: string; budget: number; actual: number; type: string }[] = [];

    categories.forEach((cat) => {
      const b = budgets?.find((x) => x.category_id === cat.id)?.amount || 0;
      const a = actuals?.find((x) => x.category_id === cat.id)?.amount || 0;
      if (b === 0 && a === 0) return;

      if (cat.type === "income") { budgetIncome += b; actualIncome += a; }
      else if (cat.type === "expense") { budgetExpense += b; actualExpense += a; }

      catRows.push({ name: cat.name.length > 20 ? cat.name.slice(0, 18) + "…" : cat.name, budget: b, actual: a, type: cat.type });
    });

    return {
      summaryData: [
        { name: "Income", Budget: budgetIncome, Actual: actualIncome },
        { name: "Expense", Budget: budgetExpense, Actual: actualExpense },
        { name: "Net", Budget: budgetIncome - budgetExpense, Actual: actualIncome - actualExpense },
      ],
      categoryData: catRows,
    };
  }, [categories, budgets, actuals]);

  const isLoading = catLoading || budLoading || actLoading;
  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  if (summaryData.length === 0 || (summaryData[0].Budget === 0 && summaryData[0].Actual === 0)) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Summary chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Budget vs Actual Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={summaryData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} className="fill-muted-foreground" width={80} />
              <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Budget" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Actual" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category breakdown chart */}
      {categoryData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">By Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={categoryData} layout="vertical" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(v)} className="fill-muted-foreground" />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} className="fill-muted-foreground" />
                <Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="budget" name="Budget" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="actual" name="Actual" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
