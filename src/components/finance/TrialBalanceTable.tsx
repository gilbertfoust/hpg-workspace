import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrialBalanceRow } from "@/hooks/useTrialBalance";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface TrialBalanceTableProps {
  rows: TrialBalanceRow[];
  isLoading?: boolean;
}

const TYPE_ORDER = ["asset", "liability", "equity", "income", "expense"];
const TYPE_LABELS: Record<string, string> = { asset: "Assets", liability: "Liabilities", equity: "Equity", income: "Income", expense: "Expenses" };

export function TrialBalanceTable({ rows, isLoading }: TrialBalanceTableProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, TrialBalanceRow[]>();
    for (const t of TYPE_ORDER) map.set(t, []);
    for (const r of rows) map.get(r.account_type)?.push(r);
    return map;
  }, [rows]);

  const totalDebit = rows.reduce((s, r) => s + r.total_debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.total_credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.005;

  if (isLoading) return <div className="text-center text-muted-foreground py-8">Loading…</div>;
  if (!rows.length) return <div className="text-center text-muted-foreground py-8">No data for this period.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {isBalanced ? (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 gap-1"><CheckCircle2 className="h-3 w-3" /> Balanced</Badge>
        ) : (
          <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Unbalanced — Diff: {Math.abs(totalDebit - totalCredit).toFixed(2)}</Badge>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {TYPE_ORDER.map((type) => {
              const items = grouped.get(type) || [];
              if (!items.length) return null;
              return (
                <> 
                  <TableRow key={type} className="bg-muted/50">
                    <TableCell colSpan={4} className="font-semibold text-xs uppercase tracking-wider">{TYPE_LABELS[type]}</TableCell>
                  </TableRow>
                  {items.map((r) => (
                    <TableRow key={r.account_id}>
                      <TableCell className="font-mono text-sm pl-6">{r.account_code}</TableCell>
                      <TableCell>{r.account_name}</TableCell>
                      <TableCell className="text-right font-mono">{r.total_debit > 0 ? r.total_debit.toFixed(2) : ""}</TableCell>
                      <TableCell className="text-right font-mono">{r.total_credit > 0 ? r.total_credit.toFixed(2) : ""}</TableCell>
                    </TableRow>
                  ))}
                </>
              );
            })}
            <TableRow className="font-bold bg-muted border-t-2">
              <TableCell colSpan={2}>Grand Total</TableCell>
              <TableCell className="text-right font-mono">{totalDebit.toFixed(2)}</TableCell>
              <TableCell className="text-right font-mono">{totalCredit.toFixed(2)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
