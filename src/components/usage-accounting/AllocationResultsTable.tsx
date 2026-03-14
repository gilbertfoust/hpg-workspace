import { useAllocationResults } from "@/hooks/useAllocationResults";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function AllocationResultsTable({ runId }: { runId: string }) {
  const { data: results = [], isLoading } = useAllocationResults(runId);

  if (isLoading) return <div className="text-muted-foreground text-sm p-4">Loading results…</div>;

  const totalAllocated = results.reduce((sum, r) => sum + Number(r.allocated_amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Allocation Results</h3>
        <span className="text-sm font-medium">Total: ${totalAllocated.toFixed(2)}</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rule</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Posted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No results</TableCell></TableRow>
          ) : (
            results.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-sm font-medium">{r.allocation_rules?.name || "—"}</TableCell>
                <TableCell className="text-sm">{r.source_cc ? `${r.source_cc.code} — ${r.source_cc.name}` : "—"}</TableCell>
                <TableCell className="text-sm">{r.target_cc ? `${r.target_cc.code} — ${r.target_cc.name}` : "—"}</TableCell>
                <TableCell className="text-right font-mono font-medium">${Number(r.allocated_amount).toFixed(2)}</TableCell>
                <TableCell>
                  {r.journal_transaction_id ? (
                    <Badge variant="default">Posted</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
