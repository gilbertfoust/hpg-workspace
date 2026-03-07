import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LedgerRow } from "@/hooks/useLedger";
import { format } from "date-fns";

interface LedgerTableProps {
  entries: LedgerRow[];
  isLoading?: boolean;
  accountType?: string;
}

export function LedgerTable({ entries, isLoading, accountType }: LedgerTableProps) {
  const rows = useMemo(() => {
    let balance = 0;
    return entries.map((e) => {
      // Normal balance: assets/expenses increase with debits; liabilities/equity/income increase with credits
      const isDebitNormal = accountType === "asset" || accountType === "expense";
      if (isDebitNormal) {
        balance += e.debit - e.credit;
      } else {
        balance += e.credit - e.debit;
      }
      return { ...e, balance };
    });
  }, [entries, accountType]);

  if (isLoading) return <div className="text-center text-muted-foreground py-8">Loading…</div>;
  if (!entries.length) return <div className="text-center text-muted-foreground py-8">No entries found.</div>;

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Ref</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{format(new Date(r.transaction_date), "MMM d, yyyy")}</TableCell>
              <TableCell>{r.description}</TableCell>
              <TableCell className="text-muted-foreground">{r.reference_number || "—"}</TableCell>
              <TableCell className="text-right font-mono">{r.debit > 0 ? r.debit.toFixed(2) : ""}</TableCell>
              <TableCell className="text-right font-mono">{r.credit > 0 ? r.credit.toFixed(2) : ""}</TableCell>
              <TableCell className="text-right font-mono font-semibold">{r.balance.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
