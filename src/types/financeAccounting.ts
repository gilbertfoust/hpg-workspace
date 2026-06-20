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

// ---------------------------------------------------------------------------
// Journal entries
// ---------------------------------------------------------------------------

export type FinanceJournalEntryStatus =
  | "draft"
  | "pending_approval"
  | "posted"
  | "voided"
  | "reversed";

export interface FinanceJournalEntry {
  id: string;
  entry_number: string;
  entry_date: string;
  memo: string | null;
  source_type: string | null;
  source_id: string | null;
  status: FinanceJournalEntryStatus;
  reversal_of_entry_id: string | null;
  created_by_user_id: string | null;
  approved_by_user_id: string | null;
  posted_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceJournalLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  memo: string | null;
  fund_id: string | null;
  ngo_id: string | null;
  department_id: string | null;
  dimension_id: string | null;
  document_id: string | null;
  grant_application_id: string | null;
  work_item_id: string | null;
  line_number: number;
  created_at: string;
  updated_at: string;
}

export type FinanceJournalLineInput = {
  id?: string;
  account_id: string;
  debit: number;
  credit: number;
  memo?: string | null;
  fund_id?: string | null;
  ngo_id?: string | null;
  department_id?: string | null;
  dimension_id?: string | null;
  document_id?: string | null;
  grant_application_id?: string | null;
  work_item_id?: string | null;
  line_number?: number;
};

export type FinanceJournalEntryInput = {
  entry_date: string;
  memo?: string | null;
  status?: FinanceJournalEntryStatus;
  lines: FinanceJournalLineInput[];
};

export interface FinanceJournalEntryWithLines extends FinanceJournalEntry {
  lines: FinanceJournalLine[];
  total_debit?: number;
  total_credit?: number;
  created_by_name?: string | null;
}

export interface FinanceAuditEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_user_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  actor_name?: string | null;
}

export const FINANCE_JOURNAL_STATUS_LABELS: Record<FinanceJournalEntryStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  posted: "Posted",
  voided: "Voided",
  reversed: "Reversed",
};

export const computeJournalTotals = (lines: Pick<FinanceJournalLineInput, "debit" | "credit">[]) => {
  const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  return {
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    isBalanced: Math.round(totalDebit * 100) === Math.round(totalCredit * 100),
    difference: Math.round((totalDebit - totalCredit) * 100) / 100,
  };
};

// ---------------------------------------------------------------------------
// Funds
// ---------------------------------------------------------------------------

export type FinanceFundType =
  | "unrestricted"
  | "donor_restricted"
  | "board_designated"
  | "grant_restricted"
  | "fiscal_sponsorship"
  | "pass_through";

export interface FinanceFund {
  id: string;
  name: string;
  fund_type: FinanceFundType;
  restriction_notes: string | null;
  ngo_id: string | null;
  grant_opportunity_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const FINANCE_FUND_TYPE_LABELS: Record<FinanceFundType, string> = {
  unrestricted: "Unrestricted",
  donor_restricted: "Donor restricted",
  board_designated: "Board designated",
  grant_restricted: "Grant restricted",
  fiscal_sponsorship: "Fiscal sponsorship",
  pass_through: "Pass-through",
};
