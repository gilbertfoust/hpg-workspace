import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Transaction } from "@/hooks/useTransactions";
import { format } from "date-fns";
import { Ban } from "lucide-react";

interface TransactionsTableProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onVoid?: (id: string) => void;
  onSelect?: (txn: Transaction) => void;
}

export function TransactionsTable({ transactions, isLoading, onVoid, onSelect }: TransactionsTableProps) {
  if (isLoading) {
    return <div className="text-center text-muted-foreground py-8">Loading transactions…</div>;
  }

  if (!transactions.length) {
    return <div className="text-center text-muted-foreground py-8">No transactions found.</div>;
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((txn) => (
            <TableRow key={txn.id} className={txn.is_void ? "opacity-50" : "cursor-pointer"} onClick={() => !txn.is_void && onSelect?.(txn)}>
              <TableCell>{format(new Date(txn.transaction_date), "MMM d, yyyy")}</TableCell>
              <TableCell>{txn.description}</TableCell>
              <TableCell className="text-muted-foreground">{txn.reference_number || "—"}</TableCell>
              <TableCell>
                {txn.is_void ? (
                  <Badge variant="destructive">Void</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Posted</Badge>
                )}
              </TableCell>
              <TableCell>
                {!txn.is_void && onVoid && (
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onVoid(txn.id); }} title="Void">
                    <Ban className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
