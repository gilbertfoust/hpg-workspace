export type FinanceAccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type FinanceNormalBalance = "debit" | "credit";

export interface FinanceAccount {
  id: string;
  code: string;
  name: string;
  account_type: FinanceAccountType;
  account_subtype: string | null;
  parent_account_id: string | null;
  normal_balance: FinanceNormalBalance;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type FinanceAccountInput = {
  code: string;
  name: string;
  account_type: FinanceAccountType;
  account_subtype?: string | null;
  parent_account_id?: string | null;
  normal_balance: FinanceNormalBalance;
  is_active?: boolean;
};

export const FINANCE_ACCOUNT_TYPE_LABELS: Record<FinanceAccountType, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expense",
};

export const defaultNormalBalanceForType = (type: FinanceAccountType): FinanceNormalBalance => {
  if (type === "asset" || type === "expense") return "debit";
  return "credit";
};

/** Starter nonprofit chart of accounts (seed/demo). */
export const STARTER_FINANCE_ACCOUNTS: FinanceAccountInput[] = [
  { code: "1000", name: "Cash / Bank", account_type: "asset", account_subtype: "cash", normal_balance: "debit" },
  { code: "1100", name: "Accounts Receivable", account_type: "asset", account_subtype: "receivable", normal_balance: "debit" },
  { code: "1200", name: "Grants Receivable", account_type: "asset", account_subtype: "grants_receivable", normal_balance: "debit" },
  { code: "1300", name: "Prepaid Expenses", account_type: "asset", account_subtype: "prepaid", normal_balance: "debit" },
  { code: "2000", name: "Accounts Payable", account_type: "liability", account_subtype: "payable", normal_balance: "credit" },
  { code: "2100", name: "Deferred Revenue", account_type: "liability", account_subtype: "deferred_revenue", normal_balance: "credit" },
  { code: "3000", name: "Net Assets Without Donor Restrictions", account_type: "equity", account_subtype: "unrestricted", normal_balance: "credit" },
  { code: "3100", name: "Net Assets With Donor Restrictions", account_type: "equity", account_subtype: "restricted", normal_balance: "credit" },
  { code: "4000", name: "Contributions", account_type: "revenue", account_subtype: "contributions", normal_balance: "credit" },
  { code: "4100", name: "Grants Revenue", account_type: "revenue", account_subtype: "grants", normal_balance: "credit" },
  { code: "4200", name: "Program Service Revenue", account_type: "revenue", account_subtype: "program_service", normal_balance: "credit" },
  { code: "4300", name: "Fiscal Sponsorship Admin Fees", account_type: "revenue", account_subtype: "admin_fees", normal_balance: "credit" },
  { code: "5000", name: "Program Expenses", account_type: "expense", account_subtype: "program", normal_balance: "debit" },
  { code: "5100", name: "Grant Disbursements", account_type: "expense", account_subtype: "grant_disbursement", normal_balance: "debit" },
  { code: "5200", name: "Professional Fees", account_type: "expense", account_subtype: "professional", normal_balance: "debit" },
  { code: "5300", name: "Software / Technology", account_type: "expense", account_subtype: "technology", normal_balance: "debit" },
  { code: "5400", name: "Fundraising Expense", account_type: "expense", account_subtype: "fundraising", normal_balance: "debit" },
  { code: "5500", name: "Administrative Expense", account_type: "expense", account_subtype: "administrative", normal_balance: "debit" },
];
