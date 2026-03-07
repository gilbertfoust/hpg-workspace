import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTrialBalance, TrialBalanceRow } from "@/hooks/useTrialBalance";
import { useFinancialStatements } from "@/hooks/useFinancialStatements";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  ngoId: string;
  fiscalYear: number;
  fiscalPeriodIds: string[];
}

function buildBalanceSheet(rows: TrialBalanceRow[]) {
  const assets = rows.filter((r) => r.account_type === "asset");
  const liabilities = rows.filter((r) => r.account_type === "liability");
  const equity = rows.filter((r) => r.account_type === "equity");

  const totalAssets = assets.reduce((s, r) => s + r.total_debit - r.total_credit, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.total_credit - r.total_debit, 0);
  const totalEquity = equity.reduce((s, r) => s + r.total_credit - r.total_debit, 0);

  return {
    sections: [
      {
        title: "Assets",
        rows: [
          ...assets.map((a) => ({ label: `${a.account_code} — ${a.account_name}`, amount: a.total_debit - a.total_credit })),
          { label: "Total Assets", amount: totalAssets, isTotal: true },
        ],
      },
      {
        title: "Liabilities",
        rows: [
          ...liabilities.map((l) => ({ label: `${l.account_code} — ${l.account_name}`, amount: l.total_credit - l.total_debit })),
          { label: "Total Liabilities", amount: totalLiabilities, isTotal: true },
        ],
      },
      {
        title: "Net Assets (Equity)",
        rows: [
          ...equity.map((e) => ({ label: `${e.account_code} — ${e.account_name}`, amount: e.total_credit - e.total_debit })),
          { label: "Total Net Assets", amount: totalEquity, isTotal: true },
        ],
      },
      {
        title: "Summary",
        rows: [{ label: "Total Liabilities + Net Assets", amount: totalLiabilities + totalEquity, isTotal: true }],
      },
    ],
  };
}

function buildIncomeStatement(rows: TrialBalanceRow[]) {
  const income = rows.filter((r) => r.account_type === "income");
  const expenses = rows.filter((r) => r.account_type === "expense");

  const totalIncome = income.reduce((s, r) => s + r.total_credit - r.total_debit, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.total_debit - r.total_credit, 0);

  return {
    sections: [
      {
        title: "Revenue & Support",
        rows: [
          ...income.map((i) => ({ label: `${i.account_code} — ${i.account_name}`, amount: i.total_credit - i.total_debit })),
          { label: "Total Revenue", amount: totalIncome, isTotal: true },
        ],
      },
      {
        title: "Expenses",
        rows: [
          ...expenses.map((e) => ({ label: `${e.account_code} — ${e.account_name}`, amount: e.total_debit - e.total_credit })),
          { label: "Total Expenses", amount: totalExpenses, isTotal: true },
        ],
      },
      {
        title: "Change in Net Assets",
        rows: [{ label: "Net Income / (Loss)", amount: totalIncome - totalExpenses, isTotal: true }],
      },
    ],
  };
}

function buildCashFlows(rows: TrialBalanceRow[]) {
  const income = rows.filter((r) => r.account_type === "income");
  const expenses = rows.filter((r) => r.account_type === "expense");
  const totalIncome = income.reduce((s, r) => s + r.total_credit - r.total_debit, 0);
  const totalExpenses = expenses.reduce((s, r) => s + r.total_debit - r.total_credit, 0);

  return {
    sections: [
      {
        title: "Cash Flows from Operating Activities",
        rows: [
          { label: "Net Income", amount: totalIncome - totalExpenses },
          { label: "Net Cash from Operations", amount: totalIncome - totalExpenses, isTotal: true },
        ],
      },
    ],
  };
}

function buildFunctionalExpenses(rows: TrialBalanceRow[]) {
  const expenses = rows.filter((r) => r.account_type === "expense");
  const total = expenses.reduce((s, r) => s + r.total_debit - r.total_credit, 0);

  return {
    sections: [
      {
        title: "Functional Expenses",
        rows: [
          ...expenses.map((e) => ({ label: `${e.account_code} — ${e.account_name}`, amount: e.total_debit - e.total_credit })),
          { label: "Total Functional Expenses", amount: total, isTotal: true },
        ],
      },
    ],
  };
}

export function StatementGenerator({ ngoId, fiscalYear, fiscalPeriodIds }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  
  // Use first period ID for trial balance query (aggregated across all periods for the year)
  const { data: trialBalance } = useTrialBalance(ngoId);
  const { upsert } = useFinancialStatements(ngoId, fiscalYear);

  const handleGenerate = async () => {
    if (!trialBalance || trialBalance.length === 0) {
      toast({ variant: "destructive", title: "No ledger data", description: "No journal entries found for this NGO." });
      return;
    }

    setGenerating(true);
    try {
      const types = [
        { type: "balance_sheet", builder: buildBalanceSheet },
        { type: "income_statement", builder: buildIncomeStatement },
        { type: "cash_flows", builder: buildCashFlows },
        { type: "functional_expenses", builder: buildFunctionalExpenses },
      ];

      for (const { type, builder } of types) {
        await upsert.mutateAsync({
          ngo_id: ngoId,
          fiscal_year: fiscalYear,
          statement_type: type,
          data_json: builder(trialBalance),
          generated_by_user_id: user?.id || null,
        });
      }

      toast({ title: "Statements generated", description: `All 4 financial statements created for FY${fiscalYear}.` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button onClick={handleGenerate} disabled={generating}>
      {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
      Generate All Statements
    </Button>
  );
}
