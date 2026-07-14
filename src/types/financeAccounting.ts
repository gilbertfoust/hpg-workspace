export type FinanceAccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type FinanceNormalBalance = "debit" | "credit";

export type FinanceEntityScope = "hpg_operating" | "fiscal_sponsorship" | "consolidated";
export type FinanceRevenueRestrictionClass =
  | "without_donor_restrictions"
  | "with_donor_restrictions"
  | "grant_restricted"
  | "program_released"
  | "pass_through";
export type FinanceExpenseFunctionalClass = "program" | "management_general" | "fundraising" | "pass_through";

export interface FinanceAccount {
  id: string;
  code: string;
  name: string;
  account_type: FinanceAccountType;
  account_subtype: string | null;
  parent_account_id: string | null;
  normal_balance: FinanceNormalBalance;
  is_active: boolean;
  is_cash_account?: boolean;
  is_contra_account?: boolean;
  revenue_restriction_class?: FinanceRevenueRestrictionClass | null;
  expense_functional_class?: FinanceExpenseFunctionalClass | null;
  program_classification?: string | null;
  grant_reporting_class?: string | null;
  form_990_line?: string | null;
  financial_statement_line?: string | null;
  entity_scope?: FinanceEntityScope;
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
  is_cash_account?: boolean;
  is_contra_account?: boolean;
  revenue_restriction_class?: FinanceRevenueRestrictionClass | null;
  expense_functional_class?: FinanceExpenseFunctionalClass | null;
  program_classification?: string | null;
  grant_reporting_class?: string | null;
  form_990_line?: string | null;
  financial_statement_line?: string | null;
  entity_scope?: FinanceEntityScope;
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
  ngo_id: string | null;
  entry_number: string;
  entry_date: string;
  memo: string | null;
  source_type: string | null;
  source_id: string | null;
  status: FinanceJournalEntryStatus;
  fiscal_period_id: string | null;
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
  ngo_id: string | null;
  entry_date: string;
  memo?: string | null;
  status?: FinanceJournalEntryStatus;
  fiscal_period_id?: string | null;
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

// ---------------------------------------------------------------------------
// Bank accounts
// ---------------------------------------------------------------------------

export interface FinanceBankAccount {
  id: string;
  ngo_id: string;
  account_kind: "bank" | "credit_card" | "cash";
  account_name: string;
  institution_name: string | null;
  last_four: string | null;
  linked_finance_account_id: string;
  opening_balance: number;
  opening_balance_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  ledger_balance?: number;
  linked_account?: Pick<FinanceAccount, "code" | "name"> | null;
}

export type FinanceBankAccountInput = {
  ngo_id: string;
  account_kind: "bank" | "credit_card" | "cash";
  account_name: string;
  institution_name?: string | null;
  last_four?: string | null;
  linked_finance_account_id: string;
  opening_balance?: number;
  opening_balance_date?: string;
  is_active?: boolean;
};

// ---------------------------------------------------------------------------
// Document / receipt links
// ---------------------------------------------------------------------------

export type FinanceDocumentLinkEntityType =
  | "journal_entry"
  | "journal_line"
  | "bill"
  | "bill_payment"
  | "payment"
  | "deposit"
  | "reimbursement";

export interface FinanceDocumentLink {
  id: string;
  document_id: string;
  entity_type: FinanceDocumentLinkEntityType;
  entity_id: string;
  link_notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  document?: { id: string; file_name: string } | null;
}

export type FinanceReceiptStatus = "attached" | "missing" | "partial";

export const FINANCE_DOCUMENT_LINK_ENTITY_LABELS: Record<FinanceDocumentLinkEntityType, string> = {
  journal_entry: "Journal entry",
  journal_line: "Journal line",
  bill: "Bill",
  bill_payment: "Bill payment",
  payment: "Payment",
  deposit: "Deposit",
  reimbursement: "Reimbursement",
};

// ---------------------------------------------------------------------------
// Accounts payable
// ---------------------------------------------------------------------------

export type FinanceBillStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "partially_paid"
  | "paid"
  | "voided";

export interface FinanceVendor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type FinanceVendorInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_notes?: string | null;
  is_active?: boolean;
};

