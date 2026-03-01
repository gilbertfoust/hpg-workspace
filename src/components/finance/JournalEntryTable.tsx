import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { JournalEntry } from "@/hooks/useJournalEntries";
import { Account } from "@/hooks/useAccounts";

interface JournalEntryTableProps {
  entries: JournalEntry[];
  accounts: Account[];
}

export function JournalEntryTable({ entries, accounts }: JournalEntryTableProps) {
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const totalDebit = entries.reduce((s, e) => s + Number(e.debit), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.credit), 0);

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead>Memo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => {
            const acct = accountMap.get(e.account_id);
            return (
              <TableRow key={e.id}>
                <TableCell>{acct ? `${acct.code} — ${acct.name}` : e.account_id}</TableCell>
                <TableCell className="text-right font-mono">{Number(e.debit) > 0 ? Number(e.debit).toFixed(2) : ""}</TableCell>
                <TableCell className="text-right font-mono">{Number(e.credit) > 0 ? Number(e.credit).toFixed(2) : ""}</TableCell>
                <TableCell className="text-muted-foreground">{e.memo || "—"}</TableCell>
              </TableRow>
            );
          })}
          <TableRow className="font-semibold bg-muted">
            <TableCell>Totals</TableCell>
            <TableCell className="text-right font-mono">{totalDebit.toFixed(2)}</TableCell>
            <TableCell className="text-right font-mono">{totalCredit.toFixed(2)}</TableCell>
            <TableCell />
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
