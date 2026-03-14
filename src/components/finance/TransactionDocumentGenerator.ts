import { Transaction } from "@/hooks/useTransactions";
import { JournalEntry } from "@/hooks/useJournalEntries";
import { Account } from "@/hooks/useAccounts";
import { format } from "date-fns";

export function generateTransactionHTML(
  transaction: Transaction,
  entries: JournalEntry[],
  accounts: Account[],
  ngoName: string
): string {
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const totalDebit = entries.reduce((s, e) => s + Number(e.debit), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.credit), 0);

  const rows = entries
    .map((e) => {
      const acct = accountMap.get(e.account_id);
      const acctLabel = acct ? `${acct.code} — ${acct.name}` : e.account_id;
      const debit = Number(e.debit) > 0 ? Number(e.debit).toFixed(2) : "";
      const credit = Number(e.credit) > 0 ? Number(e.credit).toFixed(2) : "";
      return `<tr>
        <td>${acctLabel}</td>
        <td class="text-right font-mono">${debit}</td>
        <td class="text-right font-mono">${credit}</td>
        <td>${e.memo || "—"}</td>
      </tr>`;
    })
    .join("\n");

  return `
    <h1>Journal Entry — ${ngoName}</h1>
    <div class="meta">
      <strong>Date:</strong> ${format(new Date(transaction.transaction_date), "MMMM d, yyyy")}<br/>
      <strong>Description:</strong> ${transaction.description}<br/>
      ${transaction.reference_number ? `<strong>Reference:</strong> ${transaction.reference_number}<br/>` : ""}
      <strong>Status:</strong> ${transaction.is_void ? "VOID" : "Posted"}<br/>
      <strong>Generated:</strong> ${format(new Date(), "MMMM d, yyyy h:mm a")}
    </div>
    <table>
      <thead>
        <tr>
          <th>Account</th>
          <th class="text-right">Debit</th>
          <th class="text-right">Credit</th>
          <th>Memo</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="totals">
          <td><strong>Totals</strong></td>
          <td class="text-right font-mono"><strong>${totalDebit.toFixed(2)}</strong></td>
          <td class="text-right font-mono"><strong>${totalCredit.toFixed(2)}</strong></td>
          <td>${Math.abs(totalDebit - totalCredit) < 0.005 ? "✓ Balanced" : "⚠ Unbalanced"}</td>
        </tr>
      </tbody>
    </table>
  `;
}