export interface FinanceBillLine {
  id: string;
  bill_id: string;
  expense_account_id: string;
  amount: number;
  memo: string | null;
  fund_id: string | null;
  ngo_id: string | null;
  department_id: string | null;
  dimension_id: string | null;
  grant_application_id: string | null;
  line_number: number;
  created_at: string;
  updated_at: string;
}

export type FinanceBillLineInput = {
  id?: string;
  expense_account_id: string;
  amount: number;
  memo?: string | null;
  fund_id?: string | null;
  ngo_id?: string | null;
  department_id?: string | null;
  dimension_id?: string | null;
  grant_application_id?: string | null;
  line_number?: number;
};

export interface FinanceBill {
  id: string;
  ngo_id: string | null;
  vendor_id: string;
  bill_number: string;
  bill_date: string;
  due_date: string | null;
  terms: string | null;
  status: FinanceBillStatus;
  memo: string | null;
  document_id: string | null;
  total_amount: number;
  amount_paid: number;
  journal_entry_id: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  vendor?: Pick<FinanceVendor, "id" | "name"> | null;
  lines?: FinanceBillLine[];
  balance_due?: number;
}

export type FinanceBillInput = {
  ngo_id: string | null;
  vendor_id: string;
  bill_date: string;
  due_date?: string | null;
  terms?: string | null;
  memo?: string | null;
  document_id?: string | null;
  lines: FinanceBillLineInput[];
};

export interface FinanceBillPayment {
  id: string;
  bill_id: string;
  payment_date: string;
  amount: number;
  bank_account_id: string;
  journal_entry_id: string | null;
  memo: string | null;
  document_id: string | null;
  created_by_user_id: string | null;
  created_at: string;
}

export const FINANCE_BILL_STATUS_LABELS: Record<FinanceBillStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  partially_paid: "Partially paid",
  paid: "Paid",
  voided: "Voided",
};

// ---------------------------------------------------------------------------
// Payments / disbursements
// ---------------------------------------------------------------------------

export type FinancePaymentType =
  | "vendor_bill"
  | "reimbursement"
  | "ngo_disbursement"
  | "grant_pass_through"
  | "internal_transfer";

export type FinancePaymentStatus = "draft" | "pending_approval" | "posted" | "voided";
export type FinancePaymentMethod = "cash" | "check" | "ach" | "debit_card" | "credit_card" | "wire" | "other";

export interface FinancePayment {
  id: string;
  payment_number: string;
  payment_type: FinancePaymentType;
  payment_date: string;
  amount: number;
  status: FinancePaymentStatus;
  bank_account_id: string | null;
  target_bank_account_id: string | null;
  bill_id: string | null;
  payee_name: string | null;
  ngo_id: string | null;
  fund_id: string | null;
  grant_application_id: string | null;
  expense_account_id: string | null;
  payment_account_id: string | null;
  payment_method: FinancePaymentMethod | null;
  reference_number: string | null;
  memo: string | null;
  document_id: string | null;
  approval_notes: string | null;
  approved_by_user_id: string | null;
  approved_at: string | null;
  journal_entry_id: string | null;
  reversal_journal_entry_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  ngo?: { id: string; legal_name: string; common_name: string | null } | null;
  bill?: Pick<FinanceBill, "id" | "bill_number" | "vendor_id"> | null;
}

export type FinancePaymentInput = {
  payment_type: FinancePaymentType;
  payment_date: string;
  amount: number;
  bank_account_id?: string | null;
  target_bank_account_id?: string | null;
  bill_id?: string | null;
  payee_name?: string | null;
  ngo_id?: string | null;
  fund_id?: string | null;
  grant_application_id?: string | null;
  expense_account_id?: string | null;
  payment_account_id?: string | null;
  payment_method?: FinancePaymentMethod | null;
  reference_number?: string | null;
  memo?: string | null;
  document_id?: string | null;
  approval_notes?: string | null;
};

