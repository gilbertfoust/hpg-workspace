export interface RevenueStream {
  id: string;
  ngo_id: string;
  name: string;
  stream_type: string;
  source: string | null;
  description: string | null;
  is_active: boolean;
  annual_target: number | null;
  currency_code: string | null;
  account_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ngos?: { legal_name: string; common_name: string | null } | null;
}

export interface RecurringDonation {
  id: string;
  ngo_id: string;
  revenue_stream_id: string | null;
  donor_name: string;
  donor_email: string | null;
  donor_org_id: string | null;
  amount: number;
  currency_code: string | null;
  frequency: string;
  start_date: string;
  end_date: string | null;
  next_expected_date: string | null;
  status: string;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  revenue_streams?: { name: string } | null;
  crm_organizations?: { name: string } | null;
}

export interface RevenueRecognitionEntry {
  id: string;
  ngo_id: string;
  revenue_stream_id: string | null;
  fiscal_period_id: string | null;
  transaction_id: string | null;
  recognition_date: string;
  amount: number;
  deferred_amount: number;
  recognition_type: string;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  revenue_streams?: { name: string } | null;
  fiscal_periods?: { label: string } | null;
}

export const STREAM_TYPES = ["donation", "grant", "earned_income", "membership", "investment", "in_kind", "government", "other"] as const;
export const DONATION_FREQUENCIES = ["weekly", "biweekly", "monthly", "quarterly", "semi_annual", "annual", "one_time"] as const;
export const DONATION_STATUSES = ["active", "paused", "canceled", "completed", "failed"] as const;
export const RECOGNITION_TYPES = ["immediate", "deferred", "conditional", "milestone", "time_based"] as const;
