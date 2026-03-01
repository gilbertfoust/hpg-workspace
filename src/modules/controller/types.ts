export interface ConsolidationReport {
  id: string;
  period: string;
  ngo_ids: string[];
  status: "draft" | "final";
  total_assets: number;
  total_liabilities: number;
}

export interface NGORiskScore {
  id: string;
  ngo_id: string;
  score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  factors: string[];
}

export interface InterNGOTransfer {
  id: string;
  from_ngo_id: string;
  to_ngo_id: string;
  amount: number;
  status: string;
}

export interface TreasuryPosition {
  id: string;
  account_name: string;
  balance: number;
  currency: string;
  as_of: string;
}