export const FINANCE_PAYMENT_TYPE_LABELS: Record<FinancePaymentType, string> = {
  vendor_bill: "Vendor bill payment",
  reimbursement: "Reimbursement",
  ngo_disbursement: "Sponsored NGO disbursement",
  grant_pass_through: "Grant pass-through",
  internal_transfer: "Internal transfer",
};

export const FINANCE_PAYMENT_STATUS_LABELS: Record<FinancePaymentStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  posted: "Posted",
  voided: "Voided",
};

export const FINANCE_PAYMENT_METHOD_LABELS: Record<FinancePaymentMethod, string> = {
  cash: "Cash",
  check: "Check",
  ach: "ACH / bank transfer",
  debit_card: "Debit card",
  credit_card: "Credit card",
  wire: "Wire transfer",
  other: "Other",
};

// Deposits
export type FinanceDepositSource = "donation" | "grant_award" | "program_revenue" | "admin_fee" | "reimbursement_refund" | "other_income";
export type FinanceDepositStatus = "draft" | "pending_approval" | "posted" | "voided";

export interface FinanceDepositLine {
  id: string; deposit_id: string; revenue_account_id: string; amount: number;
  fund_id: string | null; ngo_id: string | null; grant_application_id: string | null;
  restriction_type: string | null; donor_source: string | null; memo: string | null; line_number: number;
}
export type FinanceDepositLineInput = Omit<FinanceDepositLine, "id" | "deposit_id"> & { id?: string };
export interface FinanceDeposit {
  id: string; deposit_number: string; deposit_date: string; source_type: FinanceDepositSource;
  ngo_id: string | null;
  bank_account_id: string; total_amount: number; status: FinanceDepositStatus;
  memo: string | null; document_id: string | null; restriction_notes: string | null;
  journal_entry_id: string | null; created_at: string; updated_at: string; lines?: FinanceDepositLine[];
}
export type FinanceDepositInput = {
  deposit_date: string; source_type: FinanceDepositSource; bank_account_id: string;
  ngo_id: string | null;
  memo?: string | null; document_id?: string | null; restriction_notes?: string | null; lines: FinanceDepositLineInput[];
};
export const FINANCE_DEPOSIT_SOURCE_LABELS: Record<FinanceDepositSource, string> = {
  donation: "Donation", grant_award: "Grant award", program_revenue: "Program revenue",
  admin_fee: "Fiscal sponsorship admin fee", reimbursement_refund: "Reimbursement/refund", other_income: "Other income",
};

// Admin fee rules
export interface FinanceAdminFeeRule {
  id: string; name: string; default_percentage: number; ngo_id: string | null;
  grant_application_id: string | null; fee_account_id: string | null; fee_fund_id: string | null;
  pass_through_fund_id: string | null; is_active: boolean; created_at: string; updated_at: string;
}
export interface FinanceAdminFeeCalculation {
  suggested_fee: number; pass_through_amount: number; fee_percentage: number; rule_id: string | null;
}

// Reconciliation
export type FinanceReconciliationStatus = "in_progress" | "finalized" | "voided";
export interface FinanceBankReconciliation {
  id: string; ngo_id: string; bank_account_id: string; statement_import_id: string | null;
  statement_start_date: string; statement_end_date: string;
  beginning_balance: number; ending_balance: number; cleared_balance: number; difference: number;
  book_balance?: number | null;
  status: FinanceReconciliationStatus; exception_notes: string | null; finalized_at: string | null; created_at: string;
}
export interface FinanceBankReconciliationItem {
  id: string; reconciliation_id: string; journal_line_id: string | null;
  statement_transaction_id: string | null;
  transaction_date: string | null; description: string | null; amount: number; is_cleared: boolean; locked_at: string | null;
}

export type FinanceBankStatementImportStatus = "matching" | "reconciling" | "reconciled" | "voided";
export type FinanceBankStatementMatchStatus = "unmatched" | "suggested" | "matched" | "ignored" | "reconciled";

export interface FinanceBankStatementImport {
  id: string;
  ngo_id: string;
  bank_account_id: string;
  document_id: string;
  content_sha256: string;
  file_name: string;
  statement_start_date: string;
  statement_end_date: string;
  beginning_balance: number;
  ending_balance: number;
  transaction_total: number;
  statement_variance: number;
  row_count: number;
  status: FinanceBankStatementImportStatus;
  imported_at: string;
}

export interface FinanceBankStatementTransaction {
  id: string;
  import_id: string;
  ngo_id: string;
  bank_account_id: string;
  row_number: number;
  source_transaction_id: string | null;
  transaction_date: string;
  posted_date: string | null;
  description: string;
  amount: number;
  currency: string;
  reference_number: string | null;
  match_status: FinanceBankStatementMatchStatus;
  suggested_journal_line_id: string | null;
  matched_journal_line_id: string | null;
  match_confidence: number | null;
  ignore_reason: string | null;
}

// Budgets
export type FinanceBudgetStatus = "draft" | "pending_approval" | "approved" | "rejected" | "active" | "closed";
export interface FinanceBudget {
  id: string; name: string; fiscal_year: number; scope_type: string;
  department_id: string | null; ngo_id: string | null; fund_id: string | null;
  grant_application_id: string | null; status: FinanceBudgetStatus; memo: string | null; created_at: string;
  created_by_user_id?: string | null; work_item_id?: string | null; submitted_at?: string | null;
  reviewed_by_user_id?: string | null; reviewed_at?: string | null; rejected_reason?: string | null;
  lines?: FinanceBudgetLine[];
}
export interface FinanceBudgetLine {
  id: string; budget_id: string; account_id: string; period_month: number; amount: number; memo: string | null;
}
export type FinanceBudgetLineInput = { account_id: string; period_month: number; amount: number; memo?: string | null };

// Fiscal periods (Phase 3)
export type FinancePeriodStatus = "open" | "closed" | "locked";
export interface FinanceFiscalPeriod {
  id: string;
  ngo_id: string | null;
  label: string;
  fiscal_year: number;
  period_number: number | null;
  period_type: string;
  start_date: string;
  end_date: string;
  status: FinancePeriodStatus;
  closed_at: string | null;
  locked_at: string | null;
  reopen_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceOpeningBalance {
  id: string;
  fiscal_period_id: string;
  account_id: string;
  fund_id: string | null;
  ngo_id: string | null;
  debit: number;
  credit: number;
  memo: string | null;
}

// AR (Phase 7)
export type FinanceInvoiceStatus = "draft" | "sent" | "partial" | "paid" | "written_off" | "voided";
export interface FinanceDonor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  organization_name: string | null;
  donor_type: string;
  ngo_id: string | null;
  is_active: boolean;
  notes: string | null;
}
export interface FinanceInvoice {
  id: string;
  invoice_number: string;
  donor_id: string | null;
  customer_name: string | null;
  ngo_id: string | null;
  grant_application_id: string | null;
  invoice_date: string;
  due_date: string | null;
  status: FinanceInvoiceStatus;
  subtotal: number;
  total: number;
  amount_paid: number;
  amount_written_off: number;
  memo: string | null;
}

export const FINANCE_ENTITY_SCOPE_LABELS: Record<FinanceEntityScope, string> = {
  hpg_operating: "HPG Operating",
  fiscal_sponsorship: "Fiscal Sponsorship",
  consolidated: "Consolidated",
};

export const FINANCE_RESTRICTION_LABELS: Record<FinanceRevenueRestrictionClass, string> = {
  without_donor_restrictions: "Without donor restrictions",
  with_donor_restrictions: "With donor restrictions",
  grant_restricted: "Grant restricted",
  program_released: "Released from restriction",
  pass_through: "Pass-through",
};

export const FINANCE_FUNCTIONAL_LABELS: Record<FinanceExpenseFunctionalClass, string> = {
  program: "Program",
  management_general: "Management & general",
  fundraising: "Fundraising",
  pass_through: "Pass-through",
};
